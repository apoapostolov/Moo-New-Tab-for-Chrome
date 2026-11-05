import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Chrome's private debugging pipe is required for Extensions.loadUnpacked.
// The scenario runner uses the same small window/script interface as Marionette.
export class Chromium {
  pending = new Map();
  sessions = new Map();
  sequence = 0;
  buffer = '';

  constructor(browser, mediaOrigin) {
    this.browser = browser;
    this.mediaOrigin = mediaOrigin;
    this.socket = { destroyed: false };
    this.output = browser.stdio[4];
    this.input = browser.stdio[3];
    this.output.setEncoding('utf8');
    this.output.on('data', (chunk) => {
      this.buffer += chunk;
      let end;
      while ((end = this.buffer.indexOf('\0')) >= 0) {
        const packet = JSON.parse(this.buffer.slice(0, end));
        this.buffer = this.buffer.slice(end + 1);
        const request = this.pending.get(packet.id);
        if (!request) continue;
        clearTimeout(request.timer);
        this.pending.delete(packet.id);
        if (packet.error) request.reject(new Error(`${request.method}: ${packet.error.message}`));
        else request.resolve(packet.result);
      }
    });
    this.output.on('error', (error) => this.close(error));
    this.input.on('error', (error) => this.close(error));
    browser.on('exit', () => this.close(new Error('Chrome exited')));
  }

  send(method, params = {}, sessionId) {
    if (this.socket.destroyed) return Promise.reject(new Error('Chrome debugging pipe closed'));
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Chrome command timed out: ${method}`));
      }, 90000);
      this.pending.set(id, { resolve, reject, timer, method });
      this.input.write(
        `${JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) })}\0`,
      );
    });
  }

  async start(extensionPath) {
    const version = await this.send('Browser.getVersion');
    const { id } = await this.send('Extensions.loadUnpacked', { path: extensionPath });
    this.extensionId = id;
    this.origin = `chrome-extension://${id}`;
    // Retire Chrome's startup page and the add-on's automatic install tab.
    await new Promise((resolve) => setTimeout(resolve, 1000));
    const { targetInfos } = await this.send('Target.getTargets');
    const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
    for (const target of targetInfos.filter((target) => target.type === 'page'))
      await this.send('Target.closeTarget', { targetId: target.targetId });
    await this.select(targetId);
    return version;
  }

  async select(targetId) {
    if (!this.sessions.has(targetId)) {
      const { sessionId } = await this.send('Target.attachToTarget', { targetId, flatten: true });
      this.sessions.set(targetId, sessionId);
      await this.send('Page.enable', {}, sessionId);
      await this.send(
        'Page.addScriptToEvaluateOnNewDocument',
        {
          source: `globalThis.__MOO_MEMORY_ORIGIN__ = ${JSON.stringify(this.mediaOrigin)};`,
        },
        sessionId,
      );
    }
    this.targetId = targetId;
    await this.send('Target.activateTarget', { targetId });
    await this.send('Page.bringToFront', {}, this.sessions.get(targetId));
    for (let attempt = 0; attempt < 40; attempt++) {
      if (!(await this.script('return document.hidden'))) return;
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    throw new Error(`Chrome did not make the selected tab visible: ${targetId}`);
  }

  async context() {}

  async script(script, args = [], asynchronous = false, targetId = this.targetId) {
    const expression = asynchronous
      ? `new Promise((resolve) => { (function(){${script}\n})(...${JSON.stringify(args)}, resolve); })`
      : `(function(){${script}\n})(...${JSON.stringify(args)})`;
    const result = await this.send(
      'Runtime.evaluate',
      {
        expression,
        awaitPromise: true,
        returnByValue: true,
      },
      this.sessions.get(targetId),
    );
    if (result.exceptionDetails)
      throw new Error(
        result.exceptionDetails.exception?.description || result.exceptionDetails.text,
      );
    return result.result.value;
  }

  async command(name, args = {}) {
    switch (name) {
      case 'WebDriver:GetWindowHandle':
        return { value: this.targetId };
      case 'WebDriver:NewWindow': {
        const { targetId } = await this.send('Target.createTarget', { url: 'about:blank' });
        return { handle: targetId };
      }
      case 'WebDriver:SwitchToWindow':
        return this.select(args.handle);
      case 'WebDriver:CloseWindow': {
        await this.send('Target.closeTarget', { targetId: this.targetId });
        this.sessions.delete(this.targetId);
        return;
      }
      case 'WebDriver:Navigate': {
        const url = args.url === this.mediaOrigin ? `${this.origin}/index.html` : args.url;
        const result = await this.send('Page.navigate', { url }, this.sessions.get(this.targetId));
        if (result.errorText) throw new Error(result.errorText);
        for (let attempt = 0; attempt < 100; attempt++) {
          await new Promise((resolve) => setTimeout(resolve, 50));
          try {
            if (await this.script('return document.readyState === "complete"')) {
              await this.select(this.targetId);
              return;
            }
          } catch {
            /* navigation replaces the execution context */
          }
        }
        throw new Error(`Chrome navigation did not complete: ${url}`);
      }
      case 'Marionette:Quit':
        return this.send('Browser.close');
      default:
        throw new Error(`Unsupported Chrome scenario command: ${name}`);
    }
  }

  async measure(settled) {
    let jsHeap = 0;
    const heaps = {};
    const isolates = new Set();
    for (const [targetId, sessionId] of this.sessions) {
      const { id: isolateId } = await this.send('Runtime.getIsolateId', {}, sessionId);
      if (settled && !isolates.has(isolateId))
        await this.send('HeapProfiler.collectGarbage', {}, sessionId);
      const heap = await this.send('Runtime.getHeapUsage', {}, sessionId);
      if (!isolates.has(isolateId)) jsHeap += heap.usedSize;
      isolates.add(isolateId);
      heaps[targetId] = { ...heap, isolateId };
    }
    if (settled) await new Promise((resolve) => setTimeout(resolve, 500));
    let processes;
    let measurementAttempts = 0;
    const measurementRetries = [];
    // A utility process can exit between CDP's PID snapshot and OpenProcess.
    // Retry the complete snapshot rather than silently omitting that process.
    for (let attempt = 0; attempt < 3; attempt++) {
      measurementAttempts++;
      const { processInfo } = await this.send('SystemInfo.getProcessInfo');
      const result = spawnSync(
        process.env.PYTHON || 'python',
        [
          fileURLToPath(new URL('./process-memory.py', import.meta.url)),
          JSON.stringify(processInfo),
        ],
        { encoding: 'utf8', windowsHide: true, timeout: 5000 },
      );
      if (result.status === 0) {
        processes = JSON.parse(result.stdout);
        break;
      }
      measurementRetries.push(String(result.error || result.stderr));
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    if (!processes)
      throw new Error(`Chrome process measurement failed: ${measurementRetries.join('; ')}`);
    if (
      !processes.some((process) => process.type === 'browser') ||
      !processes.some((process) => process.type === 'renderer')
    )
      throw new Error('Chrome measurement is missing the browser or renderer process');
    return {
      processes,
      heaps,
      jsHeap,
      measurementAttempts,
      measurementRetries,
      resident: processes.reduce((sum, process) => sum + process.resident, 0),
      privateBytes: processes.reduce((sum, process) => sum + process.privateBytes, 0),
    };
  }

  close(error = new Error('Chrome debugging pipe closed')) {
    this.socket.destroyed = true;
    for (const request of this.pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    this.pending.clear();
    this.input.destroy();
    this.output.destroy();
  }
}
