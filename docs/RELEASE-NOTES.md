Moo 1.0.3 for Chrome adds Knowledge, Google Drive and Subscriptions, with an optional settings shortcut on every widget.

### Added

- Knowledge: discover Wikipedia articles or Wikimedia Commons images, optionally filtered by comma-separated subjects. Choose a new page per reload, per local day or every 1–168 hours, with eight hours as the default. Source and subject appear beside the widget title; thumbnails, image credits, saved offline text and Classic/Glass styling are included.
- Google Drive: search and reopen recent, starred and shared files or browse folders with read-only metadata access. Choose Drive in the four-service Widget settings selector under Settings → Google. The widget remembers its selected view, loads more files when scrolled to the bottom and sizes its list to Files per page. Its scrollbar fades when idle. Enable the Drive API in your Google Cloud project and reconnect Google to approve the new permission.
- Subscriptions: track personal renewals, trials, costs and cancellation deadlines with a searchable service-logo catalogue. Choose renewal dates with the browser calendar and set the cancellation notice beside them. Compare costs in a display currency using daily reference rates while retaining original billing prices. Open saved management links in the current or a new tab and preview notes on hover or keyboard focus. Cancelled entries remain available for immediate undo until the view changes. Entries stay local and are included in Backups.
- Planning: open Natural Format help beside the capture title field, with compact date examples and guidance matching the Tasks and Calendar help panels.
- Misc: optionally show a settings button on every widget. The option is off by default; actions such as Refresh remain available independently.

Google Drive requires the Google Drive API in your existing Google Cloud project and a new Google connection to approve `drive.metadata.readonly`. Moo reads file metadata; it does not download file contents or modify files. [Setup instructions](https://github.com/apoapostolov/Moo-New-Tab-for-Chrome/blob/v1.0.3/docs/GOOGLE-DRIVE.md). Subscription conversions use reference rates, which may come from an earlier business day; they do not include bank fees.

Both editions pass 289 automated tests, lint, shared-file parity and both package validators. Packaged interactions were checked in Firefox and Chrome. Google Drive pagination and account states were tested with mocked responses; live Google-account access remains unverified.

Extract `chrome-1.0.3.zip`, open chrome://extensions, enable Developer mode and choose Load unpacked for the extracted directory. Keep that directory in place. This is not a Chrome Web Store publication.

The attached SHA256SUMS.txt verifies the browser archive.
