Moo 1.0.2 for Chrome is a prerelease for testing the Widget layout and Weather changes.

- Widget layout: place widgets in the upper-left and upper-right corners as well as the lower corners and centre. The upper-right stack leaves room for Focus and Settings. Drag targets stay stable when lifting a widget, and a drag without a destination preserves placement.
- Weather: apply a typed location on Enter or when leaving the field, clear the old forecast and refresh the selected provider without reloading. The built-in service appears first as Default Provider; OpenWeather identifies the separate API-key provider.

Both packaged extensions were tested in Chrome and Firefox for Air Quality dragging, upper-right control clearance, provider labels and the Sofia location flow. OpenWeather responses were mocked; live API-key behavior remains unverified. Each repository passes 242 tests with Node 26's experimental global navigator disabled, lint, both builds and both package validators. Shared-file parity checks pass.

Load the extracted Chrome archive as an unpacked extension in Developer mode. This prerelease is not a Chrome Web Store publication.
