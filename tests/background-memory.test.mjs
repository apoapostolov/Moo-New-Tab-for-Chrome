import assert from 'node:assert/strict';
import { test } from 'node:test';
import { componentFixture } from './memory/component-fixture.mjs';
import { assessMemory, MiB, resourceErrors, slope } from './memory/metrics.mjs';

test('MP4 unmount explicitly releases decoder source and cancels playback', async () => {
  const fixture = componentFixture();
  const video = await fixture.render({ url: '/clip.mp4' });
  video.currentSrc = '/clip.mp4';
  video.readyState = 4;
  await video.play();
  fixture.unmount();
  assert.equal(video.paused, true);
  assert.equal(
    video.children.some((source) => source.src),
    false,
  );
  assert.equal(video.currentSrc, '');
  assert.ok(video.loads > 0, 'load() aborts resource selection and releases decoder state');
});

test('source replacement releases the previous media element, not its replacement', async () => {
  const fixture = componentFixture();
  const previous = await fixture.render({ url: '/one.mp4' });
  await previous.play();
  const current = await fixture.render({ url: '/two.mp4' });
  assert.equal(previous.paused, true);
  assert.equal(previous.children[0].src, '');
  assert.equal(current.children[0].src, '/two.mp4');
  fixture.unmount();
});

test('late HLS import cannot create a player after unmount', async () => {
  const fixture = componentFixture({ delayedImport: true });
  await fixture.render({ url: '/live.m3u8', hls: true, live: true });
  fixture.unmount();
  fixture.resolveImport();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(fixture.players.length, 0);
  assert.equal(fixture.document.listenerCount, 0);
  assert.equal(fixture.window.listenerCount, 0);
  assert.equal(fixture.subscriptions, 0);
});

test('200 HLS replacements retain exactly one player and stable subscriptions', async () => {
  const fixture = componentFixture();
  for (let i = 0; i < 200; i++) {
    await fixture.render({ url: `/live.m3u8?channel=${i}`, hls: true, live: true });
    assert.equal(fixture.players.filter((player) => !player.destroyed).length, 1);
    assert.equal(fixture.document.listenerCount, 1);
    assert.equal(fixture.window.listenerCount, 1);
    assert.equal(fixture.subscriptions, 1);
  }
  fixture.unmount();
  assert.ok(fixture.players.every((player) => player.destroyed));
  assert.ok(
    fixture.videos.every(
      (video) => video.listenerCount === 0 && video.textTracks.listenerCount === 0,
    ),
  );
  assert.equal(
    fixture.document.listenerCount + fixture.window.listenerCount + fixture.subscriptions,
    0,
  );
});

test('HLS buffering has explicit forward duration and byte budgets', async () => {
  const fixture = componentFixture();
  await fixture.render({ url: '/live.m3u8', hls: true, live: true });
  const { config } = fixture.players[0];
  assert.ok(config.maxMaxBufferLength <= 15, 'maxBufferLength alone is a minimum target in hls.js');
  assert.ok(config.maxBufferSize <= 32 * MiB);
  assert.ok(config.backBufferLength <= 5);
  fixture.unmount();
});

test('hidden lazy HLS initialization never automatically starts segment loading', async () => {
  const fixture = componentFixture({ hidden: true, delayedImport: true });
  await fixture.render({ url: '/live.m3u8', hls: true, live: true });
  fixture.resolveImport();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(fixture.players[0].config.autoStartLoad, false);
  assert.equal(fixture.players[0].stopped, true);
  fixture.unmount();
});

test('StrictMode effect replay restores an MP4 source on the same DOM element', async () => {
  const fixture = componentFixture();
  const video = await fixture.render({ url: '/strict.mp4', onFail: () => {} });
  await fixture.replayEffects();
  assert.equal(fixture.video, video);
  assert.equal(video.children[0].src, '/strict.mp4');
  assert.equal(fixture.timers.size, 1);
  fixture.unmount();
  assert.equal(fixture.timers.size, 0);
});

test('StrictMode HLS effect replay destroys the first player before replacing it', async () => {
  const fixture = componentFixture();
  await fixture.render({ url: '/live.m3u8', hls: true, live: true });
  await fixture.replayEffects();
  assert.equal(fixture.players.length, 2);
  assert.equal(fixture.players[0].destroyed, true);
  assert.equal(fixture.players[1].destroyed, false);
  fixture.unmount();
  assert.equal(fixture.players[1].destroyed, true);
});

test('ordinary video pauses when hidden and source replacement preserves that policy', async () => {
  const fixture = componentFixture({ hidden: true });
  const first = await fixture.render({ url: '/one.mp4' });
  assert.equal(first.paused, true);
  assert.equal(first.autoplay, false);
  const second = await fixture.render({ url: '/two.mp4' });
  assert.equal(second.autoplay, false);
  fixture.document.hidden = false;
  fixture.document.dispatchEvent(new Event('visibilitychange'));
  assert.equal(second.paused, false);
  assert.equal(second.autoplay, true);
  fixture.unmount();
});

test('offline state changed during lazy HLS import is checked before starting segments', async () => {
  const fixture = componentFixture({ delayedImport: true });
  await fixture.render({ url: '/live.m3u8', hls: true, live: true });
  fixture.localStorage.setItem('offlineMode', 'true');
  fixture.EventBus.emit('refresh');
  fixture.resolveImport();
  await Promise.resolve();
  await Promise.resolve();
  assert.equal(fixture.players[0].stopped, true);
  assert.equal(fixture.players[0].config.autoStartLoad, false);
  fixture.unmount();
});

