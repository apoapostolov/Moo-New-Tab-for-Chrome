import assert from 'node:assert/strict';
import { test } from 'node:test';
import { IDBObjectStore } from 'fake-indexeddb';
import 'fake-indexeddb/auto';
import {
  addBackground,
  clearAllBackgrounds,
  deleteMultipleBackgrounds,
  getRandomBackground,
} from '../src/utils/customBackgroundDB.js';
import { headroomError } from './memory/system-memory.mjs';

globalThis.localStorage = { getItem: () => null };

test('new-tab background selection materializes one payload without reading the collection', async () => {
  await clearAllBackgrounds();
  for (let i = 0; i < 8; i++)
    await addBackground({
      url: `data:video/mp4;base64,${'A'.repeat(128 * 1024)}`,
      name: `clip-${i}`,
    });
  const originalGetAll = IDBObjectStore.prototype.getAll;
  const originalGet = IDBObjectStore.prototype.get;
  let reads = 0;
  IDBObjectStore.prototype.getAll = () => {
    throw new Error('New tabs must not load all video payloads');
  };
  IDBObjectStore.prototype.get = function (...args) {
    reads++;
    return originalGet.apply(this, args);
  };
  try {
    for (const [random, name] of [
      [0, 'clip-0'],
      [0.5, 'clip-4'],
      [0.999, 'clip-7'],
    ]) {
      reads = 0;
      const record = await getRandomBackground(() => random);
      assert.equal(record.name, name);
      assert.equal(reads, 1, 'only the selected record should be deserialized');
    }
  } finally {
    IDBObjectStore.prototype.getAll = originalGetAll;
    IDBObjectStore.prototype.get = originalGet;
    await clearAllBackgrounds();
  }
});

test('random key selection handles an empty collection and gaps from deletions', async () => {
  await clearAllBackgrounds();
  assert.equal(await getRandomBackground(), null);
  await addBackground({ url: '/first.mp4', name: 'first' });
  await addBackground({ url: '/deleted.mp4', name: 'deleted' });
  await addBackground({ url: '/last.mp4', name: 'last' });
  await deleteMultipleBackgrounds([1]);
  assert.equal((await getRandomBackground(() => 0)).name, 'first');
  assert.equal((await getRandomBackground(() => 0.999)).name, 'last');
  await clearAllBackgrounds();
});

test('stress safety gate stops on physical or commit exhaustion', () => {
  const GiB = 1024 ** 3;
  assert.equal(headroomError({ availablePhysical: 8 * GiB, availableCommit: 12 * GiB }), null);
  assert.match(headroomError({ availablePhysical: GiB, availableCommit: 12 * GiB }), /physical/);
  assert.match(headroomError({ availablePhysical: 8 * GiB, availableCommit: 3 * GiB }), /commit/);
  assert.match(headroomError({ availablePhysical: NaN }), /physical/);
  assert.match(headroomError({ availablePhysical: 8 * GiB, availableCommit: NaN }), /commit/);
});
