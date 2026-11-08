import project from '../../moo.config.json';

const target = import.meta.env.VITE_MOO_BROWSER || project.defaultBrowser;
export const REPO_URL = `https://github.com/apoapostolov/Moo-New-Tab-for-${target === 'chrome' ? 'Chrome' : 'Firefox'}`;
// Upstream services remain in use for image and weather requests.
export const API_URL = 'https://api.muetab.com/v2';
export const SPONSORS_URL = 'https://sponsors.muetab.com';
export const GITHUB_URL = 'https://api.github.com';
export const OPENSTREETMAP_URL = 'https://www.openstreetmap.org';

// Moo URLs
export const WEBSITE_URL = REPO_URL;
// Retained for dormant Marketplace UI.
export const MARKETPLACE_URL = 'https://muetab.com/marketplace';
export const CHANGELOG_URL = `${REPO_URL}/releases`;
export const PRIVACY_URL = `${REPO_URL}/blob/main/docs/PRIVACY.md`;
export const WEBLATE_URL = `${REPO_URL}/blob/main/docs/TRANSLATING.md`;
export const ISSUES_URL = `${REPO_URL}/issues`;
// The settings header appends the page name as the issue title.
export const BUG_REPORT = `${ISSUES_URL}/new?labels=bug&template=bug_report.yml&title=`;
export const KNOWLEDGEBASE = `${REPO_URL}#installation`;

// Moo Info
export const ORG_NAME = 'apoapostolov';
export const REPO_NAME = REPO_URL.split('/').pop();
export const EMAIL = 'theapoapostolov@gmail.com';
export const TWITTER_HANDLE = 'apomakesmods';
export const DISCORD_SERVER = 'zv8C9F8';

export const VERSION = '1.0.2';

// Feature flags
// Hides the Experimental page; its debug hotkey loads unconditionally.
export const SHOW_EXPERIMENTAL = false;
// Hides the Discord invite in About; set to true to show it.
export const SHOW_DISCORD_LINK = false;
