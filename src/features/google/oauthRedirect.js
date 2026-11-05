export function oauthRedirect(extensionRedirect) {
  const url = new URL(extensionRedirect);
  if (url.protocol === 'https:' && url.hostname.endsWith('.chromiumapp.org'))
    return extensionRedirect;
  if (url.protocol === 'https:' && url.hostname.endsWith('.extensions.allizom.org'))
    return `http://127.0.0.1/mozoauth2/${url.hostname.split('.')[0]}`;
  throw new Error('Unsupported extension OAuth redirect');
}
