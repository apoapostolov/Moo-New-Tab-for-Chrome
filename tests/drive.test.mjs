import { assert, test, server } from './regression-fixture.mjs';

const drive = await server.ssrLoadModule('/src/features/google/drive/driveService.js');
const { SCOPES } = await server.ssrLoadModule('/src/features/google/auth.js');

const preferences = await server.ssrLoadModule('/src/features/google/drive/drivePreferences.js');
const { validateSettings } = await server.ssrLoadModule('/src/utils/settings/backupSchema.js');
test('Drive requires metadata access and old Google connections do not imply Drive consent', () => {
  assert(SCOPES.includes(drive.DRIVE_SCOPE));
  assert.equal(drive.hasDriveScope(null), false);
  assert.equal(
    drive.hasDriveScope({ scope: 'openid email https://www.googleapis.com/auth/tasks' }),
    false,
  );
  assert.equal(drive.hasDriveScope({ scope: `openid ${drive.DRIVE_SCOPE}` }), true);
});

test('Drive queries exclude trash, escape filename and folder literals and isolate view filters', () => {
  assert.equal(drive.driveQuery({ view: 'starred' }), 'trashed = false and starred = true');
  assert.equal(drive.driveQuery({ view: 'shared' }), 'trashed = false and sharedWithMe = true');
  assert.equal(
    drive.driveQuery({ view: 'starred', folder: 'folder', search: "O'Brien\\plan" }),
    "trashed = false and 'folder' in parents and name contains 'O\\'Brien\\\\plan'",
  );
});

test('Drive file links accept only Google HTTPS metadata links or canonical id-based links', () => {
  assert.equal(drive.driveHref({ id: '../bad' }), '');
  assert.equal(
    drive.driveHref({ id: 'doc-1', webViewLink: 'javascript:alert(1)' }),
    'https://drive.google.com/file/d/doc-1/view',
  );
  assert.equal(
    drive.driveHref({ id: 'doc-1', webViewLink: 'https://docs.google.com/document/d/doc-1/edit' }),
    'https://docs.google.com/document/d/doc-1/edit',
  );
  assert.equal(
    drive.driveHref({ id: 'folder1', mimeType: drive.DRIVE_FOLDER }),
    'https://drive.google.com/drive/folders/folder1',
  );
});

test('Drive reads metadata pages without downloading file content and forwards cancellation', async () => {
  const oldFetch = globalThis.fetch,
    oldBrowser = globalThis.browser;
  globalThis.browser = {
    storage: {
      local: {
        get: async () => ({
          googleAuth: { accessToken: 'test-token', expiresAt: Date.now() + 3600000 },
        }),
      },
    },
  };
  let request;
  globalThis.fetch = async (url, options) => {
    request = { url: new URL(url), options };
    return new Response(
      JSON.stringify({
        files: [{ id: 'doc', name: 'A file', mimeType: 'text/plain' }, { id: '../bad' }],
        nextPageToken: 'next',
      }),
    );
  };
  try {
    const result = await drive.listDriveFiles({ view: 'shared', pageToken: 'page', limit: 999 });
    assert.equal(request.url.pathname, '/drive/v3/files');
    assert.equal(request.url.searchParams.get('pageSize'), '30');
    assert.equal(request.url.searchParams.get('pageToken'), 'page');
    assert.equal(request.url.searchParams.get('q'), 'trashed = false and sharedWithMe = true');
    assert(!request.url.searchParams.has('alt'));
    assert.equal(request.options.headers.Authorization, 'Bearer test-token');
    assert.equal(result.files.length, 1);
    assert.equal(result.nextPageToken, 'next');
    const controller = new AbortController();
    controller.abort();
    await assert.rejects(drive.listDriveFiles({}, controller.signal), /abort/i);
    localStorage.setItem('offlineMode', 'true');
    await assert.rejects(drive.listDriveFiles(), /offline/);
  } finally {
    globalThis.fetch = oldFetch;
    globalThis.browser = oldBrowser;
  }
});

test('Drive remembers only supported views and validates the saved preference in Backups', () => {
  assert.equal(preferences.readDriveView(), 'recent');
  localStorage.setItem('googleDriveView', 'starred');
  assert.equal(preferences.readDriveView(), 'starred');
  assert.equal(validateSettings({ googleDriveView: 'shared' }).settings.googleDriveView, 'shared');
  assert.throws(() => validateSettings({ googleDriveView: 'unknown' }), /Drive view/);
  localStorage.setItem('googleDriveView', 'unknown');
  assert.equal(preferences.readDriveView(), 'recent');
});
test('Drive page sizing is bounded and scroll pagination recognizes only the bottom boundary', () => {
  assert.equal(preferences.drivePageSize(null), 10);
  assert.equal(preferences.drivePageSize(5), 5);
  assert.equal(preferences.drivePageSize(20), 20);
  assert.equal(preferences.drivePageSize(1000), 30);
  assert.equal(preferences.drivePageSize(-2), 5);
  assert.equal(
    preferences.atDriveBottom({ scrollTop: 0, clientHeight: 270, scrollHeight: 540 }),
    false,
  );
  assert.equal(
    preferences.atDriveBottom({ scrollTop: 270, clientHeight: 270, scrollHeight: 540 }),
    true,
  );
  assert.equal(
    preferences.atDriveBottom({ scrollTop: 0, clientHeight: 270, scrollHeight: 270 }),
    true,
  );
});
