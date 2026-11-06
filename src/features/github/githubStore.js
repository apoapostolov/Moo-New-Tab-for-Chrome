import { fetchWithTimeout, withLock, online } from 'utils/requests';

export const GITHUB_SETTINGS = /^(github|offlineMode$)/;
export const VIEWS = ['reviews', 'pulls', 'issues', 'actions'];
const GITHUB_TITLE_DESTINATIONS = [
  'home',
  'notifications',
  'pulls',
  'issues',
  'explore',
  'profile',
  'repositories',
];
const notificationListeners = new Set();
const notifyGitHubNotifications = () => notificationListeners.forEach((listener) => listener());
export function githubNotificationsSnapshot() {
  try {
    return localStorage.getItem('githubNewItems') || '{}';
  } catch {
    return '{}';
  }
}
export function subscribeGitHubNotifications(listener) {
  notificationListeners.add(listener);
  if (typeof window !== 'undefined') window.addEventListener('storage', listener);
  return () => {
    notificationListeners.delete(listener);
    if (typeof window !== 'undefined') window.removeEventListener('storage', listener);
  };
}
export const validLogin = (value) => /^[a-z\d](?:[a-z\d-]{0,37}[a-z\d])?$/i.test(value);
export const validRepository = (value) =>
  /^[a-z\d][a-z\d-]*\/[a-z\d_.-]+$/i.test(value) && value.length <= 200 && !value.endsWith('/..');
export const repositories = (value) => [
  ...new Set(
    value
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean),
  ),
];
export const githubLink = (value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' &&
      url.hostname === 'github.com' &&
      !url.username &&
      !url.password
      ? url.href
      : null;
  } catch {
    return null;
  }
};
export function githubSettings() {
  return {
    token: (localStorage.getItem('githubToken') || '').trim(),
    username: (localStorage.getItem('githubUsername') || '').trim(),
    repos: repositories(localStorage.getItem('githubRepositories') || '')
      .filter(validRepository)
      .slice(0, 10),
    organization: (localStorage.getItem('githubOrganization') || '').trim(),
    query: (localStorage.getItem('githubExtraQuery') || '').trim().slice(0, 1000),
    state: ['closed', 'all'].includes(localStorage.getItem('githubState'))
      ? localStorage.getItem('githubState')
      : 'open',
    sort: ['created', 'comments'].includes(localStorage.getItem('githubSort'))
      ? localStorage.getItem('githubSort')
      : 'updated',
    limit: Math.max(3, Math.min(20, Number(localStorage.getItem('githubLimit')) || 6)),
    refresh: Math.max(5, Math.min(60, Number(localStorage.getItem('githubRefresh')) || 15)),
    drafts: localStorage.getItem('githubIncludeDrafts') === 'true',
    branch: (localStorage.getItem('githubActionsBranch') || '').trim(),
    actionStatus: ['all', 'in_progress'].includes(localStorage.getItem('githubActionsStatus'))
      ? localStorage.getItem('githubActionsStatus')
      : 'failure',
    views: VIEWS.filter(
      (view) =>
        localStorage.getItem(`githubShow${view[0].toUpperCase()}${view.slice(1)}`) !== 'false',
    ),
  };
}

