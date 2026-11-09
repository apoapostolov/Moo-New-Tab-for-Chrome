Moo 1.0.2 for Chrome updates Widget layout, Navbar styling and Weather settings.

- Widget layout: use all four corners and the centre. Side cards and drop placeholders fill their Overview containers, and the lower side containers align with the preview bottom. Upper-right widgets appear above Focus and Settings; the buttons follow the stack as its height changes. Drag targets remain stable, and a drag without a destination preserves placement.
- Navbar: choose Classic or Glass button styling in Settings → Navbar. The choice applies immediately and survives reloads and backups.
- Weather: new profiles and resets place Weather in the bottom-right, while saved placements are preserved. Apply a typed location on Enter or when leaving the field without reloading the page. Default Provider appears first in the provider list; OpenWeather identifies the separate API-key provider.

Packaged extensions were checked in Firefox and Chrome for dragging, layout, navbar sizing and hover mode, style changes, persistence and narrow windows. The Sofia location flow used mocked OpenWeather responses; live API-key behavior remains unverified. Tests, lint, both browser builds, package validators and shared-file parity checks pass.

Load the extracted Chrome archive as an unpacked extension in Developer mode. This release is not a Chrome Web Store publication.
