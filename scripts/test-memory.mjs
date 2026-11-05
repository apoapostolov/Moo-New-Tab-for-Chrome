import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { access, cp, mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build, resolveConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { Marionette } from '../tests/memory/marionette.mjs';
import { Chromium } from '../tests/memory/chromium.mjs';
import { extensionManifest } from './extension-build.mjs';
import { fixtureServer, generateFixtures } from '../tests/memory/fixtures.mjs';
import { assessMemory, MiB, resourceErrors } from '../tests/memory/metrics.mjs';
import { monitorSystemMemory, headroomError } from '../tests/memory/system-memory.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
process.env.GOMAXPROCS ||= '2';
process.env.RAYON_NUM_THREADS ||= '2';
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index < 0 ? fallback : args[index + 1];
};
const number = (name, fallback) => {
  const value = Number(option(name, fallback));
  if (!Number.isFinite(value) || value <= 0) throw new Error(`--${name} must be a positive number`);
  return value;
};
const cycles = number('cycles', 30);
const soakSeconds = number('soak-seconds', 60);
const project = JSON.parse(await readFile(path.join(root, 'moo.config.json'), 'utf8'));
const engine = option('engine', project.defaultBrowser);
if (!['chrome', 'firefox'].includes(engine)) throw new Error('--engine must be chrome or firefox');
const output = path.resolve(
  root,
  option('output', engine === 'chrome' ? 'output/memory-chrome' : 'output/memory'),
);
const outputRoot = path.resolve(root, 'output') + path.sep;
if (!output.startsWith(outputRoot))
  throw new Error('--output must be a subdirectory of the repository output directory');
