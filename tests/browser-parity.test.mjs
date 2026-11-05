import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { test } from 'node:test';

test('parity migration detects drift, preserves browser metadata and refuses conflicting peer work', (t) => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'moo-parity-'));
  // Only remove the exact temporary directory created for this test.
  t.after(() => fs.rmSync(directory, { recursive: true, force: true }));
  const source = path.join(directory, 'firefox');
  const peer = path.join(directory, 'chrome');
  const git = (cwd, ...args) => {
    const result = spawnSync('git', args, { cwd, encoding: 'utf8' });
    assert.equal(result.status, 0, result.stderr);
  };
  for (const [root, browser] of [
    [source, 'firefox'],
    [peer, 'chrome'],
  ]) {
    fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
    fs.mkdirSync(path.join(root, 'src'));
    fs.copyFileSync(
      new URL('../scripts/sync-browsers.mjs', import.meta.url),
      path.join(root, 'scripts/sync-browsers.mjs'),
    );
    fs.writeFileSync(
      path.join(root, 'moo.config.json'),
      JSON.stringify({ defaultBrowser: browser }),
    );
    fs.writeFileSync(
      path.join(root, 'package.json'),
      JSON.stringify({ version: '1.0.0', repository: browser }),
    );
    fs.writeFileSync(path.join(root, 'src/widget.js'), 'original');
    git(root, 'init', '--quiet');
    git(root, 'add', '.');
    git(
      root,
      '-c',
      'user.name=Parity test',
      '-c',
      'user.email=parity@example.invalid',
      '-c',
      'core.hooksPath=/dev/null',
      'commit',
      '--quiet',
      '-m',
      'fixture',
    );
  }
  const run = (mode) =>
    spawnSync(process.execPath, [path.join(source, 'scripts/sync-browsers.mjs'), peer, mode], {
      encoding: 'utf8',
    });
  assert.equal(run('--check').status, 0);
  fs.writeFileSync(path.join(source, 'src/widget.js'), 'original\n');
  fs.writeFileSync(path.join(peer, 'src/widget.js'), 'original\r\n');
  assert.equal(run('--check').status, 0, 'LF and CRLF checkouts have the same code');
  fs.writeFileSync(path.join(peer, 'src/widget.js'), 'original');
  fs.writeFileSync(path.join(source, 'src/widget.js'), 'improved');
  assert.equal(run('--check').status, 1);
  assert.equal(run('--apply').status, 0);
  assert.equal(fs.readFileSync(path.join(peer, 'src/widget.js'), 'utf8'), 'improved');
  assert.equal(
    JSON.parse(fs.readFileSync(path.join(peer, 'moo.config.json'))).defaultBrowser,
    'chrome',
  );
  assert.equal(run('--check').status, 0);
  fs.writeFileSync(path.join(source, 'src/widget.js'), 'next improvement');
  fs.writeFileSync(path.join(source, 'src/new.js'), 'new file');
  const conflict = run('--apply');
  assert.equal(conflict.status, 1);
  assert.match(conflict.stderr, /uncommitted work/);
  assert.equal(
    fs.existsSync(path.join(peer, 'src/new.js')),
    false,
    'No partial writes before conflict detection',
  );
  assert.equal(fs.readFileSync(path.join(peer, 'src/widget.js'), 'utf8'), 'improved');
  git(peer, 'add', '.');
  git(
    peer,
    '-c',
    'user.name=Parity test',
    '-c',
    'user.email=parity@example.invalid',
    '-c',
    'core.hooksPath=/dev/null',
    'commit',
    '--quiet',
    '-m',
    'migration',
  );
  fs.unlinkSync(path.join(source, 'src/widget.js'));
  const deletion = run('--apply');
  assert.equal(deletion.status, 1);
  assert.match(deletion.stderr, /Remove src\/widget.js from both/);
  assert.equal(fs.existsSync(path.join(peer, 'src/widget.js')), true);
});
