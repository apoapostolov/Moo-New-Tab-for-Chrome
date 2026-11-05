import { spawn, spawnSync } from 'node:child_process';
import { createInterface } from 'node:readline';
import os from 'node:os';
import { fileURLToPath } from 'node:url';

export function systemMemory() {
  if (process.platform !== 'win32')
    return { availablePhysical: os.freemem(), physicalTotal: os.totalmem() };
  const result = spawnSync(
    process.env.PYTHON || 'python',
    [fileURLToPath(new URL('./system-memory.py', import.meta.url))],
    { encoding: 'utf8', windowsHide: true, timeout: 3000 },
  );
  if (result.status !== 0)
    throw new Error(
      `Windows commit measurement requires Python 3: ${result.error || result.stderr}`,
    );
  return JSON.parse(result.stdout);
}

export async function monitorSystemMemory() {
  if (process.platform !== 'win32') return { read: systemMemory, close() {} };
  const child = spawn(
    process.env.PYTHON || 'python',
    [fileURLToPath(new URL('./system-memory.py', import.meta.url)), '--watch'],
    { windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] },
  );
  const lines = createInterface({ input: child.stdout });
  let latest;
  let received = 0;
  let failure;
  let errors = '';
  child.stderr.on('data', (data) => {
    errors += data;
  });
  const ready = new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('System memory sampler startup timed out')),
      10000,
    );
    const fail = (error) => {
      failure = error;
      clearTimeout(timeout);
      reject(error);
    };
    child.on('error', fail);
    child.on('exit', (code) => fail(new Error(`System memory sampler exited: ${code} ${errors}`)));
    lines.on('line', (line) => {
      try {
        latest = JSON.parse(line);
        received = Date.now();
        clearTimeout(timeout);
        resolve();
      } catch (error) {
        fail(error);
      }
    });
  });
  try {
    await ready;
  } catch (error) {
    child.kill();
    throw error;
  }
  return {
    read() {
      if (failure) throw failure;
      if (Date.now() - received > 3500) throw new Error('System memory sampler stopped reporting');
      return latest;
    },
    close() {
      lines.close();
      child.kill();
    },
  };
}

export function headroomError(memory) {
  if (!Number.isFinite(memory.availablePhysical) || memory.availablePhysical < 2 * 1024 ** 3)
    return 'Less than 2 GiB physical memory remains';
  if (
    memory.availableCommit !== undefined &&
    (!Number.isFinite(memory.availableCommit) || memory.availableCommit < 4 * 1024 ** 3)
  )
    return 'Less than 4 GiB Windows commit headroom remains';
  return null;
}
