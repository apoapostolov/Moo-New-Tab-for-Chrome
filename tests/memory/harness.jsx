import { StrictMode, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import Hls from 'hls.js';
import BackgroundVideo from '../../src/features/background/components/BackgroundVideo';
import Background from '../../src/features/background/Background';
import App from '../../src/App';
import { useBackgroundRenderer } from '../../src/features/background/hooks/useBackgroundRenderer';
import EventBus from '../../src/utils/eventbus';
import { selectLanguage } from '../../src/lib/translations';
import variables from '../../src/config/variables';
import { moveSettings } from '../../src/utils/settings/move';
import { migrateScratchAssets } from '../../src/utils/customBackgroundDB';
import Modal from 'react-modal';
import { WIDGETS } from '../../src/utils/widgets';
import '../../src/scss/index.scss';
import 'react-toastify/dist/ReactToastify.css';

// Instrument only resources owned by this fixture. Weak references never pin retired DOM.
const videos = [];
const objectURLs = new Set();
const players = new Set();
const counters = { createdPlayers: 0, destroyedPlayers: 0, failures: 0, errors: [] };
const nativeCreate = document.createElement.bind(document);
document.createElement = function (name, ...args) {
  const element = nativeCreate(name, ...args);
  if (name === 'video') videos.push(new WeakRef(element));
  return element;
};
const createURL = URL.createObjectURL.bind(URL);
const revokeURL = URL.revokeObjectURL.bind(URL);
URL.createObjectURL = (blob) => {
  const url = createURL(blob);
  objectURLs.add(url);
  return url;
};
URL.revokeObjectURL = (url) => {
  objectURLs.delete(url);
  revokeURL(url);
};
const attach = Hls.prototype.attachMedia;
const destroy = Hls.prototype.destroy;
Hls.prototype.attachMedia = function (...args) {
  if (!players.has(this)) counters.createdPlayers++;
  players.add(this);
  return attach.apply(this, args);
};
Hls.prototype.destroy = function (...args) {
  if (players.delete(this)) counters.destroyedPlayers++;
  return destroy.apply(this, args);
};
window.addEventListener('error', (event) => counters.errors.push(String(event.message)));
window.addEventListener('unhandledrejection', (event) =>
  counters.errors.push(String(event.reason)),
);
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const root = createRoot(document.getElementById('root'));
let strict = false;
const onFail = () => counters.failures++;
const draw = (element) =>
  flushSync(() => root.render(strict ? <StrictMode>{element}</StrictMode> : element));
function ImageFixture({ url }) {
  useBackgroundRenderer({ url, video: false, photoInfo: null }, onFail);
  return <div id="backgroundImage" />;
}
function Mounted({ children }) {
  useEffect(() => {
    window.memoryMounted = true;
    return () => {
      window.memoryMounted = false;
    };
  }, []);
  return children;
}

moveSettings();
for (const widget of WIDGETS) {
  // Exercise the real App with local clock/date/search widgets. Remote account
  // widgets would introduce unrelated downloads into the background measurements.
  if (!['time', 'date', 'aiask', 'quicklinks'].includes(widget.id))
    localStorage.setItem(widget.setting, 'false');
}
Object.entries({
  background: true,
  backgroundVideoMute: true,
  backgroundVideoLoop: true,
  backgroundType: 'colour',
  customBackgroundColour: '#20242c',
  animations: false,
  language: 'en_GB',
  offlineMode: false,
  bgtransition: true,
}).forEach(([key, value]) => localStorage.setItem(key, String(value)));
await migrateScratchAssets();
const translation = await selectLanguage('en_GB');
variables.language = translation.instance;
variables.languagecode = translation.language;
variables.getMessage = (text, optional) =>
  translation.instance.getMessage(translation.language, text, optional || {});
Modal.setAppElement(document.getElementById('root'));

window.memorySuite = {
  strict(value) {
    strict = value;
  },
  async clear() {
    draw(null);
    localStorage.setItem('offlineMode', 'false');
    localStorage.setItem('background', 'true');
    await sleep(80);
  },
  async video(file = '720.mp4', options = {}) {
    draw(<BackgroundVideo url={`/media/${file}`} muted loop onFail={onFail} {...options} />);
    await sleep(80);
  },
  async image(index) {
    draw(<ImageFixture url={`/media/large.jpg?n=${index}`} />);
    await sleep(100);
  },
  async fullApp() {
    draw(
      <Mounted>
        <App />
      </Mounted>,
    );
    await sleep(250);
  },
  async background() {
    draw(<Background />);
    await sleep(100);
  },
  async source(file, live = false) {
    localStorage.setItem('offlineMode', 'false');
    localStorage.removeItem('favourite');
    localStorage.setItem('backgroundType', live ? 'api_live' : 'custom');
    localStorage.setItem('backgroundAPI', live ? 'live' : 'unsplash');
    localStorage.setItem('customBackground', JSON.stringify([`${location.origin}/media/${file}`]));
    // Use the same live channel storage path as Settings.
    if (live) {
      const { saveChannels } = await import('../../src/features/background/api/live');
      saveChannels([
        {
          id: 'fixture',
          name: 'Local webcam fixture',
          url: `${location.origin}/media/${file}`,
          maxHeight: 1080,
        },
      ]);
      localStorage.setItem('liveChannel', 'fixture');
    }
    EventBus.emit('refresh', 'backgroundsource');
    await sleep(100);
  },
  async enabled(value) {
    localStorage.setItem('background', String(value));
    EventBus.emit('refresh', 'background');
    await sleep(100);
  },
  async offline(value) {
    localStorage.setItem('offlineMode', String(value));
    EventBus.emit('refresh', 'offlineMode');
    await sleep(100);
  },
  async playing(timeout = 15000) {
    const deadline = Date.now() + timeout;
    const initialTime = document.querySelector('video')?.currentTime;
    while (Date.now() < deadline) {
      const video = document.querySelector('video');
      if (
        video?.readyState >= 2 &&
        !video.paused &&
        video.videoWidth > 0 &&
        video.currentTime !== initialTime
      )
        return true;
      await sleep(100);
    }
    throw new Error(`No decoded video frame: ${JSON.stringify(this.snapshot())}`);
  },
  snapshot() {
    const retained = videos.map((ref) => ref.deref()).filter(Boolean);
    const current = document.querySelector('video');
    const buffers = current
      ? Array.from({ length: current.buffered.length }, (_, i) => ({
          start: current.buffered.start(i),
          end: current.buffered.end(i),
        }))
      : [];
    return {
      players: players.size,
      objectURLs: objectURLs.size,
      // currentSrc can continue to expose the last selected URL after a
      // detached element has had its source attributes removed and load() has
      // reset resource selection. Count retained source ownership here. The
      // fixture server separately detects requests that remain active.
      retiredVideosWithSource: retained.filter(
        (video) =>
          !video.isConnected &&
          (video.hasAttribute('src') ||
            Array.from(video.querySelectorAll('source')).some((source) =>
              source.hasAttribute('src'),
            )),
      ).length,
      videos: document.querySelectorAll('video').length,
      overlays: document.querySelectorAll('#backgroundOverlay').length,
      listeners: Object.values(EventBus.listeners).reduce(
        (sum, entries) => sum + entries.length,
        0,
      ),
      bufferedSeconds: buffers.reduce((sum, range) => sum + range.end - range.start, 0),
      width: current?.videoWidth || 0,
      height: current?.videoHeight || 0,
      paused: current?.paused ?? true,
      hidden: document.hidden,
      ...counters,
    };
  },
};
