import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { browsers, projectRoot } from './extension-build.mjs';

const target = process.argv[2] || 'all';
if (target !== 'all' && !browsers.includes(target)) throw new Error(`Unknown browser: ${target}`);
for (const browser of target === 'all' ? browsers : [target]) {
  const result = spawnSync(
    process.execPath,
    [fileURLToPath(new URL('../node_modules/vite/bin/vite.js', import.meta.url)), 'build'],
    {
      cwd: projectRoot,
      env: { ...process.env, MOO_BROWSER: browser },
      stdio: 'inherit',
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status || 1);
}
