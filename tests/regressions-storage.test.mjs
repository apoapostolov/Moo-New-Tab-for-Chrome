import { assert, test, backgrounds, server, importSettings } from './regression-fixture.mjs';

test('background writes commit before resolving and preserve partial metadata', async () => {
  await backgrounds.clearAllBackgrounds();
  const id = await backgrounds.addBackground({
    url: 'data:image/png;base64,AA==',
    name: 'Fixture',
    folder: 'Trips',
    blurHash: 'kept',
  });
  await backgrounds.updateBackgroundMetadata(id, { dimensions: { width: 40, height: 20 } });
  const [row] = await backgrounds.getAllBackgroundsWithMetadata();
  assert.equal(row.folder, 'Trips');
  assert.equal(row.blurHash, 'kept');
  assert.deepEqual(row.dimensions, { width: 40, height: 20 });
  await backgrounds.deleteMultipleBackgrounds([0, 0, 50]);
  assert.equal(await backgrounds.getBackgroundCount(), 0);
});

test('image migration is atomic, handles a JSON URL string and does not resurrect deletions', async () => {
  await backgrounds.clearAllBackgrounds();
  localStorage.setItem('customBackground', JSON.stringify('https://example.com/one.jpg'));
  assert.equal(await backgrounds.migrateFromLocalStorage(), true);
  assert.deepEqual(await backgrounds.getAllBackgrounds(), ['https://example.com/one.jpg']);
  await backgrounds.clearAllBackgrounds();
  assert.equal(await backgrounds.migrateFromLocalStorage(), false);
  assert.equal(await backgrounds.getBackgroundCount(), 0);
});

test('scratch migration preserves all pictures, prevents resurrection and includes them in backups', async () => {
  const image = {
    id: 'fixture-picture',
    src: 'data:image/png;base64,AA==',
    x: 1,
    y: 1,
    width: 100,
    ratio: 1,
  };
  await backgrounds.patchScratchAssets({
    removed: (await backgrounds.readScratchAssets()).map((image) => image.id),
  });
  localStorage.setItem('scratchImagesData', JSON.stringify([image]));
  await backgrounds.migrateScratchAssets();
  assert.equal(localStorage.getItem('scratchImagesData'), null);
  assert.deepEqual(await backgrounds.readScratchAssets(), [image]);
  const { createBackup } = await server.ssrLoadModule('/src/utils/settings/export.js');
  const backup = await createBackup(true);
  assert.deepEqual(backup.assets.scratchImages, [image]);
  await backgrounds.patchScratchAssets({ removed: [image.id] });
  localStorage.setItem('scratchImagesData', JSON.stringify([image]));
  await backgrounds.migrateScratchAssets();
  assert.deepEqual(await backgrounds.readScratchAssets(), []);
  await importSettings(JSON.stringify(backup));
  assert.deepEqual(await backgrounds.readScratchAssets(), [image]);
});
test('backups omit credentials, validate embedded lists and recover interrupted imports', async () => {
  const { prepareBackup } = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
  const { createBackup } = await server.ssrLoadModule('/src/utils/settings/export.js');
  const { recoverProfileChange, changeProfile } = await server.ssrLoadModule(
    '/src/utils/settings/profile.js',
  );
  localStorage.setItem('theme', 'dark');
  localStorage.setItem('googleClientSecret', 'private');
  assert.equal((await createBackup()).settings.googleClientSecret, undefined);
  assert.throws(() => prepareBackup('{"todo":"[{}]"}'));
  const legacy = await importSettings('{"theme":"light","googleClientSecret":"injected"}');
  assert.equal(legacy.legacy, true);
  assert.equal(localStorage.getItem('theme'), 'light');
  assert.equal(localStorage.getItem('googleClientSecret'), 'private');
  await backgrounds.clearAllBackgrounds();
  await backgrounds.addBackground('https://example.com/old.jpg');
  await backgrounds.beginProfileChange({ theme: 'dark' }, [{ url: 'https://example.com/new.jpg' }]);
  localStorage.setItem('theme', 'light');
  assert.equal(await recoverProfileChange(), true);
  assert.equal(localStorage.getItem('theme'), 'dark');
  assert.deepEqual(await backgrounds.getAllBackgrounds(), ['https://example.com/old.jpg']);
  const write = localStorage.setItem;
  Object.defineProperty(localStorage, 'setItem', {
    configurable: true,
    value(key, value) {
      if (key === 'quota') throw new Error('Quota');
      return write.call(this, key, value);
    },
  });
  await assert.rejects(
    changeProfile((previous) => ({ ...previous, quota: 'fail' }), []),
    /Quota/,
  );
  delete localStorage.setItem;
  assert.equal(localStorage.getItem('theme'), 'dark');
  assert.deepEqual(await backgrounds.getAllBackgrounds(), ['https://example.com/old.jpg']);
  localStorage.clear();
  await importSettings('{"theme":"dark"}');
  assert.equal(localStorage.getItem('firstRun'), 'true');
});

test('profile reset keeps personal notes and export includes pending text', async () => {
  const { resetProfile } = await server.ssrLoadModule('/src/utils/settings/profile.js');
  const { createBackup } = await server.ssrLoadModule('/src/utils/settings/export.js');
  const { durableWriter, registerDraft } = await server.ssrLoadModule(
    '/src/utils/durableWriter.js',
  );
  localStorage.setItem('notes', 'Navbar note');
  localStorage.setItem('googleClientSecret', 'keep');
  const note = [{ id: 'draft', x: 1, y: 1, text: 'Latest unsaved text' }];
  const writer = durableWriter((value) =>
    localStorage.setItem('scratchNotesData', JSON.stringify(value)),
  );
  const unregister = registerDraft('scratchNotesData', writer);
  writer.schedule(note);
  assert.deepEqual(JSON.parse((await createBackup()).settings.scratchNotesData), note);
  await resetProfile();
  assert.equal(localStorage.getItem('notes'), 'Navbar note');
  assert.equal(localStorage.getItem('googleClientSecret'), 'keep');
  assert.deepEqual(JSON.parse(localStorage.getItem('scratchNotesData')), note);
  unregister();
  writer.flush();
  await resetProfile(true);
  assert.equal(localStorage.getItem('googleClientSecret'), null);
  assert.deepEqual(await backgrounds.readScratchAssets(), []);
  assert.deepEqual(await backgrounds.getAllBackgrounds(), []);
});

test('background transactions close connections so database upgrades are not blocked', async () => {
  await backgrounds.getBackgroundCount();
  await new Promise((resolve, reject) => {
    const request = indexedDB.open('MooCustomBackgrounds', 4);
    request.onblocked = () => reject(new Error('A background operation leaked its connection'));
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      request.result.close();
      resolve();
    };
  });
});
