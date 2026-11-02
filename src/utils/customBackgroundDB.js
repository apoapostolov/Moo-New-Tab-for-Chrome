import { withLock } from './requests.js';
const DB_NAME = 'MooCustomBackgrounds';
const STORE_NAME = 'backgrounds';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 3);
    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains('scratchAssets'))
        request.result.createObjectStore('scratchAssets', { keyPath: 'id' });
      if (!request.result.objectStoreNames.contains('profileJournal'))
        request.result.createObjectStore('profileJournal');
      if (request.result.objectStoreNames.contains(STORE_NAME)) return;
      const store = request.result.createObjectStore(STORE_NAME, {
        keyPath: 'id',
        autoIncrement: true,
      });
      store.createIndex('url', 'url', { unique: false });
    };
  });
}

// Resolve only after commit, and release the connection on success or failure.
async function transactUnlocked(mode, operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let result;
    let transaction;
    try {
      transaction = db.transaction(STORE_NAME, mode);
      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onabort = transaction.onerror = () => {
        db.close();
        reject(transaction.error || new Error('The image could not be saved.'));
      };
      operation(transaction.objectStore(STORE_NAME), (value) => {
        result = value;
      });
    } catch (error) {
      transaction?.abort();
      db.close();
      reject(error);
    }
  });
}

function transact(mode, operation) {
  if (mode !== 'readwrite') return transactUnlocked(mode, operation);
  const revision = localStorage.getItem('profileRevision');
  return withLock('moo-profile-write', () => {
    if (revision !== localStorage.getItem('profileRevision'))
      throw new Error('The profile changed in another tab. Reload to continue.');
    return transactUnlocked(mode, operation);
  });
}

const toRecord = (data) =>
  typeof data === 'string'
    ? { url: data, name: 'Image', uploadDate: Date.now(), folder: '' }
    : { ...data, uploadDate: data.uploadDate || Date.now() };

export async function getAllBackgroundsWithMetadata() {
  // A failed read must reject: an empty result would hide a storage failure from callers.
  return transact('readonly', (store, done) => {
    const request = store.getAll();
    request.onsuccess = () =>
      done(
        request.result.map((item) => ({
          ...item,
          name: item.name || `Image ${item.id}`,
          uploadDate: item.uploadDate || item.createdAt || 0,
        })),
      );
  });
}

export async function getAllBackgrounds() {
  return (await getAllBackgroundsWithMetadata()).map((background) => background.url);
}

// New tabs need one record. Reading the whole collection also copies every
// uploaded video's base64 payload into each tab before choosing a background.
export async function getRandomBackground(random = Math.random) {
  return transact('readonly', (store, done) => {
    const count = store.count();
    count.onsuccess = () => {
      if (!count.result) {
        done(null);
        return;
      }
      const index = Math.floor(random() * count.result);
      const keys = store.openKeyCursor();
      let advanced = false;
      keys.onsuccess = () => {
        const cursor = keys.result;
        if (!cursor) {
          done(null);
          return;
        }
        if (index && !advanced) {
          advanced = true;
          cursor.advance(index);
          return;
        }
        const request = store.get(cursor.primaryKey);
        request.onsuccess = () => done(request.result);
      };
    };
  });
}

export async function addBackground(data) {
  return transact('readwrite', (store, done) => {
    const request = store.add(toRecord(data));
    request.onsuccess = () => done(request.result);
  });
}

export async function updateBackground(index, data) {
  return transact('readwrite', (store) => {
    const request = store.getAll();
    request.onsuccess = () => {
      const item = request.result[index];
      if (item) {
        store.put({
          ...item,
          ...(typeof data === 'string' ? { url: data } : data),
          updatedAt: Date.now(),
        });
      } else {
        store.add(toRecord(data));
      }
    };
  });
}

export async function deleteBackground(index) {
  return deleteMultipleBackgrounds([index]);
}

export async function deleteMultipleBackgrounds(indices) {
  return transact('readwrite', (store) => {
    const request = store.getAll();
    request.onsuccess = () => {
      for (const index of new Set(indices)) {
        if (request.result[index]) store.delete(request.result[index].id);
      }
    };
  });
}

export async function clearAllBackgrounds() {
  return transact('readwrite', (store) => {
    store.clear();
  });
}

export async function getBackgroundCount() {
  return transact('readonly', (store, done) => {
    const request = store.count();
    request.onsuccess = () => done(request.result);
  });
}