export function githubTitleUrl(username = '') {
  const destination = GITHUB_TITLE_DESTINATIONS.includes(
    localStorage.getItem('githubTitleDestination'),
  )
    ? localStorage.getItem('githubTitleDestination')
    : 'home';
  const login = validLogin(username) ? username : '';

  switch (destination) {
    case 'notifications':
      return 'https://github.com/notifications';
    case 'pulls':
      return 'https://github.com/pulls';
    case 'issues':
      return 'https://github.com/issues';
    case 'explore':
      return 'https://github.com/explore';
    case 'profile':
      return login ? `https://github.com/${login}` : 'https://github.com/';
    case 'repositories':
      return login ? `https://github.com/${login}?tab=repositories` : 'https://github.com/';
    case 'home':
    default:
      return 'https://github.com/';
  }
}
async function identity(settings) {
  const hash = settings.token
    ? Array.from(
        new Uint8Array(
          await crypto.subtle.digest('SHA-256', new TextEncoder().encode(settings.token)),
        ),
      )
        .slice(0, 12)
        .map((value) => value.toString(16).padStart(2, '0'))
        .join('')
    : '';
  return JSON.stringify({ ...settings, token: hash });
}
const errorCode = (message, retryAt) => Object.assign(new Error(message), { retryAt });
async function request(path, settings, signal) {
  const response = await fetchWithTimeout(`https://api.github.com${path}`, {
    signal,
    headers: {
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2026-03-10',
      ...(settings.token ? { Authorization: `Bearer ${settings.token}` } : {}),
    },
  });
  if (!response.ok) {
    if (response.status === 401) throw errorCode('auth');
    const errorBody = response.status === 403 ? await response.json().catch(() => ({})) : {};
    if (
      response.status === 429 ||
      (response.status === 403 &&
        (response.headers.get('X-RateLimit-Remaining') === '0' ||
          response.headers.has('Retry-After') ||
          /rate limit|abuse detection/i.test(errorBody.message || '')))
    ) {
      const retryAt = Math.max(
        Date.now() + 60000,
        Number(response.headers.get('X-RateLimit-Reset')) * 1000 || 0,
        Date.now() + (Number(response.headers.get('Retry-After')) || 0) * 1000,
      );
      throw errorCode('rate', retryAt);
    }
    throw errorCode(
      response.status === 403
        ? 'permission'
        : response.status === 404
          ? 'not-found'
          : response.status === 422
            ? 'query'
            : 'network',
    );
  }
  return {
    body: await response.json(),
    remaining: response.headers.get('X-RateLimit-Remaining'),
    reset: Number(response.headers.get('X-RateLimit-Reset')) * 1000 || null,
  };
}
export function githubQuery(view, settings, username) {
  const type = view === 'issues' ? 'is:issue' : 'is:pr';
  const owner =
    view === 'reviews'
      ? `review-requested:${username}`
      : view === 'pulls'
        ? `author:${username}`
        : `assignee:${username}`;
  return [
    type,
    owner,
    view === 'reviews' || settings.state === 'open'
      ? 'is:open'
      : settings.state === 'closed'
        ? 'is:closed'
        : '',
    view !== 'issues' && !settings.drafts ? 'draft:false' : '',
    ...settings.repos.map((repo) => `repo:${repo}`),
    settings.organization && validLogin(settings.organization)
      ? `org:${settings.organization}`
      : '',
    settings.query,
  ]
    .filter(Boolean)
    .join(' ');
}
const issueRow = (item) => {
  const url = githubLink(item.html_url);
  if (!url || typeof item.title !== 'string' || !Number.isInteger(item.number)) return null;
  return {
    id: String(item.id),
    title: item.title.slice(0, 1000),
    url,
    number: item.number,
    repository: url.split('/').slice(3, 5).join('/'),
    updated: Date.parse(item.updated_at) || null,
    draft: Boolean(item.draft),
    kind: item.pull_request || /\/pull\//.test(url) ? 'pull' : 'issue',
    state: item.pull_request?.merged_at ? 'merged' : item.state === 'closed' ? 'closed' : 'open',
    reason: ['completed', 'not_planned', 'duplicate', 'reopened'].includes(item.state_reason)
      ? item.state_reason
      : null,
    body: typeof item.body === 'string' ? item.body : item.body === null ? '' : null,
    author: typeof item.user?.login === 'string' ? item.user.login.slice(0, 100) : '',
    comments: Number.isSafeInteger(item.comments) && item.comments >= 0 ? item.comments : 0,
    created: Date.parse(item.created_at) || null,
    labels: (Array.isArray(item.labels) ? item.labels : [])
      .flatMap((label) =>
        typeof label === 'string'
          ? [{ name: label.slice(0, 100), color: null }]
          : typeof label?.name === 'string'
            ? [
                {
                  name: label.name.slice(0, 100),
                  color: /^[\da-f]{6}$/i.test(label.color) ? label.color : null,
                },
              ]
            : [],
      )
      .slice(0, 100),
    assignees: (Array.isArray(item.assignees) ? item.assignees : [])
      .flatMap((person) => (typeof person?.login === 'string' ? [person.login.slice(0, 100)] : []))
      .slice(0, 100),
  };
};
async function search(view, settings, username, signal) {
  const query = new URLSearchParams({
    q: githubQuery(view, settings, username),
    sort: settings.sort,
    order: 'desc',
    per_page: String(settings.limit),
  });
  const result = await request(`/search/issues?${query}`, settings, signal);
  if (!Array.isArray(result.body.items) || !Number.isFinite(result.body.total_count))
    throw errorCode('network');
  return {
    items: result.body.items.map(issueRow).filter(Boolean),
    total: result.body.total_count,
    incomplete: Boolean(result.body.incomplete_results),
    remaining: result.remaining,
    reset: result.reset,
  };
}
async function actions(settings, signal) {
  const results = await Promise.allSettled(
    settings.repos.map(async (repo) => {
      const query = new URLSearchParams({
        per_page: String(settings.limit),
        ...(settings.actionStatus !== 'all' ? { status: settings.actionStatus } : {}),
        ...(settings.branch ? { branch: settings.branch } : {}),
      });
      const result = await request(
        `/repos/${repo.split('/').map(encodeURIComponent).join('/')}/actions/runs?${query}`,
        settings,
        signal,
      );
      if (!Array.isArray(result.body.workflow_runs)) throw errorCode('network');
      return { ...result, repo };
    }),
  );
  const failed = results
    .filter((result) => result.status === 'rejected')
    .map((result) => result.reason);
  if (failed.some((error) => error.message === 'auth')) throw errorCode('auth');
  const successful = results
    .filter((result) => result.status === 'fulfilled')
    .map((result) => result.value);
  if (!successful.length && failed.length) throw failed[0];
  const items = successful.flatMap(({ body, repo }) =>
    body.workflow_runs
      .map((run) => ({
        id: String(run.id),
        title: String(run.display_title || run.name || repo).slice(0, 1000),
        url: githubLink(run.html_url),
        repository: repo,
        branch: String(run.head_branch || ''),
        state: String(run.conclusion || run.status || ''),
        updated: Date.parse(run.updated_at) || null,
        number: run.run_number || null,
        kind: 'action',
        author: typeof run.actor?.login === 'string' ? run.actor.login.slice(0, 100) : '',
        commit: typeof run.head_commit?.message === 'string' ? run.head_commit.message : '',
        sha: /^[\da-f]{7,40}$/i.test(run.head_sha) ? run.head_sha : '',
        event: String(run.event || '').slice(0, 100),
        created: Date.parse(run.created_at) || null,
      }))
      .filter((run) => run.url),
  );
  items.sort((a, b) => (b.updated || 0) - (a.updated || 0));
  return {
    items: items.slice(0, settings.limit),
    total: successful.reduce((sum, result) => sum + (result.body.total_count || 0), 0),
    incomplete: failed.length > 0,
    failedRepos: failed.length,
    retryAt: Math.max(0, ...failed.map((error) => error.retryAt || 0)),
    needsRepos: !settings.repos.length,
    remaining:
      successful
        .map((result) => result.remaining)
        .filter((value) => value !== null)
        .sort((a, b) => Number(a) - Number(b))[0] ?? null,
  };
}
function readCache(stamp) {
  try {
    const data = JSON.parse(localStorage.getItem('githubCache') || 'null');
    return data?.identity === stamp &&
      Number.isFinite(data.updated) &&
      Number.isFinite(new Date(data.updated).getTime()) &&
      typeof data.username === 'string' &&
      data.views &&
      VIEWS.every(
        (view) =>
          !data.views[view] ||
          (Number.isFinite(data.views[view].total) &&
            Array.isArray(data.views[view].items) &&
            data.views[view].items.length <= 20 &&
            data.views[view].items.every(
              (item) =>
                typeof item.title === 'string' &&
                typeof item.repository === 'string' &&
                validRepository(item.repository) &&
                (item.branch === undefined || typeof item.branch === 'string') &&
                (item.kind === undefined || ['pull', 'issue', 'action'].includes(item.kind)) &&
                (item.draft === undefined || typeof item.draft === 'boolean') &&
                (item.body == null || typeof item.body === 'string') &&
                (item.labels === undefined ||
                  (Array.isArray(item.labels) &&
                    item.labels.length <= 100 &&
                    item.labels.every(
                      (label) =>
                        typeof label?.name === 'string' &&
                        (label.color === null || /^[\da-f]{6}$/i.test(label.color)),
                    ))) &&
                (item.assignees === undefined ||
                  (Array.isArray(item.assignees) &&
                    item.assignees.length <= 100 &&
                    item.assignees.every((person) => typeof person === 'string'))) &&
                (item.author === undefined || typeof item.author === 'string') &&
                (item.commit === undefined || typeof item.commit === 'string') &&
                (item.sha === undefined || typeof item.sha === 'string') &&
                (item.event === undefined || typeof item.event === 'string') &&
                (item.comments === undefined ||
                  (Number.isSafeInteger(item.comments) && item.comments >= 0)) &&
                (item.created == null ||
                  (typeof item.created === 'number' &&
                    Number.isFinite(new Date(item.created).getTime()))) &&
                (item.updated === null ||
                  (typeof item.updated === 'number' &&
                    Number.isFinite(new Date(item.updated).getTime()))) &&
                githubLink(item.url),
            )),
      )
      ? data
      : null;
  } catch {
    return null;
  }
}

