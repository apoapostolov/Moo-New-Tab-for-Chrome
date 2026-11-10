import { googleFetch } from '../api';

export const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.metadata.readonly';
export const DRIVE_FOLDER = 'application/vnd.google-apps.folder';
export const hasDriveScope = (auth) =>
  (auth?.scope || '')
    .split(/\s+/)
    .some((scope) =>
      [
        DRIVE_SCOPE,
        'https://www.googleapis.com/auth/drive.readonly',
        'https://www.googleapis.com/auth/drive',
      ].includes(scope),
    );
const quoted = (value) => String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");

export function driveQuery({ view = 'recent', folder = '', search = '' } = {}) {
  const query = ['trashed = false'];
  if (folder) query.push(`'${quoted(folder)}' in parents`);
  else if (view === 'starred') query.push('starred = true');
  else if (view === 'shared') query.push('sharedWithMe = true');
  if (search.trim()) query.push(`name contains '${quoted(search.trim().slice(0, 200))}'`);
  return query.join(' and ');
}

export function driveHref(file) {
  if (!/^[\w-]+$/.test(file.id || '')) return '';
  try {
    const url = new URL(file.webViewLink);
    if (
      url.protocol === 'https:' &&
      !url.username &&
      !url.password &&
      !url.port &&
      ['drive.google.com', 'docs.google.com'].includes(url.hostname)
    )
      return url.href;
  } catch {
    /* Use Drive's canonical link when metadata has no safe link. */
  }
  return `https://drive.google.com/${file.mimeType === DRIVE_FOLDER ? 'drive/folders/' : 'file/d/'}${file.id}${file.mimeType === DRIVE_FOLDER ? '' : '/view'}`;
}

export async function listDriveFiles(options = {}, signal) {
  const params = new URLSearchParams({
    q: driveQuery(options),
    pageSize: String(Math.max(5, Math.min(30, Math.floor(Number(options.limit)) || 10))),
    fields:
      'nextPageToken,incompleteSearch,files(id,name,mimeType,webViewLink,modifiedTime,starred,owners(displayName))',
    orderBy: options.folder ? 'folder,name_natural' : 'modifiedTime desc',
    spaces: 'drive',
    supportsAllDrives: 'true',
    includeItemsFromAllDrives: 'true',
  });
  if (options.pageToken) params.set('pageToken', options.pageToken);
  const data = await googleFetch(`/drive/v3/files?${params}`, { signal });
  if (options.pageToken && data?.nextPageToken === options.pageToken)
    throw new Error('Google returned a repeated page. Refresh to try again.');
  return {
    files: (data?.files || []).filter((file) => driveHref(file)),
    nextPageToken: data?.nextPageToken || '',
    incomplete: Boolean(data?.incompleteSearch),
  };
}
