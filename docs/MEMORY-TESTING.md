# Background memory tests

Moo has deterministic resource tests and browser runners for Chrome and Firefox/Zen. The resource tests execute the production video component's effects with controlled media APIs. Both browser runners use real React, local MP4 files and a sliding HLS webcam playlist. Chrome loads an instrumented extension package with its production service worker, permissions and content security policy; Firefox/Zen uses the existing local HTTP test page.

The reported failure is a sudden memory increase when opening a new video-background tab, sometimes followed by a green frame and crashes in other applications. This needs system commit measurements as well as JavaScript heap measurements. A green frame alone does not identify whether Moo, Gecko or the graphics driver caused the failure.

## Run

Install the repository dependencies first. Browser runs require FFmpeg on PATH, Python 3 on Windows and the selected installed browser. Python uses the Windows memory API through ctypes; no Python packages are required for measurement. The Chrome runner currently requires Windows for process working-set and private-commit counters.

```powershell
npm run test:memory:unit
npm run test:memory
```

Every browser run uses a fresh profile. The default workload repeats transitions 30 times and plays each soak fixture for 60 seconds. The repository selects its default browser from `moo.config.json`; `--engine chrome` and `--engine firefox` select it explicitly. Firefox writes to `output/memory/`; Chrome writes to `output/memory-chrome/`. Each directory contains `report.json`, `browser.log`, fixtures and the separate instrumented build.

Zen is started with `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1` only in the test process environment. Mozilla requires this for Marionette chrome-context memory reports; it grants the automation client privileged Gecko access, so the runner uses a disposable profile and a loopback-only connection.

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

For the full Chrome workload used in this investigation, run:

```powershell
node scripts/test-memory.mjs --engine chrome --cycles 100 --soak-seconds 600 --headed --include-4k --output output/memory-chrome-full
```

`bun run test:memory:chrome` runs the standard Chrome workload; `bun run test:memory:chrome:soak` selects 100 cycles and 600 seconds for each soak. Override the installed Chrome path with `--browser` or `CHROME_BINARY`. Chrome connects through a private debugging pipe and loads only the disposable test extension. It does not use the user's browser profile or change store installations. The disposable extension grants itself loopback access to local media fixtures; release packages are untouched.

The Chrome launch disables Windows native window occlusion so covering the browser while using the computer cannot interrupt a long soak. Actual tab visibility remains enabled: the suite verifies that a hidden webcam tab pauses, stops fetching and resumes when selected. GPU rendering and decoding remain enabled; the report records Chrome's GPU feature status. Dedicated GPU memory is not measured.

The 4K case requires an explicit flag because the reported failure affects other applications. The suite does not intentionally exhaust memory. A persistent one-second Windows sampler supplies the watchdog, which stops the test browser below 2 GiB of available physical memory or 4 GiB of Windows commit headroom. Missing or stale sampler readings stop the run as well. Sampling cannot guarantee protection against an allocation spike between checks.

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
| Measurement | Gecko reports or Chrome process working sets, private committed bytes, JavaScript heaps, physical memory, Windows commit headroom and missing-measurement rejection |

The browser runners require advancing decoded frames before accepting playback and throughout the soak. After unmount it checks HLS player counts, blob URLs, detached videos with sources, overlays, EventBus subscriptions and open fixture responses. The deterministic tests also check watchdog timers and native DOM/text-track listeners.

## Memory gates

The default resident-memory ceiling is 3072 MiB across the isolated browser's reported processes. Equivalent warmed checkpoints must grow by at most 96 MiB, with a fitted slope at or below 12 MiB per checkpoint. Firefox uses Gecko explicit memory after memory minimization. Chrome uses Windows private committed bytes after JavaScript garbage collection, including the browser, renderer, GPU and utility processes. These are different measurements and cannot be compared as equivalent byte totals. Chrome records each target's V8 heap and deduplicates shared isolates when calculating a JavaScript total. Playback samples are retained for peak reporting and excluded from the settled-growth calculation. Chrome refreshes and retries a complete PID snapshot up to three times when a process exits before Windows reads its counters; failed attempts remain in the report, and repeated failure stops the sample.

These are regression budgets, not measured limits for Moo. Override them with `--max-resident-mib`, `--max-growth-mib` and `--max-slope-mib`. A ceiling or system-headroom failure aborts the run instead of continuing subsequent scenarios.