export async function updateBackgroundMetadata(id, metadata) {
  return transact('readwrite', (store) => {
    // Read and write in the same transaction, so concurrent metadata edits keep both changes.
    const request = store.get(id);
    request.onsuccess = () => {
      if (request.result) store.put({ ...request.result, ...metadata, id, updatedAt: Date.now() });
      else store.transaction.abort();
    };
  });
}

export async function migrateFromLocalStorage() {
  if (localStorage.getItem('customBackgroundMigrated') === 'true') return false;
  const stored = localStorage.getItem('customBackground');
  if (!stored || stored === 'null') return false;

  let backgrounds;
  try {
    const parsed = JSON.parse(stored);
    backgrounds = Array.isArray(parsed) ? parsed : [parsed];
  } catch {
    backgrounds = [stored];
  }
  backgrounds = backgrounds.filter((url) => typeof url === 'string' && url.trim());
  if (!backgrounds.length || (await getBackgroundCount())) return false;

  // One transaction avoids a partially migrated collection after a failed write.
  await transact('readwrite', (store) => {
    for (const url of backgrounds) store.add(toRecord(url));
  });
  localStorage.setItem('customBackgroundMigrated', 'true');
  return true;
}

async function journalTransaction(operation) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME, 'profileJournal', 'scratchAssets'], 'readwrite');
    let result;
    tx.oncomplete = () => {
      db.close();
      resolve(result);
    };
    tx.onabort = tx.onerror = () => {
      db.close();
      reject(tx.error || new Error('The backup could not be saved.'));
    };
    try {
      operation(
        tx.objectStore(STORE_NAME),
        tx.objectStore('profileJournal'),
        (value) => {
          result = value;
        },
        tx.objectStore('scratchAssets'),
      );
    } catch (error) {
      tx.abort();
      reject(error);
    }
  });
}
export function beginProfileChange(storage, backgrounds, scratchImages) {
  return journalTransaction((assets, journal, _done, scratch) => {
    const request = assets.getAll();
    request.onsuccess = () => {
      const read = scratch.getAll();
      read.onsuccess = () => {
        journal.put(
          { storage, backgrounds: request.result, scratchImages: read.result },
          'pending',
        );
        if (backgrounds !== undefined) {
          assets.clear();
          for (const item of backgrounds) {
            const record = { ...item };
            delete record.id;
            assets.add(record);
          }
        }
        if (scratchImages !== undefined) {
          scratch.clear();
          for (const image of scratchImages) scratch.put(image);
        }
      };
    };
  });
}
export function finishProfileChange() {
  return journalTransaction((_assets, journal) => journal.delete('pending'));
}
export function readProfileChange() {
  return journalTransaction((_assets, journal, done) => {
    const request = journal.get('pending');
    request.onsuccess = () => done(request.result);
  });
}
export function rollbackProfileAssets() {
  return journalTransaction((assets, journal, _done, scratch) => {
    const request = journal.get('pending');
    request.onsuccess = () => {
      if (!request.result) return;
      assets.clear();
      for (const item of request.result.backgrounds) assets.put(item);
      if (request.result.scratchImages) {
        scratch.clear();
        for (const image of request.result.scratchImages) scratch.put(image);
      }
      journal.delete('pending');
    };
  });
}

export function readScratchAssets() {
  return journalTransaction((_assets, _journal, done, scratch) => {
    const request = scratch.getAll();
    request.onsuccess = () => done(request.result);
  });
}
export function patchScratchAssets({ upserts = [], removed = [] }) {
  return journalTransaction((_assets, _journal, done, scratch) => {
    for (const id of removed) scratch.delete(id);
    for (const image of upserts) scratch.put(image);
    const request = scratch.getAll();
    request.onsuccess = () => done(request.result);
  });
}
export async function migrateScratchAssets() {
  const original = localStorage.getItem('scratchImagesData');
  let images = [];
  if (original) {
    images = JSON.parse(original);
    if (
      !Array.isArray(images) ||
      images.some(
        (image) => !image || typeof image.id !== 'string' || typeof image.src !== 'string',
      )
    )
      throw new Error('The saved Floating Images need repair. Their original data has been kept.');
  }
  await journalTransaction((_assets, journal, _done, scratch) => {
    const request = journal.get('scratchMigration');
    request.onsuccess = () => {
      if (request.result) return;
      for (const image of images) scratch.put(image);
      journal.put(true, 'scratchMigration');
    };
  });
  if (original && localStorage.getItem('scratchImagesData') === original)
    localStorage.removeItem('scratchImagesData');
}
