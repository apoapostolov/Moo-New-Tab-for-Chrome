const fs = require('node:fs');
const assert = require('node:assert/strict');
const Zip = require('adm-zip');
const pkg = require('../package.json');
const manifest = JSON.parse(fs.readFileSync('build/chrome/manifest.json', 'utf8'));
const zip = new Zip(`build/chrome-${pkg.version}.zip`);
const entries = new Set(zip.getEntries().map((entry) => entry.entryName));
assert.equal(manifest.version, pkg.version, 'Package and manifest versions differ');
assert.equal(manifest.manifest_version, 3);
assert.equal(manifest.background.service_worker, 'service-worker.js');
assert(!manifest.background.scripts, 'Chrome cannot use background.scripts');
assert(!manifest.browser_specific_settings, 'Firefox metadata must not ship in Chrome');
for (const file of [
  manifest.chrome_url_overrides.newtab,
  ...Object.values(manifest.icons),
  manifest.background.service_worker,
  'background.js',
  'calendar-alerts.js',
  'LICENSE',
])
  assert(entries.has(file), `Missing extension file: ${file}`);
const html = zip.readAsText(manifest.chrome_url_overrides.newtab);
for (const [, asset] of html.matchAll(/(?:src|href)="([^"#]+\.(?:js|css))"/g))
  assert(entries.has(asset.replace(/^\//, '')), `Missing bundle: ${asset}`);
assert.deepEqual(JSON.parse(zip.readAsText('manifest.json')), manifest);
for (const [name, message] of Object.entries(
  JSON.parse(zip.readAsText('_locales/en/messages.json')),
))
  assert(message.message, `Empty locale message: ${name}`);
console.log(`Validated Chrome ${manifest.version}: ${entries.size} files`);
