import { spawnSync } from 'node:child_process';
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