Resident memory sums can count shared pages more than once. Neither Gecko explicit reports nor Chrome process counters cover every graphics-driver allocation or dedicated GPU memory. The test page preloads HLS for instrumentation and uses a separate unminified build with package chunks. Chrome exercises extension APIs and CSP in an installed test extension; Firefox exercises the components on a local HTTP origin. The user's profile, third-party extensions and minified release behavior need separate validation. Remote account widgets are disabled so their requests do not distort the background measurements.

## Current verification

On 3 November 2026, native PowerShell passed all 15 enabled browser scenarios in Zen Twilight 1.25t (Gecko 159.0, build 20261102012134). This was a headless smoke run with one transition cycle and 10 seconds per playback soak. The optional 4K scenario was skipped. The local fixtures have verified H.264 dimensions of 1280 × 720, 1920 × 1080 and 3840 × 2160.

The warmed baseline was 657.6 MiB resident and 181.5 MiB explicit. Four additional media tabs produced a peak of 1640.7 MiB resident. Final settled memory was 708.0 MiB resident and 179.9 MiB explicit, with explicit growth of -1.67 MiB and a slope of -0.21 MiB per checkpoint. Memory and resource gates passed. This short run did not reproduce the reported sudden exhaustion; it does not establish that the original incident is resolved. Longer runs, headed rendering and the installed extension in the user's profile remain to be verified.

The earlier managed execution shell rejected loopback connections with `EACCES`, while native PowerShell passed the same probe. On 5 November, loopback connections work in the current execution environment; the runner still checks them before building fixtures. The launcher supplies `MOZ_REMOTE_ALLOW_SYSTEM_ACCESS=1` to its isolated Zen process so Gecko memory reports are available. The cleanup guard checks retained source attributes and open fixture responses; it does not infer active decoder ownership from a detached element's last `currentSrc` string.

All 26 new tests pass. The initial wider run recorded 218 passes and three timeouts in the existing `three-widgets.test.mjs` tests for concurrent habit confirmation, pending habit writes during a profile change and widget backup round-trips. The final run passes 225 tests with those three tests excluded explicitly through `--test-skip-pattern`. At that point the cause of the timeouts was unresolved; the 5 November Node 22 check below passes those tests without exclusions.

On 5 November 2026, all 233 tests pass under the documented Node 22 runtime, including the three tests previously reported as timing out. The local Node 26.12.1 Web Locks implementation fails to release a lock after a rejected callback, which reproduces the hang independently of Moo. Use Node 22 for the test suite. This result does not add a new sustained browser memory measurement.

## Chrome investigation — 5 November 2026

Deterministic tests cover the Chrome transport and measurement gates. Browser runs exercise the Windows process counters and persistent system sampler. A short Firefox/Zen compatibility run passes all 15 enabled scenarios with one transition cycle and 10-second soaks; 4K is skipped in that compatibility check. All 237 tests pass under Node 22, and JavaScript/SCSS lint and both archive validators pass. The full Chrome run below completed successfully.

The full headed Chrome 157.0.8103.39 run passed all 16 scenarios on 5 November 2026. It lasted 24 minutes 30 seconds, used 100 transition cycles and ten 4K decode/disposal cycles, and completed separate 600-second MP4 and live HLS soaks. The 266 memory samples include the browser, renderer, GPU and utility processes.

| Measurement | Result |
| --- | --- |
| Peak resident memory | 1,075.5 MiB against a 3,072 MiB ceiling |
| Warmed / final private commit | 781.6 / 463.6 MiB |
| Settled private-commit growth | -318.0 MiB against a +96 MiB ceiling |
| Settled slope | -35.5 MiB per checkpoint against a +12 MiB ceiling |
| Final single-tab V8 heap | 6.9 MiB |
| Maximum HLS buffer | 12.0 seconds against a 45-second ceiling |
| HLS players created / destroyed | 217 / 217 |
| Retained players, blob URLs, videos and overlays | 0 after cleanup |
| Lowest sampled physical / commit headroom | 3,341.1 / 7,952.9 MiB |

This bounded run detected no leak above the configured gates. It does not rule out a driver-specific problem, a leak in dedicated GPU memory, or behavior in another profile. During the run, multi-tab JavaScript totals summed per-target readings; shared V8 isolates could be counted repeatedly. Native process counters and the final single-tab heap are unaffected. A separate five-tab Chrome probe confirmed one shared isolate, and the sampler now deduplicates by isolate ID.

The [compact verification record](audit/2026-11-05/chrome-memory-summary.json) preserves the configuration, scenario outcomes, cleanup counters and limits. The full local report, browser log, timeline chart and CSV are in `output/memory-chrome-full-verified/`. Interrupted and failed instrumentation trial runs are retained separately and are not counted as passing runs.
