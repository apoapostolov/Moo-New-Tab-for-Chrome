# Chrome release process

Builds use the same source and permission catalogue as Firefox. Read both `AGENTS.md` files and run the parity check before a release. Keep the Chrome README, changelog and release notes accurate for Chrome.

1. Use Node 22 and Bun 1.3.1. Run `bun install --frozen-lockfile`, `bun run test`, `bun run lint`, `bun run build:all`, `bun run validate:firefox` and `bun run validate:chrome`.
2. Load `build/chrome` through `chrome://extensions` with Developer mode enabled. Check startup, saved settings after restart, optional permissions, Google connection and disconnection, reminders, bookmarks, feeds, backgrounds and narrow layouts. Google widgets require a Web application OAuth client with the exact displayed redirect.
3. Review version changes, update release notes and commit before creating a version tag. A GitHub archive does not publish the extension to the Chrome Web Store. Store submission and account credentials require their own authorized release task.
4. The manual workflow creates a draft by default and uploads the Chrome ZIP. Review the draft before publishing.

See [Firefox and Chrome development](CROSS-BROWSER.md) for shared changes and browser differences. Never move a published tag or replace an existing release archive without explicit user authorization.
