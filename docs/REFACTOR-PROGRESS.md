# Approved audit refactors

Order approved on 26 October 2026: **R1 → R3 → R4 → R5 → R2 → R6 → R7 → R8 → R9 → R10 → R11**.

The acceptance criteria are in [the audit](AUDIT-2026-10-26.md). This file records implementation and verification as work progresses. Hidden UI remains available, and Search/Ask Bar keeps its borderless field and soft underline.

| Scope | Status | Evidence |
| --- | --- | --- |
| R1 Backups and reset | Implemented | Versioned format, preview, journal recovery, quota rollback and separate reset scopes; 28 regression tests pass; build passes |
| R3 Responsive layout | Implemented | Native compact section selector and scrollable widget stack below 1100px or 600px height; desktop placement stays stored |
| R4 Keyboard workflows | Implemented | Explicit widget move commands, chip selection, note creation/movement, image resizing, todo and reader focus paths; browser overview inspected |
| R5 Firefox release tooling | Implemented | Frozen Firefox CI, archive validation, validated manual tag release; draft by default; no automatic merge, sign or publication |
| R2 Request reliability | Implemented | Bounded requests, cancellation and settings/account guards; queue/auth Web Locks; HLS stops/resumes loader; fixture sign-out race and ownership checks |
| R6 Shared surfaces and templates | Implemented | Shared WidgetCard/WidgetHeader, card tokens, label and reader surfaces; existing field-row system retained; hidden styles preserved |
| R7 Localization | Implemented | Lazy selected locale + English; shared subscription; literal UI keys; local coverage; fallback fixture |
| R8 Google edge cases | Implemented | Read-only forms, composite identities, paginated lists, saved-view refresh and optimistic source guards; permission/pagination fixtures |
| R9 Durable notes and assets | Implemented | Debounced notes with unload flush/retry status, shared IndexedDB assets, no automatic eviction, explicit management; migration/backup fixtures |
| R10 Product docs and destinations | Implemented | Moo support/privacy/translation links, actual data destinations, Firefox/Zen development and manual signing/release docs; attribution retained |
| R11 Lint gate | Implemented | Derived navigation/date state, effect ownership, strict zero-warning JS gate and normalized SCSS; CI enforces lint |


## Additional requests

RSS now defaults to off, in the centre immediately above Mail. A one-time migration applies that requested layout to existing profiles; later user choices remain intact. Every registered widget has a preview, including distinct RSS and Weather Full thumbnails. A regression contract prevents a new widget being added without a preview.

Connect Google is centred in each disconnected widget and uses the signature colour. Google form primary buttons use the same colour token. Search/Ask Bar retains its borderless field and soft underline. Hidden Discord, toast and dormant UI/styles are retained.

The README GIF uses Alpine clouds, selected by Apostol from the three variants. Three five-second Full HD alternatives use actual widgets, fictional data and people-free nature videos. See [the choices and source credits](../assets/previews/README.md). Rich HTML mail previews are added to the original audit's further-development list; they are not implemented in this pass.

## Verification

The current local checks are recorded in `audit/2026-10-26/refactor-verification.json`. JavaScript and SCSS lint pass; regression fixtures and the Firefox build/archive validator pass. Local translation coverage is generated from Moo's own keys. The main entry reduction is a bundle measurement, not a measured startup-speed improvement.

Headless Chromium checks cover 1280 × 720, 360 × 800, a short 1280 × 500 window and a 960 × 540 viewport equivalent to a 200% zoom reflow. The Google cards stay inside the viewport. All three disconnected buttons are centred and use the computed signature colour. RSS was enabled in Overview and its preview appeared. Native language radios have readable names, switching UK → US updates the checked value while keeping Settings open, and UK was restored. A two-page native Web Locks fixture confirms queued writes finish in order.

These checks use isolated local fixtures. Installed Firefox/Zen, actual browser zoom, a screen reader, real exhausted IndexedDB storage, connected-account writes, real OAuth revocation, live-stream reconnection and sustained memory/CPU measurements remain manual verification. The checks were recorded before the subsequently authorized v1.0.0 commit and release. The archive is unsigned.

## Startup simplification — 27 October 2026

The Mue setup wizard and its preview overlay are removed. Startup fills missing preferences before selecting the language or rendering widgets, without clearing an existing profile or reloading the first visit. Retired wizard flags are discarded. Both reset scopes use the same English preset: digital time, Search/Ask Bar, basic weather in the bottom-right corner and Unsplash backgrounds. Reset returns to the page instead of reopening Settings. Extra widgets remain available in Settings.

The shipped defaults no longer contain a saved location, weather/background cache or existing usage counts. Weather requests conditions as soon as automatic location lookup finishes. If location access is declined, Set weather location opens Weather settings. The basic layout retains its bottom-right weather card in narrow and short windows; larger widget collections retain their compact stack.

All 31 regression tests, lint, build and archive validation pass locally. Isolated Chromium checks cover fresh storage with one page navigation, both actual reset buttons, an existing profile with retired wizard flags, denied location access, and 1920 × 1080, 360 × 800 and 1280 × 500 layouts. No wizard dialog or preview overlay appears. Mock services provide weather and background data; installed Firefox/Zen behavior remains to be checked. A subsequent explicit request authorizes rebuilding and replacing the v1.0.0 release and updating the live Zen installation. The changelog identifies the 27 October rebuild; the release retains its original publication date.

The persistent New note button and Saved pill were subsequently removed at Apostol's request because they obstruct corner widgets. Double-clicking empty space still creates notes, and successful saves are silent. Actual save or recovery errors appear at the top. An isolated browser check verified note creation, persistence, absence of both corner controls and a visible error during a simulated storage failure.
