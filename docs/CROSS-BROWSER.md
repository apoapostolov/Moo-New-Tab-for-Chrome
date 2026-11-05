# Firefox and Chrome development

Both repositories contain the full application, tests, documentation and preview assets. They build independently after `bun install --frozen-lockfile`. The Firefox checkout uses `{"defaultBrowser":"firefox"}` in `moo.config.json`; Chrome uses `{"defaultBrowser":"chrome"}`. `bun run build` selects that default. Use `bun run build:firefox`, `bun run build:chrome` or `bun run build:all` for explicit targets.

Application code and browser support code stay the same in both repositories. `manifest/firefox.json` defines the shared permissions, locales, icons and new-tab override. The packager derives Chrome's manifest from it, replaces Firefox background scripts with a service worker, removes Gecko metadata and sets Chrome 120 as the minimum version. The worker loads the same calendar reminder and install handlers that Firefox uses. The page exposes Chrome's Promise APIs through the `browser` namespace before feature modules run.

## Carrying changes across

Every improvement made in either checkout must reach the other in the same task. Start by reading both `AGENTS.md` files. Prefer carrying a reviewed commit with `git cherry-pick` when the peer has no conflicting work. Preserve each checkout's `moo.config.json`, repository links and browser-specific installation instructions.

Run `bun run parity:check` to compare shared files in the sibling checkout. The local defaults are `../Moo` for Firefox and `../Moo-New-Tab-for-Chrome` for Chrome. For other locations, run:

```sh
node scripts/sync-browsers.mjs /path/to/other-checkout --check
node scripts/sync-browsers.mjs /path/to/other-checkout --apply
```

`--apply` copies changed shared files from the current checkout to the peer. It checks every destination before writing and refuses to overwrite uncommitted peer edits. Merge those edits manually. Remove deleted files explicitly in both checkouts. The comparison covers source, manifests, scripts, tests, assets, shared docs, dependencies, build configuration and CI. It allows different package repository links. README, changelog, release notes and publishing instructions need a separate review for applicable changes.

After migration, run tests and lint, build both targets and run `bun run validate:firefox` and `bun run validate:chrome`. Repeat any relevant browser checks in Firefox/Zen and Chrome. A successful package check does not verify Google consent or a real account.

## Installing Chrome

Run `bun run build:chrome`, open `chrome://extensions`, enable Developer mode and use **Load unpacked** to select `build/chrome`. Open a new tab and confirm Chrome's new-tab change prompt if it appears. `build/chrome-<version>.zip` is the packaged extension for distribution or store submission; a build does not publish it to the Chrome Web Store.

## Google widgets

Firefox retains the Desktop app OAuth client and loopback redirect used by the existing extension. Chrome uses a Web application OAuth client: enable Gmail, Calendar and Tasks in your Google Cloud project, create the client, and add the exact HTTPS redirect displayed in Settings → Google to its Authorized redirect URIs. Paste that client's ID and secret, then connect. Separate browser profiles keep separate tokens. Moving an unpacked Chrome extension can change its ID and redirect, so check the displayed URI again.

Chrome's worker registration follows the [extension service worker documentation](https://developer.chrome.com/docs/extensions/develop/concepts/service-workers/basics). Redirects come from [identity.getRedirectURL](https://developer.chrome.com/docs/extensions/reference/api/identity), and reminder replies use [asynchronous message responses](https://developer.chrome.com/docs/extensions/develop/concepts/messaging).
