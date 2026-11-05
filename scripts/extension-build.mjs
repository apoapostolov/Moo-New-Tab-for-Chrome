import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import ADMZip from 'adm-zip';

export const projectRoot = fileURLToPath(new URL('../', import.meta.url));
export const browsers = ['firefox', 'chrome'];

export function extensionManifest(browser, root = projectRoot) {
  if (!browsers.includes(browser)) throw new Error(`Unknown browser: ${browser}`);
  const manifest = JSON.parse(fs.readFileSync(path.join(root, 'manifest/firefox.json'), 'utf8'));
  const pkg = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
  manifest.version = pkg.version;
  if (browser === 'chrome') {
    delete manifest.browser_specific_settings;
    manifest.background = { service_worker: 'service-worker.js' };
    manifest.minimum_chrome_version = '120';
    manifest.description = manifest.description.replace('Firefox', 'Chrome');
    manifest.homepage_url = manifest.homepage_url.replace('Firefox', 'Chrome');
  }
  return manifest;
}

export function packageExtension(browser, root = projectRoot) {
  const manifest = extensionManifest(browser, root);
  const buildRoot = path.resolve(root, 'build');
  const destination = path.resolve(buildRoot, browser);
  // Resolve and verify the output before removing any previous build contents.
  if (path.dirname(destination) !== buildRoot || !browsers.includes(path.basename(destination)))
    throw new Error('Extension output must stay inside the project build directory');
  fs.mkdirSync(destination, { recursive: true });
  for (const entry of fs.readdirSync(destination))
    fs.rmSync(path.join(destination, entry), { recursive: true, force: true });
  fs.cpSync(path.join(root, 'dist'), destination, { recursive: true });
  fs.cpSync(path.join(root, 'src/assets'), path.join(destination, 'src/assets'), {
    recursive: true,
  });
  fs.cpSync(path.join(root, 'src/assets/icons'), path.join(destination, 'icons'), {
    recursive: true,
  });
  fs.cpSync(path.join(root, 'manifest/_locales'), path.join(destination, '_locales'), {
    recursive: true,
  });
  for (const file of [
    'background.js',
    'calendar-alerts.js',
    ...(browser === 'chrome' ? ['service-worker.js'] : []),
  ])
    fs.copyFileSync(path.join(root, 'manifest', file), path.join(destination, file));
  fs.copyFileSync(path.join(root, 'LICENSE'), path.join(destination, 'LICENSE'));
  fs.writeFileSync(
    path.join(destination, 'manifest.json'),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  const archive = path.join(buildRoot, `${browser}-${manifest.version}.zip`);
  const zip = new ADMZip();
  zip.addLocalFolder(destination);
  zip.writeZip(archive);
  console.log(`Packaged ${browser}: ${archive}`);
}
