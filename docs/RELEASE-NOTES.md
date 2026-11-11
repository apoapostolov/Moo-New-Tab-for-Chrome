Moo 1.0.4 prerelease for Chrome adds a direct central-column switch and corrects corner placement and quick mouse drops in Widget layout.

### Added

- Widget layout: choose one or two columns for the central card widgets with a compact switch beside the Overview separator. Visible cards balance across the selected columns; the clock, date and Search/Ask Bar stay full width. Standard and Focus layouts remember their choices independently, and manual arrangement remains available.

### Fixed

- Widget layout: upper-left and upper-right stacks grow naturally instead of being limited to half the viewport and forcing a rail scrollbar. Upper-left widgets start at the top margin independently of the upper-right navbar and widget stack. Widget lists retain their own scrolling behavior.
- Widget layout: quick mouse drops in Overview use the final pointer position, including settings-panel scrolling. Planning, Subscriptions and other widgets can move between corners without snapping back to an earlier preview target. Cancelled drags preserve placement, and Standard and Focus layouts stay independent.

Both editions pass 295 automated tests, lint, shared-file parity and both package validators. Packaged interactions were checked in Chrome and Firefox: one/two-column selection, keyboard use, hidden widgets, reloads, Backups, independent Standard/Focus choices, manual layout overrides, upper-corner alignment, quick and scrolled mouse drops, cancellation and navbar clearance.

Extract `chrome-1.0.4.zip`, open chrome://extensions, enable Developer mode and choose Load unpacked for the extracted directory. Keep that directory in place. This is not a Chrome Web Store publication.

The attached SHA256SUMS.txt verifies the browser archive. Version 1.0.3 remains the latest stable release.
