import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { test } from 'node:test';
import { Marionette } from './memory/marionette.mjs';

const packet = (value) => {
  const json = JSON.stringify(value);
  return Buffer.from(`${Buffer.byteLength(json)}:${json}`);
};
async function transport() {
  const socket = Object.assign(new EventEmitter(), {
    writes: [],
    write(data) {
      this.writes.push(data);
    },
    destroy() {
      this.destroyed = true;
      this.emit('close');
    },
  });
  const client = new Marionette();
  const connected = client.connect(1, () => socket);
  socket.emit('data', packet({ applicationType: 'gecko', marionetteProtocol: 3 }));
  await connected;
  return { client, socket };
}

test('Marionette parses fragmented UTF-8 and coalesced response packets', async () => {
  const { client, socket } = await transport();
  try {
    const first = client.command('first');
    const second = client.command('second');
    const bytes = Buffer.concat([
      packet([1, 1, null, { value: 'София' }]),
      packet([1, 2, null, { value: 42 }]),
    ]);
    for (const byte of bytes) socket.emit('data', Buffer.from([byte]));
    assert.deepEqual(await first, { value: 'София' });
    assert.deepEqual(await second, { value: 42 });
    assert.equal(client.pending.size, 0);
  } finally {
    client.close();
  }
});

test('Marionette surfaces command errors and releases pending timers', async () => {
  const { client, socket } = await transport();
  try {
    const result = client.command('invalid');
    const rejection = assert.rejects(result, /invalid argument: bad fixture/);
    socket.emit(
      'data',
      packet([1, 1, { error: 'invalid argument', message: 'bad fixture' }, null]),
    );
    await rejection;
    assert.equal(client.pending.size, 0);
  } finally {
    client.close();
  }
});

test('Marionette closes outstanding requests when the browser exits', async () => {
  const { client } = await transport();
  const rejection = assert.rejects(client.command('pending'), /connection closed/);
  client.close();
  await rejection;
  assert.equal(client.pending.size, 0);
});

test('Marionette startup errors fail without hanging the handshake', async () => {
  const socket = new EventEmitter();
  const client = new Marionette();
  const connected = client.connect(1, () => socket);
  const rejection = assert.rejects(connected, /fixture connection denied/);
  socket.emit('error', new Error('fixture connection denied'));
  await rejection;
});
