import net from 'node:net';

// Marionette's length-prefixed JSON protocol, shipped with Zen/Firefox.
export class Marionette {
  pending = new Map();
  buffer = Buffer.alloc(0);
  sequence = 0;

  async connect(port, createConnection = net.createConnection) {
    this.socket = createConnection({ host: '127.0.0.1', port });
    const hello = new Promise((resolve) => (this.hello = resolve));
    this.socket.on('data', (chunk) => {
      this.buffer = Buffer.concat([this.buffer, chunk]);
      while (true) {
        const colon = this.buffer.indexOf(58);
        if (colon < 0) break;
        const length = Number(this.buffer.subarray(0, colon).toString());
        if (this.buffer.length < colon + 1 + length) break;
        const packet = JSON.parse(this.buffer.subarray(colon + 1, colon + 1 + length));
        this.buffer = this.buffer.subarray(colon + 1 + length);
        if (!Array.isArray(packet)) this.hello(packet);
        else {
          const [, id, error, result] = packet;
          const request = this.pending.get(id);
          if (!request) continue;
          clearTimeout(request.timer);
          this.pending.delete(id);
          if (error) request.reject(new Error(`${error.error}: ${error.message}`));
          else request.resolve(result);
        }
      }
    });
    let rejectHello;
    const connectionError = new Promise((_, reject) => (rejectHello = reject));
    const fail = (error) => {
      rejectHello(error);
      for (const request of this.pending.values()) {
        clearTimeout(request.timer);
        request.reject(error);
      }
      this.pending.clear();
    };
    this.socket.on('error', fail);
    this.socket.on('close', () => fail(new Error('Marionette connection closed')));
    const handshakeTimer = setTimeout(
      () => fail(new Error('Marionette handshake timed out')),
      10000,
    );
    try {
      await Promise.race([hello, connectionError]);
    } finally {
      clearTimeout(handshakeTimer);
    }
    return this;
  }

  command(name, parameters = {}) {
    const id = ++this.sequence;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`Marionette command timed out: ${name}`));
      }, 120000);
      this.pending.set(id, { resolve, reject, timer });
      const body = JSON.stringify([0, id, name, parameters]);
      this.socket.write(`${Buffer.byteLength(body)}:${body}`);
    });
  }

  async script(script, args = [], async = false) {
    const result = await this.command(
      async ? 'WebDriver:ExecuteAsyncScript' : 'WebDriver:ExecuteScript',
      { script, args, sandbox: null, newSandbox: false, scriptTimeout: 90000 },
    );
    return result.value;
  }

  async context(value) {
    await this.command('Marionette:SetContext', { value });
  }

  close() {
    this.socket?.destroy();
  }
}