export function githubNewItems(snapshot = githubNotificationsSnapshot()) {
  try {
    const value = JSON.parse(snapshot);
    return Object.fromEntries(
      VIEWS.map((view) => [
        view,
        Array.isArray(value?.[view])
          ? [...new Set(value[view].filter((id) => typeof id === 'string'))].slice(0, 99)
          : [],
      ]),
    );
  } catch {
    return Object.fromEntries(VIEWS.map((view) => [view, []]));
  }
}

function recordNewItems(cached, views) {
  const notifications = githubNewItems();
  for (const [view, result] of Object.entries(views)) {
    if (!cached?.views?.[view] || !Array.isArray(result.items)) continue;
    const previous = new Set(
      cached.views[view].items.map((item) => `${item.repository}/${item.id}`),
    );
    const discovered = result.items
      .filter((item) => !previous.has(`${item.repository}/${item.id}`))
      .map((item) => `${item.repository}/${item.id}`);
    notifications[view] = [...new Set([...discovered, ...notifications[view]])].slice(0, 99);
  }
  try {
    localStorage.setItem('githubNewItems', JSON.stringify(notifications));
  } catch {
    /* Keep the fetched results even when notification state cannot be stored. */
  }
  notifyGitHubNotifications();
}

export function markGitHubViewSeen(view) {
  const notifications = githubNewItems();
  notifications[view] = [];
  try {
    localStorage.setItem('githubNewItems', JSON.stringify(notifications));
  } catch {
    /* Reading a view should not depend on storage being available. */
  }
  notifyGitHubNotifications();
  return notifications;
}

