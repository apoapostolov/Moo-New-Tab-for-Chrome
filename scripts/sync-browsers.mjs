import { createHash } from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const peerArg = args.find((arg) => !arg.startsWith('--'));
if (args.some((arg) => arg.startsWith('--') && !['--check', '--apply'].includes(arg)))
  throw new Error('Usage: node scripts/sync-browsers.mjs [peer-directory] [--check|--apply]');
if (args.includes('--check') && apply) throw new Error('Choose --check or --apply');
const config = JSON.parse(fs.readFileSync(path.join(root, 'moo.config.json'), 'utf8'));
const peer = path.resolve(
  peerArg ||
    path.join(root, '..', config.defaultBrowser === 'chrome' ? 'Moo' : 'Moo-New-Tab-for-Chrome'),
);
if (fs.realpathSync(root) === fs.realpathSync(peer))
  throw new Error('Choose the other browser repository');
const peerConfig = JSON.parse(fs.readFileSync(path.join(peer, 'moo.config.json'), 'utf8'));
if (
  !['chrome', 'firefox'].includes(peerConfig.defaultBrowser) ||
  peerConfig.defaultBrowser === config.defaultBrowser
)
  throw new Error('Peer must be the other Moo browser repository');

const sharedRoots = ['src/', 'manifest/', 'scripts/', 'tests/', 'assets/', 'docs/'];
const sharedFiles = new Set([
  'AGENTS.md',
  'package.json',
  'bun.lock',
  'vite.config.mjs',
  'index.html',
  'jsconfig.json',
  'eslint.config.js',
  '.gitignore',
  '.prettierrc.json',
  '.stylelintrc.json',
  '.editorconfig',
  '.nvmrc',
  'LICENSE',
  'CONTRIBUTING.md',
  '.github/workflows/ci.yml',
]);
const shared = (file) =>
  sharedFiles.has(file) ||
  (sharedRoots.some((prefix) => file.startsWith(prefix)) &&
    !['docs/RELEASE-NOTES.md', 'docs/RELEASE_PROCESS.md'].includes(file));
const files = (directory) =>
  execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'], {
    cwd: directory,
    encoding: 'utf8',
  })
    .split('\0')
    .filter((file) => file && shared(file));
const digest = (directory, file) => {
  const full = path.join(directory, file);
  if (!fs.existsSync(full)) return null;
  if (fs.lstatSync(full).isSymbolicLink())
    throw new Error(`Shared files must not be symlinks: ${file}`);
  let contents = fs.readFileSync(full);
  if (file === 'package.json') {
    const pkg = JSON.parse(contents);
    for (const key of ['repository', 'homepage', 'bugs']) delete pkg[key];
    contents = JSON.stringify(pkg);
  }
  return createHash('sha256').update(contents).digest('hex');
};
const differences = [...new Set([...files(root), ...files(peer)])]
  .sort()
  .filter((file) => digest(root, file) !== digest(peer, file));
if (!differences.length) {
  console.log('Firefox and Chrome shared files match.');
} else if (!apply) {
  console.error(`Shared files differ from ${peer}:\n${differences.join('\n')}`);
  process.exitCode = 1;
} else {
  // Complete every check before writing. Never overwrite work already edited in the peer.
  for (const file of differences) {
    if (!fs.existsSync(path.join(root, file)))
      throw new Error(`Remove ${file} from both repositories explicitly`);
    const status = execFileSync('git', ['status', '--porcelain', '--', file], {
      cwd: peer,
      encoding: 'utf8',
    });
    if (status.trim())
      throw new Error(`Peer has uncommitted work in ${file}; merge it manually first`);
    const destination = path.resolve(peer, file);
    if (!destination.startsWith(`${peer}${path.sep}`)) throw new Error('Shared path escapes peer');
    let parent = path.dirname(destination);
    while (parent !== peer) {
      if (fs.existsSync(parent) && fs.lstatSync(parent).isSymbolicLink())
        throw new Error(`Peer directory is a symlink: ${parent}`);
      parent = path.dirname(parent);
    }
  }
  for (const file of differences) {
    fs.mkdirSync(path.dirname(path.join(peer, file)), { recursive: true });
    if (file === 'package.json') {
      const pkg = JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));
      const previous = JSON.parse(fs.readFileSync(path.join(peer, file), 'utf8'));
      for (const key of ['repository', 'homepage', 'bugs']) pkg[key] = previous[key];
      fs.writeFileSync(path.join(peer, file), `${JSON.stringify(pkg, null, 2)}\n`);
    } else fs.copyFileSync(path.join(root, file), path.join(peer, file));
  }
  console.log(
    `Copied ${differences.length} shared files to ${peer}. Review and test both repositories.`,
  );
}
