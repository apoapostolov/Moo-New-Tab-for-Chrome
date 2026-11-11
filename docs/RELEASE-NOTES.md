Moo 1.0.4 prerelease for Chrome removes the upper-corner height cap and fixes quick mouse drops in Widget layout.

### Fixed

- Widget layout: upper-left and upper-right stacks grow naturally instead of being limited to half the viewport and forcing a rail scrollbar. Widget lists retain their own scrolling behavior.
- Widget layout: quick mouse drops in Overview use the final pointer position, including settings-panel scrolling. Planning, Subscriptions and other widgets can move between corners without snapping back to an earlier preview target. Cancelled drags preserve placement, and Standard and Focus layouts stay independent.

Both editions pass 291 automated tests, lint, shared-file parity and both package validators. Packaged mouse interactions were checked in Chrome and Firefox: quick corner moves, release coordinates, scrolled settings, narrower desktop windows, drag cancellation, saved placement, independent Focus placement and navbar clearance.

Extract `chrome-1.0.4.zip`, open chrome://extensions, enable Developer mode and choose Load unpacked for the extracted directory. Keep that directory in place. This is not a Chrome Web Store publication.

The attached SHA256SUMS.txt verifies the browser archive. Version 1.0.3 remains the latest stable release.