export async function loadGitHub(force = false, signal) {
  const settings = githubSettings();
  const stamp = await identity(settings);
  return withLock('moo-github', async () => {
    const cached = readCache(stamp);
    let retry;
    try {
      retry = JSON.parse(localStorage.getItem('githubRetry') || 'null');
    } catch {
      /* Ignore a damaged transient timer. */
    }
    if (retry?.identity === stamp && retry.until > Date.now()) {
      if (cached) return { data: cached, error: errorCode('rate', retry.until) };
      throw errorCode('rate', retry.until);
    }
    if (!online()) {
      if (cached) return { data: cached, error: errorCode('offline') };
      throw errorCode('offline');
    }
    if (!force && cached?.version === 2 && Date.now() - cached.updated < settings.refresh * 60000)
      return { data: cached };
    try {
      let username = settings.username;
      if (!username && settings.token)
        username = (await request('/user', settings, signal)).body.login;
      if (!validLogin(username)) throw errorCode('setup');
      const results = await Promise.allSettled(
        settings.views.map(async (view) => [
          view,
          view === 'actions'
            ? await actions(settings, signal)
            : await search(view, settings, username, signal),
        ]),
      );
      const views = {};
      const failures = {};
      let rate;
      results.forEach((result, index) => {
        const view = settings.views[index];
        if (result.status === 'fulfilled') {
          views[view] = result.value[1];
          if (result.value[1].retryAt) {
            failures[view] = 'rate';
            rate = Math.max(rate || 0, result.value[1].retryAt);
          }
        } else {
          failures[view] = result.reason.message;
          if (cached?.views[view]) views[view] = cached.views[view];
          if (result.reason.message === 'rate')
            rate = Math.max(rate || 0, result.reason.retryAt || 0);
        }
      });
      if (Object.values(failures).includes('auth')) {
        localStorage.removeItem('githubCache');
        throw errorCode('auth');
      }
      if (rate)
        localStorage.setItem('githubRetry', JSON.stringify({ identity: stamp, until: rate }));
      if (!Object.keys(views).length && settings.views.length)
        throw errorCode(Object.values(failures)[0], rate);
      if (signal?.aborted || stamp !== (await identity(githubSettings())))
        throw errorCode('changed');
      recordNewItems(cached, views);
      const data = {
        version: 2,
        identity: stamp,
        username,
        views,
        failures,
        updated: Date.now(),
        authenticated: Boolean(settings.token),
      };
      try {
        localStorage.setItem('githubCache', JSON.stringify(data));
      } catch {
        /* Keep the returned results. */
      }
      return { data, ...(rate ? { error: errorCode('rate', rate) } : {}) };
    } catch (error) {
      if (error.message === 'auth') localStorage.removeItem('githubCache');
      if (error.message === 'rate' && error.retryAt)
        localStorage.setItem(
          'githubRetry',
          JSON.stringify({ identity: stamp, until: error.retryAt }),
        );
      if (cached && !['auth', 'setup', 'changed'].includes(error.message) && !signal?.aborted)
        return { data: cached, error };
      throw error;
    }
  });
}
