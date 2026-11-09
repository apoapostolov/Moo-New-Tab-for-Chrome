import { assert, test, server, calendar, getAccessToken } from './regression-fixture.mjs';

test('simultaneous expired Google tokens share one refresh request', async () => {
  const auth = { refreshToken: 'fixture', accessToken: 'old', expiresAt: 0 };
  globalThis.browser = {
    storage: {
      local: {
        get: async () => ({ googleAuth: auth }),
        set: async (data) => Object.assign(auth, data.googleAuth),
      },
    },
  };
  localStorage.setItem('googleClientId', 'fixture');
  localStorage.setItem('googleClientSecret', 'fixture');
  const previous = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = async () => {
    requests++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return { ok: true, json: async () => ({ access_token: 'new', expires_in: 3600 }) };
  };
  try {
    assert.deepEqual(await Promise.all([getAccessToken(), getAccessToken(), getAccessToken()]), [
      'new',
      'new',
      'new',
    ]);
    assert.equal(requests, 1);
  } finally {
    globalThis.fetch = previous;
    delete globalThis.browser;
  }
});

test('sign-out during refresh cannot save a replacement token', async () => {
  const { refresh, disconnect } = await server.ssrLoadModule('/src/features/google/auth.js');
  let auth = { refreshToken: 'fixture', accessToken: 'old', expiresAt: 0 };
  let saves = 0;
  let release;
  let started;
  const began = new Promise((resolve) => {
    started = resolve;
  });
  const previous = globalThis.fetch;
  globalThis.browser = {
    storage: {
      local: {
        get: async () => ({ googleAuth: auth }),
        set: async (value) => {
          saves++;
          auth = value.googleAuth;
        },
        remove: async () => {
          auth = null;
        },
      },
    },
  };
  globalThis.fetch = async (url) => {
    if (url.includes('/revoke')) return { ok: true };
    started();
    await new Promise((resolve) => {
      release = resolve;
    });
    return { ok: true, json: async () => ({ access_token: 'late', expires_in: 3600 }) };
  };
  try {
    const refreshing = refresh();
    const rejection = assert.rejects(refreshing);
    await began;
    const signingOut = disconnect();
    release();
    await Promise.all([rejection, signingOut]);
    assert.equal(auth, null);
    assert.equal(saves, 0);
  } finally {
    globalThis.fetch = previous;
    delete globalThis.browser;
  }
});

test('obsolete request owners and offline requests cannot commit', async () => {
  const { requestOwner, fetchWithTimeout, withLock } =
    await server.ssrLoadModule('/src/utils/requests.js');
  const owner = requestOwner();
  const first = owner.start();
  const second = owner.start();
  assert.equal(first.signal.aborted, true);
  assert.equal(first.current(), false);
  assert.equal(second.current(), true);
  owner.cancel();
  assert.equal(second.current(), false);
  localStorage.setItem('offlineMode', 'true');
  await assert.rejects(fetchWithTimeout('https://example.com'), /offline/);
  const result = [];
  await Promise.all([
    withLock('fixture', async () => {
      result.push(1);
      await Promise.resolve();
      result.push(2);
    }),
    withLock('fixture', () => result.push(3)),
  ]);
  assert.deepEqual(result, [1, 2, 3]);
});

test('Google list pagination retains permissions and distinct calendar identities', async () => {
  const previous = globalThis.fetch;
  globalThis.browser = {
    storage: {
      local: {
        get: async () => ({
          googleAuth: { accessToken: 'fixture', expiresAt: Date.now() + 3600000 },
        }),
      },
    },
  };
  globalThis.fetch = async (address) => {
    const url = new URL(address);
    let data;
    if (url.pathname.endsWith('/calendarList'))
      data = url.searchParams.has('pageToken')
        ? { items: [{ id: 'two', summary: 'Shared', accessRole: 'reader' }] }
        : { items: [{ id: 'one', summary: 'Mine', accessRole: 'owner' }], nextPageToken: 'next' };
    else if (url.pathname.endsWith('/events'))
      data = {
        items: [
          {
            id: 'same-id',
            summary: 'Fixture',
            start: { date: '2026-10-26' },
            end: { date: '2026-10-27' },
          },
        ],
      };
    else
      data = url.searchParams.has('pageToken')
        ? { items: [{ id: 'b', title: 'Second' }] }
        : { items: [{ id: 'a', title: 'First' }], nextPageToken: 'next' };
    return { ok: true, status: 200, text: async () => JSON.stringify(data) };
  };
  try {
    const calendars = await calendar.listCalendars();
    assert.equal(calendars.length, 2);
    const events = await calendar.listEvents({
      ...calendar.rangeBounds(),
      calendarIds: ['one', 'two'],
      calendars,
      includeDeclined: true,
    });
    assert.equal(new Set(events.map(calendar.eventKey)).size, 2);
    assert.equal(events.find((event) => event.calendarId === 'one').canEdit, true);
    assert.equal(events.find((event) => event.calendarId === 'two').canEdit, false);
    const tasks = await server.ssrLoadModule('/src/features/google/services/tasks.js');
    assert.equal((await tasks.listTaskLists()).length, 2);
    assert.equal((await tasks.listTasks('a')).length, 2);
    globalThis.fetch = async () => ({
      ok: false,
      status: 403,
      text: async () => JSON.stringify({ error: { message: 'Read only' } }),
    });
    await assert.rejects(
      calendar.updateEvent('same-id', {
        title: 'Changed',
        start: '2026-10-26',
        end: '2026-10-26',
        allDay: true,
      }),
      /Read only/,
    );
  } finally {
    globalThis.fetch = previous;
    delete globalThis.browser;
  }
});
