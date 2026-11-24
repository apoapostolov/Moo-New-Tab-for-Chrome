# Security policy

## Supported versions

| Version | Supported |
| --- | --- |
| Latest 1.0.x release | Yes |
| Anything older | No |

Builds from `main` are development code and are not supported.

One codebase, two browsers: Moo for Firefox and Moo for Chrome share most of
their code, so a vulnerability often affects both. If you are unsure which
repository to use, report it where you found it and say that the other browser
may be affected.

## Reporting a vulnerability

Use GitHub private vulnerability reporting. Do not open a public issue.

1. Open the **Security** tab of this repository.
2. Choose **Report a vulnerability**.
3. Describe the problem and how to reproduce it.

If that button is not visible, private reporting has not been enabled yet. Open
a short issue asking for a private channel, and keep the details out of it.

Please include:

- the Moo version, from Settings, About, or from the file name of the installed
  package
- Chrome version and operating system
- how the build was installed: from the store, from a release file, or built
  locally
- reproduction steps
- the console errors you saw

Do not attach an exported settings file, bookmarks, notes, or RSS feeds from a
real profile.

## What is in scope

- a permission requested in the manifest that the interface does not need
- content security policy or sandbox escapes in the new tab page
- cross-site scripting through widget data: notes, bookmarks, feed titles,
  weather location, or a custom background
- handling of remote content: fetching, proxying, or storing third-party feeds
  and images
- message passing between the page, the background script, and content scripts
- exposure of stored settings or notes to a page or to a website
- a supply-chain problem in the build: `bun.lock`, scripts, or dependencies

## What is out of scope

- vulnerabilities in the browser itself. Report those to the Chrome team
- third-party sites whose feeds or images Moo displays
- a build loaded temporarily from disk in developer mode
- reports that need an already compromised browser profile or another malicious
  extension
- missing hardening with no demonstrated impact

## How this repository is maintained

- Dependabot alerts and Dependabot security updates are enabled.
- CI runs this repository's checks on every pull request, and a pull request
  merges only when they pass.
- Merging is squash-only, and the branch is deleted after the merge.

There is no bug bounty. Reports are handled by the maintainer.