test('HLS manifest respects resolution cap and disables all subtitle tracks', async () => {
  const fixture = componentFixture();
  const video = await fixture.render({ url: '/live.m3u8', hls: true, live: true, maxHeight: 720 });
  const player = fixture.players[0];
  player.emit('manifest');
  assert.equal(player.currentLevel, 1);
  assert.equal(player.subtitleTrack, -1);
  assert.equal(video.textTracks.tracks[0].mode, 'disabled');
  fixture.unmount();
});

test('offline, hidden and resumed webcam cycles keep subscriptions bounded', async () => {
  const fixture = componentFixture();
  const video = await fixture.render({ url: '/live.m3u8', hls: true, live: true });
  const player = fixture.players[0];
  for (let i = 0; i < 100; i++) {
    fixture.document.hidden = true;
    fixture.document.dispatchEvent(new Event('visibilitychange'));
    assert.equal(player.stopped, true);
    assert.equal(video.paused, true);
    fixture.document.hidden = false;
    fixture.localStorage.setItem('offlineMode', 'true');
    fixture.EventBus.emit('refresh');
    assert.equal(player.stopped, true);
    fixture.localStorage.setItem('offlineMode', 'false');
    fixture.window.dispatchEvent(new Event('storage'));
    assert.equal(player.stopped, false);
    assert.equal(video.paused, false);
  }
  fixture.unmount();
  assert.equal(fixture.subscriptions, 0);
});

test('missing or stalled MP4 reports only once and cancels its watchdog', async () => {
  const fixture = componentFixture();
  let failures = 0;
  const video = await fixture.render({ url: '/stall.mp4', onFail: () => failures++ });
  video.dispatchEvent(new Event('error'));
  video.children[0].dispatchEvent(new Event('error'));
  fixture.fireTimers();
  assert.equal(failures, 1);
  fixture.unmount();
  assert.equal(fixture.timers.size, 0);
  assert.equal(video.listenerCount, 0);
});

test('decoded frame clears MP4 watchdog and unmount prevents late failure', async () => {
  const fixture = componentFixture();
  let failures = 0;
  const video = await fixture.render({ url: '/clip.mp4', onFail: () => failures++ });
  video.dispatchEvent(new Event('loadeddata'));
  assert.equal(fixture.timers.size, 0);
  fixture.unmount();
  video.dispatchEvent(new Event('error'));
  fixture.fireTimers();
  assert.equal(failures, 0);
});

test('200 MP4 mount/unmount cycles release timers and text track listeners', async () => {
  const fixture = componentFixture();
  for (let i = 0; i < 200; i++) {
    const video = await fixture.render({ url: `/clip-${i}.mp4`, onFail: () => {} });
    assert.equal(fixture.timers.size, 1);
    fixture.unmount();
    assert.equal(fixture.timers.size, 0);
    assert.equal(
      video.listenerCount + video.children[0].listenerCount + video.textTracks.listenerCount,
      0,
    );
  }
});

test('native HLS fallback source is released at unmount', async () => {
  const fixture = componentFixture({ supported: false });
  const video = await fixture.render({ url: '/native.m3u8', hls: true, live: true });
  assert.equal(video.src, '/native.m3u8');
  fixture.unmount();
  assert.equal(video.src, '');
  assert.ok(video.loads > 0);
});

test('memory assessment distinguishes stable allocation, leaks and playback peaks', () => {
  const samples = [100, 102, 101, 103].map((value) => ({
    resident: 300 * MiB,
    explicit: value * MiB,
    settled: true,
  }));
  samples.splice(2, 0, { resident: 1500 * MiB, explicit: 800 * MiB, settled: false });
  assert.deepEqual(assessMemory(samples).errors, []);
  const leaking = [100, 150, 200, 250].map((value) => ({
    resident: value * MiB,
    explicit: value * MiB,
    settled: true,
  }));
  assert.equal(assessMemory(leaking).errors.length, 2);
  assert.equal(assessMemory([{ resident: 4000 * MiB, explicit: 100 * MiB }]).errors.length, 2);
  assert.equal(slope([10, 20, 30]), 10);
});

test('memory gate fails closed on missing measurements and inadequate checkpoints', () => {
  assert.ok(assessMemory([]).errors.length);
  assert.ok(assessMemory([{ resident: 0, explicit: 0 }]).errors.length);
  assert.ok(assessMemory([{ resident: MiB, explicit: MiB, settled: true }]).errors.length);
});

test('resource gate catches retained decoders, player imbalance, blobs and listeners', () => {
  const clean = {
    players: 0,
    objectURLs: 0,
    videos: 0,
    overlays: 0,
    retiredVideosWithSource: 0,
    listeners: 2,
    createdPlayers: 5,
    destroyedPlayers: 5,
    errors: [],
  };
  assert.deepEqual(resourceErrors(clean, clean), []);
  const leaked = {
    ...clean,
    players: 1,
    objectURLs: 3,
    retiredVideosWithSource: 4,
    listeners: 3,
    destroyedPlayers: 4,
  };
  assert.equal(resourceErrors(leaked, clean).length, 5);
});
