# Moo changelog

## 1.0.3 — 11 November 2026

### Added

- Knowledge: discover Wikipedia articles or Wikimedia Commons images, optionally filtered by comma-separated subjects. Choose a new page per reload, per local day or every 1–168 hours, with eight hours as the default. Source and subject appear beside the widget title; thumbnails, image credits, saved offline text and Classic/Glass styling are included.
- Google Drive: search and reopen recent, starred and shared files or browse folders with read-only metadata access. Choose Drive in the four-service Widget settings selector under Settings → Google. The widget remembers its selected view, loads more files when scrolled to the bottom and sizes its list to Files per page. Its scrollbar fades when idle. Enable the Drive API in your Google Cloud project and reconnect Google to approve the new permission.
- Subscriptions: track personal renewals, trials, costs and cancellation deadlines with a searchable service-logo catalogue. Choose renewal dates with the browser calendar and set the cancellation notice beside them. Compare costs in a display currency using daily reference rates while retaining original billing prices. Open saved management links in the current or a new tab and preview notes on hover or keyboard focus. Cancelled entries remain available for immediate undo until the view changes. Entries stay local and are included in Backups.
- Planning: open Natural Format help beside the capture title field, with compact date examples and guidance matching the Tasks and Calendar help panels.
- Misc: optionally show a settings button on every widget. The option is off by default; actions such as Refresh remain available independently.

## 1.0.2 — 9 November 2026; updated 10 November 2026

### Added

- Planning: capture personal tasks for Today, Tomorrow or Later, type dates such as “tomorrow” and “in 3 days”, choose three daily priorities, estimate time and review unfinished plans. Tasks stay local, work offline and are included in Backups.
- Widget layout: place widgets in the upper-left and upper-right corners as well as the lower corners and centre. Upper-right widgets appear above the navbar buttons.
- Navbar: choose Classic or Glass styling for the navbar buttons in Settings → Navbar.

### Changed

- Weather: new profiles and resets place the widget in the bottom-right corner. Saved placements are preserved, including the basic layout in narrow windows.

### Fixed

- Widget layout: upper side cards and drop placeholders fill their Overview containers, lower side containers align with the preview bottom, and the navbar follows the upper-right stack as its height changes. Drag targets stay stable when lifting a widget, and a drag without a destination preserves placement.
- Weather: distinguish the built-in service as Default Provider at the top of the provider list, keeping OpenWeather for the API-key provider. Apply a typed location on Enter or when leaving the field, clear the old forecast and refresh the selected provider without reloading the page.

## 1.0.1 — Chrome development build, 5 November 2026

### Fixed

- Google widgets: Natural Format moves a time without an explicit date to tomorrow when that time has already passed today. Google Mail now defaults to unread messages in the inbox. Overlapping Google sign-in flows are blocked with a clear message. Changing the Weather type loads its custom controls without breaking settings, and the wind speed switch now follows its selected state.
- Weather: the Classic surface keeps its rounded corners clean in Chrome.

### Changed

- GitHub remembers the last opened tab, marks newly discovered items with a count, and opens a tab with new items after a refresh. Split middle widget columns stay transparent between cards.

## 1.0.0 — Chrome development build, 5 November 2026

Moo is a personal fork of [Mue](https://github.com/mue/mue) for Chrome. New profiles and resets open in English with digital time, Search/Ask Bar, basic weather and Unsplash backgrounds. Enable other widgets in Settings. This Chrome development build carries the Firefox features and fixes through 5 November, with a Chrome service worker and OAuth redirect. It has not been published to the Chrome Web Store. Selectable languages have complete key coverage, including machine-assisted translations that still need fluent-speaker review.

### Added

- Google widgets: read mail, manage tasks and check calendars using your own Google OAuth client. Calendar and Tasks accept English scheduling phrases with a review of the interpreted fields. Calendar adds recurring events, reminders, guests, attachments and a scrollable event preview with on-demand location maps. Background reminders use optional notification access. [Calendar](docs/GOOGLE-CALENDAR.md) · [Natural Format](docs/NATURAL-FORMAT.md).
- Search/Ask Bar: choose a search engine, AI service or reference site for a query. The menu remains available in smaller windows.
- Picture, video and live backgrounds: choose a source, upload pictures or add streams. Triple-click a playing video to hide the widgets; Escape restores them. Media cleanup and storage tests cover decoder sources, HLS players, subscriptions and asset lifetimes. The memory test runner uses a disposable browser profile. [Memory testing and limits](docs/MEMORY-TESTING.md).
- Widget layout: save separate Standard and Focus layouts, move widgets between columns and choose their panel styles. Focus sessions and Progress clock shifts activate the Focus layout. Bookmarks combines browser bookmarks, Raindrop and Readwise with shared previews and reading selections; Habits tracks confirmed days, streaks and milestones; GitHub shows review requests, issues, pull requests and workflow runs. [Bookmarks](docs/BOOKMARKS.md) · [Habits and GitHub](docs/HABITS-AIR-QUALITY-GITHUB.md).
- Clock and weather: choose clocks, world clocks, working hours and a five-day forecast. Air Quality shows European or US AQI with optional forecasts, pollutants, UV and pollen in Basic, Summary or Detailed views. [Time features](docs/TIME-AND-COUNTDOWNS.md).
- RSS reader: read feeds or connect Feedly, preview stories, and import or export OPML while preserving folders. Feedly reads use its unread list, mark opened stories read and report token usage in Settings.
- Floats and Quick Links: create floating notes, lists, images and countdowns, keep selected items fixed and choose which appear in Focus. Notes have an editor; countdown titles can be edited directly. Quick Links supports separate Focus/Work destinations and optional usage ordering while preserving manual order by default.
- Backups and browser development: export and preview imports of settings and uploaded pictures while keeping credentials separate. Both repositories build Firefox and Chrome from the same application and permission catalogue, with parity guidance and a sync check. Chrome uses a Manifest V3 service worker and its own Google OAuth redirect. README hero and preview assets are reused. [Firefox and Chrome development](docs/CROSS-BROWSER.md).

### Changed

### Removed

- From Mue: the setup wizard, Marketplace and Library, quotes and greetings, achievements, the old search widget, the message form, and the About sections for support, contributors, supporters, photographers and curators. Search/Ask Bar provides current search options. Old Persian, Egyptian Arabic and South Azerbaijani were removed from the selector because their translations are incomplete.
