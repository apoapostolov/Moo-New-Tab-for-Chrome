# Background memory tests

Moo has deterministic resource tests and a separate Zen Twilight browser runner. The resource tests execute the production video component's effects with controlled media APIs. The browser runner uses real React, Gecko decoders, local MP4 files and a sliding HLS webcam playlist.

The reported failure is a sudden memory increase when opening a new video-background tab, sometimes followed by a green frame and crashes in other applications. This needs system commit measurements as well as JavaScript heap measurements. A green frame alone does not identify whether Moo, Gecko or the graphics driver caused the failure.

## Run

Install the repository dependencies first. The browser runner also requires FFmpeg on PATH, Zen Twilight and Python 3 on Windows. Python uses the Windows memory API through ctypes to read commit headroom; no Python packages are required.

```powershell
npm run test:memory:unit
npm run test:memory
```

The browser run uses a fresh profile. Its default workload repeats transitions 30 times and plays each soak fixture for 60 seconds. It writes `output/memory/report.json` and `output/memory/browser.log`.

```powershell
# Visible browser with the normal graphics path
npm run test:memory -- --headed

# Longer bounded run: 100 transitions and 10 minutes per playback soak
npm run test:memory:soak

# Optional 4K decoder exercise
npm run test:memory -- --headed --include-4k

# Override the installed browser path
npm run test:memory -- --browser "C:\Program Files\Zen Twilight\zen.exe"

# Verify fixture generation and bundling without opening Zen
npm run test:memory -- --build-only
```

The 4K case requires an explicit flag because the reported failure affects other applications. The suite does not intentionally exhaust memory. A one-second watchdog stops the test browser below 2 GiB of available physical memory or 4 GiB of Windows commit headroom. Sampling cannot guarantee protection against an allocation spike between checks.

## Coverage

| Area | Checks |
| --- | --- |
| New-tab startup | Read only the selected uploaded background payload, empty collections and deleted keys |
| MP4 video | 720p and 1080p playback, repeated replacement, optional 4K playback and explicit source release |
| Webcam backgrounds | HLS channel changes, delayed initialization cancellation, hidden tabs and offline/resume cycles |
| HLS buffering | Explicit forward/back buffer targets, byte target and buffered-duration checks during playback |
| Failed media | Missing files, corrupt files, stalled responses, slow downloads and retry cancellation |
| Images and video | Crossfade interruption, blob URL revocation, overlay removal and image/video transitions |
| React lifecycle | Effect replay on the same element, repeated mounts and stable subscriptions |
| Moo integration | App source changes, Background disable/enable, multiple tabs and tab closure |
| Sustained use | MP4 and webcam playback with periodic memory and resource samples |
| Measurement | Gecko reports, physical memory, Windows commit headroom and missing-measurement rejection |

The browser runner requires advancing decoded frames before accepting playback. After unmount it checks HLS player counts, blob URLs, detached videos with sources, overlays, EventBus subscriptions and open fixture responses. The deterministic tests also check watchdog timers and native DOM/text-track listeners.

## Memory gates

The default resident-memory ceiling is 3072 MiB across the isolated browser's reported processes. Equivalent warmed checkpoints after Gecko memory minimization must grow by at most 96 MiB in explicit memory. Their fitted slope must stay at or below 12 MiB per checkpoint. Playback samples are retained for peak reporting and excluded from the settled-growth calculation.

These are regression budgets, not measured limits for Moo. Override them with `--max-resident-mib`, `--max-growth-mib` and `--max-slope-mib`. A ceiling or system-headroom failure aborts the run instead of continuing subsequent scenarios.

Resident memory sums can count shared pages more than once. Gecko explicit reports do not cover every graphics-driver allocation or dedicated GPU memory. The harness preloads HLS for instrumentation and uses a separate unminified build with package chunks. It tests Moo's components on a local HTTP origin; installed-extension CSP, the user's profile and third-party extensions need separate validation. Remote account widgets are disabled so their requests do not distort the background measurements.

## Current verification

On 2 November 2026, the deterministic tests pass and the browser harness builds. The local fixtures have verified H.264 dimensions of 1280 × 720, 1920 × 1080 and 3840 × 2160.

The Zen runner now checks loopback TCP before building media fixtures or launching the browser. In this environment even a Node process connecting to its own `127.0.0.1` listener fails with `EACCES`, so the run stops as `blocked` with zero scenarios and zero memory samples. This is an execution-environment restriction rather than a Zen permission setting. No Zen memory measurements were collected and the reported system-wide crash has not been reproduced or confirmed fixed. An earlier Zen startup attempt also exited with an access violation.

All 26 new tests pass. The initial wider run recorded 218 passes and three timeouts in the existing `three-widgets.test.mjs` tests for concurrent habit confirmation, pending habit writes during a profile change and widget backup round-trips. The final run passes 225 tests with those three tests excluded explicitly through `--test-skip-pattern`. Their underlying failures remain unresolved.
