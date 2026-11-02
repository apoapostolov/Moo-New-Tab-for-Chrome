import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

// Use the compiler owned by the existing Vite React plugin, including when its
// dependencies are nested rather than hoisted into the repository root.
const { transformSync } = createRequire(import.meta.resolve('@vitejs/plugin-react-swc'))(
  '@swc/core',
);

class Target extends EventTarget {
  listeners = new Map();
  addEventListener(type, callback, options) {
    if (!callback) return;
    const key = `${type}:${Boolean(typeof options === 'boolean' ? options : options?.capture)}`;
    if (!this.listeners.has(key)) this.listeners.set(key, new Set());
    this.listeners.get(key).add(callback);
    super.addEventListener(type, callback, options);
  }
  removeEventListener(type, callback, options) {
    const key = `${type}:${Boolean(typeof options === 'boolean' ? options : options?.capture)}`;
    this.listeners.get(key)?.delete(callback);
    super.removeEventListener(type, callback, options);
  }
  get listenerCount() {
    return [...this.listeners.values()].reduce((sum, values) => sum + values.size, 0);
  }
}

class Video extends Target {
  paused = true;
  readyState = 0;
  src = '';
  currentSrc = '';
  loads = 0;
  children = [];
  textTracks = Object.assign(new Target(), {
    [Symbol.iterator]: function* () {
      yield* this.tracks;
    },
    tracks: [{ mode: 'showing' }],
  });
  play() {
    this.paused = false;
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
  load() {
    this.loads++;
    this.currentSrc = this.src || this.children.find((child) => child.src)?.src || '';
    this.readyState = 0;
  }
  removeAttribute(name) {
    if (name === 'src') this.src = '';
  }
  querySelectorAll(selector) {
    return selector === 'source' ? this.children : [];
  }
}

const original = readFileSync(
  new URL('../../src/features/background/components/BackgroundVideo.jsx', import.meta.url),
  'utf8',
);
const stripped = original
  .replace(/^import[\s\S]*?;\r?\n/gm, '')
  .replace("import('hls.js')", 'loadHls()')
  .replace('export default memo(BackgroundVideo);', '');
const { code } = transformSync(stripped, {
  jsc: {
    target: 'es2022',
    parser: { syntax: 'ecmascript', jsx: true },
    transform: { react: { runtime: 'classic', pragma: '__jsx' } },
  },
});
const instantiate = new Function(
  'useEffect',
  'useRef',
  'useMemo',
  'memo',
  'useTranslationVersion',
  'EventBus',
  'loadHls',
  'localStorage',
  'document',
  'window',
  'setTimeout',
  'clearTimeout',
  '__jsx',
  code + '\nreturn memo(BackgroundVideo);',
);

// A deterministic effect/ref driver, not a substitute for the real React/Gecko suite.
// It executes the production component's effects against controlled media and HLS APIs.
export function componentFixture({ delayedImport = false, supported = true, hidden = false } = {}) {
  const document = Object.assign(new Target(), { hidden });
  const window = new Target();
  const storage = new Map([
    ['backgroundVideoMute', 'true'],
    ['backgroundVideoLoop', 'true'],
  ]);
  const localStorage = {
    getItem: (key) => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
  };
  const subscriptions = new Map();
  const EventBus = {
    on(event, callback) {
      if (!subscriptions.has(event)) subscriptions.set(event, new Set());
      subscriptions.get(event).add(callback);
    },
    off(event, callback) {
      subscriptions.get(event)?.delete(callback);
    },
    emit(event) {
      for (const callback of subscriptions.get(event) || []) callback();
    },
  };
  const players = [];
  class Hls {
    static Events = {
      MANIFEST_PARSED: 'manifest',
      ERROR: 'error',
      SUBTITLE_TRACKS_UPDATED: 'subtitles',
    };
    static isSupported = () => supported;
    levels = [{ height: 360 }, { height: 720 }, { height: 1080 }, { height: 2160 }];
    handlers = new Map();
    stopped = false;
    destroyed = false;
    constructor(config) {
      this.config = config;
      players.push(this);
    }
    loadSource(url) {
      this.url = url;
    }
    attachMedia(video) {
      this.media = video;
      video.src = 'blob:hls-fixture';
      video.currentSrc = video.src;
    }
    on(event, callback) {
      const list = this.handlers.get(event) || [];
      list.push(callback);
      this.handlers.set(event, list);
    }
    emit(event, data) {
      for (const callback of this.handlers.get(event) || []) callback(event, data);
    }
    startLoad() {
      this.stopped = false;
    }
    stopLoad() {
      this.stopped = true;
    }
    destroy() {
      this.destroyed = true;
      this.handlers.clear();
      this.media?.removeAttribute('src');
      this.media = null;
    }
  }
  let resolveImport;
  const importResult = delayedImport
    ? new Promise((resolve) => (resolveImport = () => resolve({ default: Hls })))
    : Promise.resolve({ default: Hls });
  const slots = [];
  let cursor = 0;
  let effects = [];
  const timers = new Map();
  let timerId = 0;
  let current;
  const videos = [];
  const useRef = (initial) => {
    const index = cursor++;
    return (slots[index] ||= { current: initial });
  };
  const useMemo = (factory) => {
    const index = cursor++;
    if (!slots[index]) slots[index] = { value: factory() };
    return slots[index].value;
  };
  const useEffect = (callback, deps) => {
    const index = cursor++;
    const slot = slots[index];
    if (!slot || deps.some((value, i) => !Object.is(value, slot.deps[i])))
      effects.push({ index, callback, deps });
  };
  const jsx = (type, props, ...children) => ({ type, props, children });
  const Component = instantiate(
    useEffect,
    useRef,
    useMemo,
    (component) => component,
    () => {},
    EventBus,
    () => importResult,
    localStorage,
    document,
    window,
    (callback, delay) => {
      const id = ++timerId;
      timers.set(id, { callback, delay });
      return id;
    },
    (id) => timers.delete(id),
    jsx,
  );
  return {
    document,
    window,
    localStorage,
    EventBus,
    players,
    videos,
    timers,
    get video() {
      return current?.video;
    },
    get subscriptions() {
      return [...subscriptions.values()].reduce((sum, entries) => sum + entries.size, 0);
    },
    resolveImport: () => resolveImport?.(),
    async render(props) {
      cursor = 0;
      effects = [];
      const element = Component(props);
      const same = current?.key === element.props.key;
      const video = same ? current.video : new Video();
      if (!same) videos.push(video);
      video.children = element.children.filter(Boolean).map((child) =>
        Object.assign(new Target(), {
          src: child.props.src,
          removeAttribute(name) {
            if (name === 'src') this.src = '';
          },
        }),
      );
      element.props.ref.current = video;
      if (element.children[0]?.props?.ref)
        element.children[0].props.ref.current = video.children[0];
      current = { key: element.props.key, video };
      for (const effect of effects) slots[effect.index]?.cleanup?.();
      for (const effect of effects)
        slots[effect.index] = {
          deps: effect.deps,
          callback: effect.callback,
          cleanup: effect.callback(),
        };
      await Promise.resolve();
      await Promise.resolve();
      return video;
    },
    async replayEffects() {
      for (const slot of slots) slot?.cleanup?.();
      for (const slot of slots) if (slot?.callback) slot.cleanup = slot.callback();
      await Promise.resolve();
      await Promise.resolve();
    },
    unmount() {
      for (const slot of slots) slot?.cleanup?.();
      slots.length = 0;
      current = null;
    },
    fireTimers() {
      for (const [id, timer] of [...timers]) {
        timers.delete(id);
        timer.callback();
      }
    },
  };
}
