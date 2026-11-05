import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { PassThrough } from 'node:stream';
import { test } from 'node:test';
import { Chromium } from './memory/chromium.mjs';
import { assessMemory, MiB } from './memory/metrics.mjs';

function transport() {
  const input = new PassThrough();
  const output = new PassThrough();
  const sent = [];
  input.on('data', (chunk) => sent.push(JSON.parse(chunk.toString().replace(/\0$/, ''))));
  const browser = Object.assign(new EventEmitter(), { stdio: [null, null, null, input, output] });
  return { browser, client: new Chromium(browser, 'http://127.0.0.1:1234'), sent, output };
}

test('Chrome pipe handles fragmented UTF-8, coalesced responses and flattened target sessions', async () => {
  const { client, sent, output } = transport();
  try {
    const first = client.send('Runtime.evaluate', { expression: '1' }, 'page-session');
    const second = client.send('Browser.getVersion');
    assert.equal(sent[0].sessionId, 'page-session');
    const packets = Buffer.from(
      `${JSON.stringify({ id: 2, result: { product: 'Chrome' } })}\0${JSON.stringify({ id: 1, result: { value: 'София' } })}\0`,
    );
    for (const byte of packets) output.write(Buffer.from([byte]));
    assert.deepEqual(await first, { value: 'София' });
    assert.deepEqual(await second, { product: 'Chrome' });
    assert.equal(client.pending.size, 0);
  } finally {
    client.close();
  }
});

test('Chrome protocol failures and browser exits reject pending work without leaving timers', async () => {
  const { client, browser, output } = transport();
  const failed = assert.rejects(client.send('invalid'), /invalid: bad fixture/);
  output.write(`${JSON.stringify({ id: 1, error: { message: 'bad fixture' } })}\0`);
  await failed;
  const exited = assert.rejects(client.send('pending'), /Chrome exited/);
  browser.emit('exit', 0);
  await exited;
  assert.equal(client.pending.size, 0);
  await assert.rejects(client.send('after-exit'), /pipe closed/);
});

test('Chrome page evaluation reports script exceptions rather than accepting missing measurements', async () => {
  const { client, output } = transport();
  client.targetId = 'page';
  client.sessions.set('page', 'page-session');
  const failed = assert.rejects(client.script('throw Error("fixture")'), /fixture/);
  output.write(
    `${JSON.stringify({ id: 1, result: { exceptionDetails: { exception: { description: 'fixture' } } } })}\0`,
  );
  await failed;
  client.close();
});

test('Chrome private-commit gates retain native allocation growth and reject heap-only measurements', () => {
  const samples = [100, 160, 220].map((value) => ({
    resident: 300 * MiB,
    privateBytes: value * MiB,
    jsHeap: 5 * MiB,
    settled: true,
  }));
  const result = assessMemory(samples, { growthMetric: 'privateBytes' });
  assert.equal(result.growthMiB, 120);
  assert.equal(result.errors.length, 2);
  assert.ok(
    assessMemory([{ resident: MiB, jsHeap: MiB }], { growthMetric: 'privateBytes' }).errors.some(
      (error) => error.includes('privateBytes'),
    ),
  );
  assert.deepEqual(
    assessMemory(
      samples.map((sample) => ({ ...sample, privateBytes: 100 * MiB })),
      { growthMetric: 'privateBytes' },
    ).errors,
    [],
  );
});
