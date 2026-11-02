import EventBus from 'utils/eventbus';
import { useTranslationVersion } from 'contexts/TranslationContext';
import { memo, useEffect, useMemo, useRef } from 'react';

/* How long a clip gets to paint a frame, and how long a silence inside it counts as dead.
 * Twelve seconds is generous for a background clip; a file that is merely slow keeps sending
 * bytes, and a file that sends nothing for six seconds is not going to arrive. */
const FIRST_FRAME_MS = 12000;
const STALL_MS = 6000;

/** Firefox has no native HLS, so hls.js is imported only when a live background is used. */
function BackgroundVideo({ url, filterStyle, loop, muted, hls, live, maxHeight, onFail }) {
  useTranslationVersion();
  const videoRef = useRef(null);
  const playerRef = useRef(null);
  const sourceRef = useRef(null);
  const storedMute = useMemo(() => localStorage.getItem('backgroundVideoMute') === 'true', []);
  const storedLoop = useMemo(() => localStorage.getItem('backgroundVideoLoop') === 'true', []);

  // Plays muted and looping: an unmuted video is blocked by autoplay rules,
  // which would leave a black background.
  const isMuted = muted ?? storedMute;
  const shouldLoop = loop ?? (live ? false : storedLoop);

  // Removing a DOM node alone need not abort its download or release its decoder.
  // Capture this element: the ref already points at its replacement during cleanup.
  useEffect(() => {
    const video = videoRef.current;
    const source = sourceRef.current;
    if (!video) return undefined;

    // StrictMode replays effects on the same DOM node after cleaning it up.
    if (!hls && source) source.src = url;

    return () => {
      video.pause();
      video.removeAttribute('src');
      source?.removeAttribute('src');
      video.load();
    };
  }, [url, hls]);

  useEffect(() => {
    if (!hls || !url) return undefined;

    const video = videoRef.current;
    let player = null;
    let cancelled = false;

    (async () => {
      const { default: Hls } = await import('hls.js');
      if (cancelled || !video) return;

      if (!Hls.isSupported()) {
        video.src = url;
        return;
      }

      player = new Hls({
        // A blob worker would need the extension CSP widened; one stream does not need it.
        enableWorker: false,
        // Start explicitly after checking visibility. A manifest arriving after
        // stopLoad() would otherwise restart the default automatic loader.
        autoStartLoad: false,
        maxBufferLength: 10,
        maxMaxBufferLength: 15,
        maxBufferSize: 20 * 1024 * 1024,
        backBufferLength: 5,
        // Webcam channels ship a DEFAULT=YES caption rendition (timestamp,
        // location); subtitles would be drawn over the clock, so both switches
        // are off and nothing renders either way.
        subtitleDisplay: false,
        renderTextTracksNatively: false,
      });

      playerRef.current = player;
      player.loadSource(url);
      player.attachMedia(video);
      if (document.hidden || localStorage.getItem('offlineMode') === 'true') player.stopLoad();
      else player.startLoad(-1);

      // Chosen explicitly: the player measures the element before layout, so
      // letting hls.js pick by element size lands on the 360p level.
      player.on(Hls.Events.MANIFEST_PARSED, () => {
        const limit = maxHeight || 1080;
        let best = -1;
        let bestHeight = 0;

        player.levels.forEach((level, index) => {
          const height = level.height || 0;
          if (height && height <= limit && height >= bestHeight) {
            best = index;
            bestHeight = height;
          }
        });

        if (best >= 0) player.currentLevel = best;
      });

      player.on(Hls.Events.ERROR, (_event, data) => {
        if (data.fatal) console.warn('Live background failed:', data.type, data.details);
      });

      // Renditions can arrive after start-up, so every track is disabled again
      // whenever the list changes.
      const silence = () => {
        if (!player) return;
        if (player.subtitleTrack !== -1) player.subtitleTrack = -1;
        for (const track of video.textTracks) track.mode = 'disabled';
      };

      player.on(Hls.Events.SUBTITLE_TRACKS_UPDATED, silence);
      player.on(Hls.Events.MANIFEST_PARSED, silence);
    })();

    return () => {
      cancelled = true;
      if (player) player.destroy();
      playerRef.current = null;
    };
  }, [url, hls, maxHeight]);

  // Report failed clips once. Live streams use the HLS retry policy instead.
  useEffect(() => {
    const video = videoRef.current;
    const source = sourceRef.current;

    if (!video || !onFail || live) return undefined;

    let reported = false;
    let lastProgress = 0;

    const report = () => {
      if (reported) return;
      reported = true;
      onFail();
    };

    const settle = setTimeout(() => {
      // Nothing painted, and nothing has arrived for six seconds: the file is not late, it is
      // absent. A slow file that is still downloading keeps its place.
      const stalled = !lastProgress || Date.now() - lastProgress > STALL_MS;

      if (video.readyState < 2 && stalled) report();
    }, FIRST_FRAME_MS);

    const painted = () => clearTimeout(settle);
    const progress = () => {
      lastProgress = Date.now();
    };

    video.addEventListener('error', report);
    video.addEventListener('loadeddata', painted);
    video.addEventListener('progress', progress);
    source?.addEventListener('error', report);

    return () => {
      clearTimeout(settle);
      video.removeEventListener('error', report);
      video.removeEventListener('loadeddata', painted);
      video.removeEventListener('progress', progress);
      source?.removeEventListener('error', report);
    };
  }, [url, live, onFail]);

  // Park downloads and playback while the background cannot be seen.
  useEffect(() => {
    const onVisibility = () => {
      const video = videoRef.current;
      if (!video) return;

      if (document.hidden || localStorage.getItem('offlineMode') === 'true') {
        video.autoplay = false;
        playerRef.current?.stopLoad();
        video.pause();
      } else {
        video.autoplay = true;
        playerRef.current?.startLoad(-1);
        video.play().catch(() => {});
      }
    };

    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);
    EventBus.on('refresh', onVisibility);
    window.addEventListener('storage', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      EventBus.off('refresh', onVisibility);
      window.removeEventListener('storage', onVisibility);
    };
  }, [url, live]);

  // An MP4 can carry a subtitle track and `<video>` will show it, so every
  // track is disabled on load and on each new one, whatever the source.
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return undefined;

    const disableTextTracks = () => {
      for (const track of video.textTracks) track.mode = 'disabled';
    };

    disableTextTracks();
    video.addEventListener('loadedmetadata', disableTextTracks);
    video.textTracks.addEventListener('addtrack', disableTextTracks);

    return () => {
      video.removeEventListener('loadedmetadata', disableTextTracks);
      video.textTracks.removeEventListener('addtrack', disableTextTracks);
    };
  }, [url, hls]);

  // Keyed by the address: a <video> that has failed does not restart resource selection when
  // its <source> changes, so a replacement clip would sit there silently. A new element does.
  return (
    <video
      key={url}
      ref={videoRef}
      autoPlay
      muted={isMuted}
      loop={shouldLoop}
      playsInline
      style={filterStyle}
      id="backgroundVideo"
    >
      {!hls && <source ref={sourceRef} src={url} />}
    </video>
  );
}

export default memo(BackgroundVideo);
