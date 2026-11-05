<p align="center">
  <img src="assets/icon.png" alt="Moo icon" width="96" />
</p>

<h1 align="center">Moo</h1>

<p align="center">Check your plans, leave notes and look things up from a new tab.</p>

<p align="center">
  <a href="#installation"><img src="https://img.shields.io/badge/type-Chrome_extension-555" alt="Chrome extension" /></a>
  <a href="package.json"><img src="https://img.shields.io/badge/language-JavaScript-555" alt="Language: JavaScript" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-BSD--3--Clause-555" alt="License: BSD-3-Clause" /></a>
</p>

Moo is a personal fork of [Mue](https://github.com/mue/mue) for Chrome. It gives you somewhere to check the next appointment, leave a reminder and look something up whenever you open a tab. You choose what stays on the page and where it sits.

<p align="center">
  <img src="assets/moo-newtab.gif" alt="Moo with an alpine clouds video background, clock, weather, mail, calendar and tasks" width="800" />
</p>

The preview uses fictional mail, events, tasks and weather over a real video background. [Compare the three backgrounds](assets/previews/README.md).

Moo opens directly in English with the time, Search/Ask Bar, basic weather in the bottom-left corner and Unsplash backgrounds. Other widgets are enabled in Settings.

## Features

- Google widgets: read mail, check upcoming events and manage tasks beside the clock. Set up your own Google OAuth client under Settings → Google, then connect your account and choose the calendars and task list you use. Calendar and Tasks accept English scheduling phrases with a Natural Format guide, notes and a review of the interpreted fields. [Supported syntax](docs/NATURAL-FORMAT.md).
- Search/Ask Bar: enter a question and choose a search engine, AI service or reference site from the service menu. Open a web search, find documentation or continue the question in a conversation.
- RSS reader: enable RSS in Overview and add feeds under Settings → Feeds, or read a Feedly account with a developer token. Headlines appear in one list; hover to read an article when available, or open the original site. Feeds import and export as OPML.
- Floating Notes, Lists, Images and Countdowns: double-click empty space to create a note, then use its menu to change its type, or paste an image onto the page. Settings → Floats controls these features and the Countdown widget; content stays in your browser. Countdown titles can be edited directly on click.
- Quick links: add regular destinations under Settings → Quick Links so the sites you use for a project are available on a new tab.
- Clock and weather: choose a clock, set Progress around your working hours and see current conditions and a five-day forecast for your location.
- Habits: confirm daily routines, selected weekdays or weekly goals in a weekly table. Browse earlier weeks, earn streak badges and hover for details and monthly history. Archiving keeps the habit's history.
- Air Quality: choose a compact AQI reading, a forecast summary or detailed pollutant, UV and pollen readings for a saved city or coordinates. Readings use Open-Meteo's CAMS model forecasts.
- Bookmarks: bring browser bookmarks, Raindrop and Readwise reading together, with recent saves, older discoveries and a shared detail preview. [Setup and options](docs/BOOKMARKS.md).
- GitHub: check review requests, your pull requests, assigned issues and workflow runs through status glyphs and compact tabs. Hover to read the complete description and developer details. Public repositories work with a username; an optional personal token adds access to selected private repositories. [Widget setup and advanced options](docs/HABITS-AIR-QUALITY-GITHUB.md).
- Widget layout: show, hide and arrange widgets in the left, centre or right column under Settings → Overview. The Standard / Focus selector saves separate widget visibility and placement for Focus sessions and Progress clock work shifts. Quick Links can use a separate Focus/Work list; each floating item has a Show in Focus checkbox. Narrow and short windows use a scrollable layout.
- Backgrounds: use local pictures, stock photos, video clips or live channels. Some sources need a free API key. While a video is playing, triple-click the page to hide the widgets; triple-click again or press Escape to return.
- Backups: export your setup under Settings → Advanced, including uploaded pictures if you choose. Imports show a preview before applying, and sign-in credentials stay out of the backup.

Settings, notes, habit progress and uploaded pictures are stored in your browser. Weather, Air Quality, GitHub, Bookmarks, backgrounds, feeds and connected Google widgets contact their respective services; [Data and connections](docs/PRIVACY.md) explains what goes where.

## Installation

Build from source with the commands below, then install the unpacked Chrome extension:

1. Open `chrome://extensions` and enable Developer mode.
2. Choose **Load unpacked** and select `build/chrome`.
3. Open a new tab and confirm Chrome's new-tab change prompt if it appears.

The package is `build/chrome-<version>.zip`. This project has not been published to the Chrome Web Store. Google widgets use a Web application OAuth client with the redirect displayed in Settings → Google; see [Firefox and Chrome development](docs/CROSS-BROWSER.md).

## Development

Use Bun 1.3.1 and Node 22:

```sh
bun install --frozen-lockfile
bun run dev
```

The local preview is for layout and interaction work. Google sign-in and extension permission prompts need an installed extension.

```sh
bun run test
bun run lint
bun run build
node scripts/validateChrome.cjs
```

The default build writes `build/chrome/` and `build/chrome-<version>.zip`. `bun run build:all` also produces the Firefox package. Load Chrome through `chrome://extensions` with Developer mode enabled; load `build/firefox/manifest.json` temporarily through Firefox's `about:debugging`.

The Firefox project uses the same structure, application code, hero and preview assets. Improvements in either repository must be carried to the other. See [Firefox and Chrome development](docs/CROSS-BROWSER.md) for the parity check, migration command and Chrome Google widgets setup.

[Changelog](CHANGELOG.md) · [Report a bug or request a feature](https://github.com/apoapostolov/Moo-New-Tab-for-Chrome/issues) · [Translation guide](docs/TRANSLATING.md)

## Credits and licence

Moo builds on [Mue](https://github.com/mue/mue) by The Mue Authors under the [BSD-3-Clause licence](LICENSE). The original copyright notices and attribution are preserved. Moo is a personal fork and is not affiliated with or endorsed by Mue.

Stock images and video come from Unsplash, Pexels, Pixabay, Coverr and Mixkit. The [preview credits](assets/previews/README.md) identify the footage used in the README. Live channels were found through the [iptv-org index](https://github.com/iptv-org/iptv); each stream remains the property of its broadcaster. Illustrations retained from Mue are from [unDraw](https://undraw.co).