const limits = {
  maxResidentMiB: number('max-resident-mib', 3072),
  maxGrowthMiB: number('max-growth-mib', 96),
  maxSlopeMiB: number('max-slope-mib', 12),
  growthMetric: engine === 'chrome' ? 'privateBytes' : 'explicit',
};
const browserPath = option(
  'browser',
  engine === 'chrome'
    ? process.env.CHROME_BINARY || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
    : process.env.ZEN_BINARY || 'C:/Program Files/Zen Twilight/zen.exe',
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const report = {
  started: new Date().toISOString(),
  status: 'running',
  configuration: {
    browserPath,
    engine,
    cycles,
    soakSeconds,
    limits,
    include4K: args.includes('--include-4k'),
    headless: !args.includes('--headed'),
  },
  scenarios: [],
  samples: [],
  limitations: [
    'Isolated profile without user extensions',
    'Synthetic local webcam streams; public provider uptime is outside these tests',
    'Resident memory counts shared pages per process; dedicated GPU memory is not measured',
    engine === 'chrome'
      ? 'Instrumented extension build with production components, extension APIs and CSP; private bytes are Windows process commit, not Gecko explicit memory'
      : 'Gecko explicit memory excludes some driver allocations; harness runs on a local HTTP origin',
    'Finite stress run cannot prove absence of all leaks',
    ...(engine === 'chrome' && args.includes('--headed')
      ? [
          'Windows native window occlusion is disabled so desktop use cannot pause the soak; real tab visibility remains enabled and is tested',
        ]
      : []),
  ],
};
await mkdir(output, { recursive: true });
let browser;
let server;
let driver;
let browserLog = '';
let watchdog;
let safetyFailure;
let systemMonitor;
class MemorySafetyStop extends Error {}
const save = () => writeFile(path.join(output, 'report.json'), JSON.stringify(report, null, 2));

function checkHeadroom() {
  const memory = systemMonitor.read();
  report.systemMemory = memory;
  const error = headroomError(memory);
  if (error) throw new MemorySafetyStop(error);
  return memory;
}

async function prepare() {
  console.log('Generating local video, 4K image and HLS webcam fixtures');
  await generateFixtures(path.join(output, 'media'));
  const config = await resolveConfig({ root }, 'build');
  await build({
    configFile: false,
    root,
    logLevel: 'warn',
    plugins: [react()],
    resolve: config.resolve,
    define: config.define,
    build: {
      outDir: path.join(output, 'site'),
      emptyOutDir: true,
      target: 'esnext',
      minify: false,
      cssMinify: false,
      sourcemap: false,
      rollupOptions: {
        input: path.join(root, 'tests/memory/harness.html'),
        output: {
          manualChunks(id) {
            if (id.includes('/node_modules/')) {
              const module = id.split('/node_modules/').at(-1).split('/');
              return `vendor-${module[0].startsWith('@') ? module.slice(0, 2).join('-') : module[0]}`;
            }
            if (id.includes('/i18n/locales/')) return `locale-${path.basename(id, '.json')}`;
          },
        },
      },
    },
  });
  if (engine === 'chrome') {
    const site = path.join(output, 'site');
    const manifest = extensionManifest('chrome', root);
    manifest.host_permissions.push('http://127.0.0.1/*');
    // Instrument only this disposable package. Keep the production CSP and worker.
    await writeFile(path.join(site, 'manifest.json'), JSON.stringify(manifest, null, 2));
    await cp(path.join(site, 'tests/memory/harness.html'), path.join(site, 'index.html'));
    for (const file of ['background.js', 'calendar-alerts.js', 'service-worker.js'])
      await cp(path.join(root, 'manifest', file), path.join(site, file));
    await cp(path.join(root, 'src/assets/icons'), path.join(site, 'icons'), { recursive: true });
    await cp(path.join(root, 'manifest/_locales'), path.join(site, '_locales'), {
      recursive: true,
    });
  }
  // This separate build never invokes the release packaging plugin or replaces archives.
  console.log('Memory harness built');
}

async function freePort() {
  const socket = net.createServer();
  await new Promise((resolve, reject) => {
    socket.once('error', reject);
    socket.listen(0, '127.0.0.1', resolve);
  });
  const port = socket.address().port;
  await new Promise((resolve) => socket.close(resolve));
  return port;
}

async function verifyLoopback() {
  const listener = net.createServer();
  let client;
  try {
    await new Promise((resolve, reject) => {
      listener.once('error', reject);
      listener.listen(0, '127.0.0.1', resolve);
    });
    const port = listener.address().port;
    await new Promise((resolve, reject) => {
      client = net.createConnection({ host: '127.0.0.1', port });
      client.once('connect', resolve);
      client.once('error', reject);
    });
    report.environment = { ...report.environment, loopback: 'available' };
  } catch (error) {
    report.environment = {
      ...report.environment,
      loopback: 'blocked',
      loopbackError: { code: error.code, message: error.message },
    };
    throw new Error(
      `Local loopback TCP is unavailable to this process (${error.code || 'unknown'}): ${error.message}. The memory run requires local fixture and automation connections.`,
    );
  } finally {
    client?.destroy();
    if (listener.listening) await new Promise((resolve) => listener.close(resolve));
  }
}

async function page(expression) {
  await driver.context('content');
  const result = await driver.script(
    `const done = arguments[arguments.length - 1]; Promise.resolve().then(async () => (${expression})).then(value => done({ value }), error => done({ error: String(error.stack || error) }));`,
    [],
    true,
  );
  if (result.error) throw new Error(result.error);
  return result.value;
}

async function memory(label, settled = false) {
  if (safetyFailure) throw safetyFailure;
  const system = checkHeadroom();
  if (engine === 'chrome') {
    const result = await driver.measure(settled);
    const sample = { label, settled, time: Date.now(), system, ...result };
    report.samples.push(sample);
    console.log(
      `${label}: resident ${(sample.resident / MiB).toFixed(1)} MiB, private ${(sample.privateBytes / MiB).toFixed(1)} MiB, JS ${(sample.jsHeap / MiB).toFixed(1)} MiB`,
    );
    if (sample.resident > limits.maxResidentMiB * MiB)
      throw new MemorySafetyStop(`Memory ceiling exceeded at ${label}`);
    await save();
    return sample;
  }
  await driver.context('chrome');
  const result = await driver.script(
    `
    const done = arguments[arguments.length - 1];
    const manager = Cc['@mozilla.org/memory-reporter-manager;1'].getService(Ci.nsIMemoryReporterManager);
    const collect = () => {
      const processes = {};
      manager.getReports((process, path, kind, units, amount) => {
        if (units !== Ci.nsIMemoryReporter.UNITS_BYTES) return;
        const item = processes[process || 'parent'] ||= { resident: 0, explicit: 0, js: 0, media: 0 };
        if (path === 'resident') item.resident = amount;
        if (path.startsWith('explicit/')) item.explicit += amount;
        if (path.startsWith('explicit/') && /js-(non-)?window|js-zone/.test(path)) item.js += amount;
        if (path.startsWith('explicit/') && /media|video|audio/.test(path)) item.media += amount;
      }, null, () => done({ processes }), null, false);
    };
    if (arguments[0]) manager.minimizeMemoryUsage(collect); else collect();
  `,
    [settled],
    true,
  );
  const sample = { label, settled, time: Date.now(), system, ...result, resident: 0, explicit: 0 };
  for (const process of Object.values(result.processes)) {
    sample.resident += process.resident;
    sample.explicit += process.explicit;
  }
  report.samples.push(sample);
  await driver.context('content');
  console.log(
    `${label}: resident ${(sample.resident / MiB).toFixed(1)} MiB, explicit ${(sample.explicit / MiB).toFixed(1)} MiB`,
  );
  // Stop before testing causes extreme memory pressure on the workstation.
  if (sample.resident > limits.maxResidentMiB * MiB)
    throw new MemorySafetyStop(`Memory ceiling exceeded at ${label}`);
  return sample;
}

let baseline;
async function clean() {
  await page('window.memorySuite.clear()');
  // Let the browser finish asynchronous media resource selection teardown before
  // examining detached elements and fixture response state.
  await sleep(250);
  const snapshot = await page('window.memorySuite.snapshot()');
  const errors = resourceErrors(snapshot, baseline);
  if (errors.length) throw new Error(errors.join('; '));
  // The server must also see all continuous/stalled responses close.
  if (server.metrics.active > 0)
    throw new Error(`${server.metrics.active} fixture responses remain active after unmount`);
  return snapshot;
}

async function scenario(name, action) {
  console.log(`SCENARIO ${name}`);
  const result = { name, started: new Date().toISOString(), status: 'running' };
  report.scenarios.push(result);
  try {
    await action(result);
    result.after = await clean();
    result.status = 'passed';
  } catch (error) {
    result.status = 'failed';
    result.error = String(error.stack || error);
    if (error instanceof MemorySafetyStop || safetyFailure) {
      await save();
      throw safetyFailure || error;
    }
    // Continue independent scenarios while retaining the original failure evidence.
    try {
      await page('window.memorySuite.clear()');
    } catch {
      /* transport may have failed */
    }
  }
  result.finished = new Date().toISOString();
  await save();
}

try {
  systemMonitor = await monitorSystemMemory();
  checkHeadroom();
  if (!args.includes('--build-only')) await verifyLoopback();
  await prepare();
  if (args.includes('--build-only')) {
    report.status = 'built';
  } else {
    checkHeadroom();
    await access(browserPath);
    server = await fixtureServer(path.join(output, 'site'), path.join(output, 'media'));
    if (engine === 'chrome') {
      const profile = await mkdtemp(path.join(os.tmpdir(), 'moo-chrome-memory-'));
      report.profile = profile;
      browser = spawn(
        browserPath,
        [
          `--user-data-dir=${profile}`,
          '--remote-debugging-pipe',
          '--enable-unsafe-extension-debugging',
          '--no-first-run',
          '--no-default-browser-check',
          '--disable-background-networking',
          '--autoplay-policy=no-user-gesture-required',
          ...(args.includes('--headed')
            ? [
                '--disable-backgrounding-occluded-windows',
                '--disable-features=CalculateNativeWinOcclusion',
              ]
            : []),
          ...(args.includes('--headed') ? [] : ['--headless=new']),
          'about:blank',
        ],
        { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe', 'pipe', 'pipe'] },
      );
      browser.stdout.on('data', (data) => (browserLog += data));
      browser.stderr.on('data', (data) => (browserLog += data));
      driver = new Chromium(browser, server.origin);
      browser.on('error', (error) => driver.close(error));
      report.browser = await driver.start(path.join(output, 'site'));
      report.gpu = await driver.send('SystemInfo.getInfo');
      report.extension = { id: driver.extensionId, origin: driver.origin, instrumented: true };
    } else {
      const port = await freePort();
      const profile = await mkdtemp(path.join(os.tmpdir(), 'moo-memory-'));
      report.profile = profile;
      const preferences = {
        'marionette.port': port,
        'browser.shell.checkDefaultBrowser': false,
        'browser.startup.homepage_override.mstone': 'ignore',
        'browser.startup.page': 0,
        'browser.sessionstore.resume_from_crash': false,
        'zen.welcome-screen.seen': true,
        'media.autoplay.default': 0,
        'datareporting.policy.dataSubmissionEnabled': false,
        'toolkit.telemetry.enabled': false,
      };
      await writeFile(
        path.join(profile, 'user.js'),
        Object.entries(preferences)
          .map(([key, value]) => `user_pref(${JSON.stringify(key)}, ${JSON.stringify(value)});`)
          .join('\n'),
      );
      browser = spawn(
        browserPath,
        [
          ...(args.includes('--headed') ? [] : ['--headless']),
          '--no-remote',
          '--marionette',
          '--profile',
          profile,
        ],
        {
          windowsHide: true,
          // Gecko requires this environment variable for Marionette chrome-context
          // commands. Scope it to the isolated test browser, never the parent runner.
          env: { ...process.env, MOZ_REMOTE_ALLOW_SYSTEM_ACCESS: '1' },
        },
      );
      browser.stdout.on('data', (data) => (browserLog += data));
      browser.stderr.on('data', (data) => (browserLog += data));
      let launchError;
      browser.on('error', (error) => (launchError = error));
      let lastError;
      for (let attempt = 0; attempt < 80; attempt++) {
        if (launchError) throw launchError;
        if (browser.exitCode !== null)
          throw new Error(
            `Zen exited during startup: ${browser.exitCode}. ${browserLog.slice(-1500)}`,
          );
        driver = new Marionette();
        try {
          await driver.connect(port);
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          driver.close();
          if (error.code === 'EACCES')
            throw new Error(
              `Automation transport blocked by the execution environment: ${error.message}`,
            );
          await sleep(250);
        }
      }
      if (lastError) throw lastError;
      report.session = await driver.command('WebDriver:NewSession', {
        capabilities: { alwaysMatch: { acceptInsecureCerts: false } },
      });
      await driver.context('chrome');
      report.browser = await driver.script(
        'return {name:Services.appinfo.name, version:Services.appinfo.version, buildID:Services.appinfo.appBuildID, platformVersion:Services.appinfo.platformVersion};',
      );
      await driver.context('content');
    }
    watchdog = setInterval(() => {
      try {
        checkHeadroom();
      } catch (error) {
        safetyFailure = error;
        browser.kill();
        driver?.close();
        clearInterval(watchdog);
      }
    }, 1000);
    await driver.command('WebDriver:Navigate', { url: server.origin });
    for (let i = 0; i < 150 && !(await page('Boolean(window.memorySuite)')); i++) await sleep(100);
    if (!(await page('Boolean(window.memorySuite)')))
      throw new Error('Memory harness did not initialize');
    await page('window.memorySuite.fullApp()');
    await sleep(500);
    await page('window.memorySuite.clear()');
    baseline = await page('window.memorySuite.snapshot()');
    if (baseline.errors.length)
      throw new Error(`App warm-up failed: ${baseline.errors.join('; ')}`);
    report.baselineResources = baseline;
    await scenario('warm-up MP4 and HLS decoders', async () => {
      const files = [
        '720.mp4',
        '1080.mp4',
        ...(args.includes('--include-4k') ? ['2160.mp4'] : []),
        'live.m3u8',
      ];
      for (const file of files) {
        await page(
          `window.memorySuite.video(${JSON.stringify(file)}, ${file.endsWith('m3u8') ? '{hls:true,live:true}' : '{}'})`,
        );
        await page('window.memorySuite.playing()');
      }
    });
    await memory('warmed baseline', true);
    await scenario('MP4 source replacement and unmount', async () => {
      for (let i = 0; i < cycles; i++) {
        await page(`window.memorySuite.video('${i % 2 ? '1080' : '720'}.mp4?cycle=${i}')`);
        await page('window.memorySuite.playing()');
        if (i % 10 === 9) await memory(`MP4 switch ${i + 1}`);
      }
    });
    await memory('after MP4 switches', true);
    if (args.includes('--include-4k'))
      await scenario('4K decoding and repeated source disposal', async () => {
        for (let i = 0; i < Math.max(3, Math.ceil(cycles / 10)); i++) {
          await page(`window.memorySuite.video('2160.mp4?cycle=${i}')`);
          await page('window.memorySuite.playing(30000)');
          const snapshot = await page('window.memorySuite.snapshot()');
          if (snapshot.height !== 2160) throw new Error(`4K fixture decoded at ${snapshot.height}`);
          await memory(`4K decode ${i + 1}`);
          await clean();
        }
      });
    else
      report.scenarios.push({
        name: '4K decoding and repeated source disposal',
        status: 'skipped',
        reason: 'Requires explicit --include-4k',
      });
    await scenario('HLS webcam channel switching', async () => {
      for (let i = 0; i < cycles; i++) {
        await page(`window.memorySuite.video('live.m3u8?channel=${i}',{hls:true,live:true})`);
        await page('window.memorySuite.playing()');
        const snapshot = await page('window.memorySuite.snapshot()');
        if (snapshot.players !== 1)
          throw new Error(`Expected one HLS player, saw ${snapshot.players}`);
      }
    });
    await memory('after HLS switches', true);
    await scenario('React StrictMode setup and teardown', async () => {
      await page('window.memorySuite.strict(true)');
      try {
        for (let i = 0; i < cycles; i++) {
          await page(`window.memorySuite.video('live.m3u8?strict=${i}',{hls:true,live:true})`);
          await clean();
        }
      } finally {
        await page('window.memorySuite.strict(false)');
      }
    });
    await scenario('rapid HLS initialization cancellation', async () => {
      for (let i = 0; i < cycles; i++)
        await page(
          `(async()=>{const p=window.memorySuite.video('live.m3u8?cancel=${i}',{hls:true,live:true}); await window.memorySuite.clear(); await p;})()`,
        );
    });
    await scenario('missing, corrupt and stalled MP4 failures', async (result) => {
      const before = (await page('window.memorySuite.snapshot()')).failures;
      for (const file of ['missing.mp4', 'corrupt.mp4', 'stall.mp4']) {
        await page(`window.memorySuite.video('${file}')`);
        await sleep(file === 'stall.mp4' ? 13500 : 2000);
        await clean();
      }
      result.failuresReported = (await page('window.memorySuite.snapshot()')).failures - before;
      if (result.failuresReported !== 3)
        throw new Error(`Expected 3 failure callbacks, saw ${result.failuresReported}`);
    });
    await scenario('failed HLS retries stop after removal', async () => {
      for (let i = 0; i < 5; i++) {
        await page(`window.memorySuite.video('broken.m3u8?retry=${i}',{hls:true,live:true})`);
        await sleep(500);
        await clean();
      }
      const requests = server.metrics.requests;
      await sleep(4000);
      if (server.metrics.requests !== requests)
        throw new Error('HLS retries continued after unmount');
    });
    await scenario('slow download cancellation', async () => {
      for (let i = 0; i < cycles; i++) {
        await page(`window.memorySuite.video('slow.mp4?cancel=${i}')`);
        await clean();
      }
    });
    await scenario('image crossfade, blob revocation and video transitions', async () => {
      for (let i = 0; i < cycles; i++) {
        await page(`window.memorySuite.image(${i})`);
        await page(`window.memorySuite.video('720.mp4?image=${i}')`);
        await clean();
      }
    });
    await memory('after failure and crossfade tests', true);
    await scenario('webcam offline and online cycles', async () => {
      await page("window.memorySuite.video('live.m3u8',{hls:true,live:true})");
      await page('window.memorySuite.playing()');
      for (let i = 0; i < 5; i++) {
        await page('window.memorySuite.offline(true)');
        if (!(await page('window.memorySuite.snapshot()')).paused)
          throw new Error('Offline webcam was not paused');
        await sleep(300);
        const before = server.metrics.requests;
        await sleep(1000);
        if (server.metrics.requests !== before)
          throw new Error('Offline webcam kept requesting segments');
        await page('window.memorySuite.offline(false)');
        await page('window.memorySuite.playing()');
      }
    });
    await scenario('hidden webcam tab stops downloads and resumes', async (result) => {
      await page("window.memorySuite.video('live.m3u8',{hls:true,live:true})");
      await page('window.memorySuite.playing()');
      const original = (await driver.command('WebDriver:GetWindowHandle')).value;
      const background = await driver.command('WebDriver:NewWindow', { type: 'tab', focus: true });
      const handle = background.handle || background.value?.handle;
      try {
        await driver.command('WebDriver:SwitchToWindow', { handle });
        await sleep(500);
        if (engine === 'chrome') {
          result.hiddenSnapshot = await driver.script(
            'return window.memorySuite.snapshot()',
            [],
            false,
            original,
          );
          if (!result.hiddenSnapshot.hidden || !result.hiddenSnapshot.paused)
            throw new Error(
              `Original webcam tab did not hide and pause: ${JSON.stringify(result.hiddenSnapshot)}`,
            );
        }
        const before = server.metrics.requests;
        await sleep(4000);
        if (server.metrics.requests !== before)
          throw new Error('Hidden webcam continued downloading');
      } finally {
        await driver.command('WebDriver:CloseWindow');
        await driver.command('WebDriver:SwitchToWindow', { handle: original });
      }
      if ((await page('window.memorySuite.snapshot()')).hidden)
        throw new Error('Webcam tab did not become visible');
      await page('window.memorySuite.playing()');
    });
    await scenario('full Moo App background disable and source changes', async () => {
      await page('window.memorySuite.fullApp()');
      for (let i = 0; i < 8; i++) {
        await page(
          `window.memorySuite.source('${i % 2 ? 'live.m3u8' : '720.mp4'}',${Boolean(i % 2)})`,
        );
        await page('window.memorySuite.playing()');
        await page('window.memorySuite.enabled(false)');
        const snapshot = await page('window.memorySuite.snapshot()');
        if (snapshot.players || snapshot.videos)
          throw new Error('Disabling Background retained video resources');
        await page('window.memorySuite.enabled(true)');
      }
    });
    await scenario('multiple Moo tabs and tab closure', async () => {
      const original = (await driver.command('WebDriver:GetWindowHandle')).value;
      const handles = [];
      try {
        for (let i = 0; i < 4; i++) {
          const opened = await driver.command('WebDriver:NewWindow', { type: 'tab', focus: true });
          const handle = opened.handle || opened.value?.handle;
          handles.push(handle);
          await driver.command('WebDriver:SwitchToWindow', { handle });
          await driver.command('WebDriver:Navigate', { url: server.origin });
          for (let j = 0; j < 100 && !(await page('Boolean(window.memorySuite)')); j++)
            await sleep(100);
          await page(
            `window.memorySuite.video('${i % 2 ? 'live.m3u8' : '1080.mp4'}',${i % 2 ? '{hls:true,live:true}' : '{}'})`,
          );
          await page('window.memorySuite.playing()');
          await memory(`tabs ${i + 1}`);
        }
      } finally {
        for (const handle of handles.reverse()) {
          await driver.context('content');
          await driver.command('WebDriver:SwitchToWindow', { handle });
          await driver.command('WebDriver:CloseWindow');
        }
        await driver.command('WebDriver:SwitchToWindow', { handle: original });
      }
    });
    await memory('after tab closure', true);
    for (const [name, file, options] of [
      ['MP4 playback soak', '1080.mp4', '{}'],
      ['live webcam buffer soak', 'live.m3u8', '{hls:true,live:true}'],
    ]) {
      await scenario(name, async (result) => {
        await page(`window.memorySuite.video('${file}',${options})`);
        await page('window.memorySuite.playing()');
        result.playback = [];
        const deadline = Date.now() + soakSeconds * 1000;
        while (Date.now() < deadline) {
          await sleep(Math.min(5000, deadline - Date.now()));
          const snapshot = await page('window.memorySuite.snapshot()');
          const previous = result.playback.at(-1);
          result.playback.push(snapshot);
          if (!snapshot.videos || snapshot.paused || snapshot.height === 0)
            throw new Error('Playback stopped during the soak');
          if (previous && snapshot.decodedFrames <= previous.decodedFrames)
            throw new Error('Decoded frames stopped advancing during the soak');
          if (snapshot.bufferedSeconds > 45 && options !== '{}')
            throw new Error(`HLS buffer grew to ${snapshot.bufferedSeconds}s`);
          await memory(name);
        }
      });
    }
    await memory('final settled', true);
    report.assessment = assessMemory(report.samples, limits);
    report.network = server.metrics;
    report.status =
      report.scenarios.some((result) => !['passed', 'skipped'].includes(result.status)) ||
      report.assessment.errors.length
        ? 'failed'
        : 'passed';
  }
} catch (error) {
  report.status = error instanceof MemorySafetyStop || safetyFailure ? 'failed' : 'blocked';
  report.error = String((safetyFailure || error).stack || error);
  console.error(report.error);
} finally {
  clearInterval(watchdog);
  systemMonitor?.close();
  if (driver?.socket && !driver.socket.destroyed) {
    try {
      await driver.command('Marionette:Quit', { flags: ['eForceQuit'] });
    } catch {
      /* startup may not have completed */
    }
    driver.close();
  }
  if (browser && browser.exitCode === null) {
    browser.kill();
    await Promise.race([once(browser, 'exit'), sleep(3000)]);
  }
  await server?.close();
  report.finished = new Date().toISOString();
  await writeFile(path.join(output, 'browser.log'), browserLog);
  await save();
  console.log(`Memory suite: ${report.status}. Report: ${path.join(output, 'report.json')}`);
  process.exitCode = report.status === 'passed' || report.status === 'built' ? 0 : 1;
}
