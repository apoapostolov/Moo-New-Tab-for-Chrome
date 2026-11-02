import { fetchWithTimeout as fetch, settingsStamp, withLock, online } from 'utils/requests';
import variables from 'config/variables';
import { desiredBackgroundSource } from '../fallback';
import { getApiForBackgroundType } from '../options/optionTypes/getBackgroundOptionItems';
import { supportsAVIF } from './avifSupport';
import { getOfflineImage } from './offlineImage';
import { randomColourStyleBuilder } from './randomColour';
import videoCheck from './videoCheck';
import { fetchCoverrVideo } from './coverr';
import { fetchMixkitVideo } from './mixkit';
import { fetchPixabayVideo } from './pixabay';
import { fetchPexelsVideo } from './pexels';
import { fetchNasaVideo, fetchCommonsVideo } from './publicVideo';
import { getLiveBackground } from './live';
import { getRandomBackground } from 'utils/customBackgroundDB';

export const backgroundStamp = () =>
  desiredBackgroundSource() +
  settingsStamp(
    /^(background(Type|API|Exclude)|api|unsplash|pixabayKey|pexelsKey|nasaQuery|commonsQuery|coverrQuery|mixkitQuery|videoQuality|offlineMode|favourite|liveChannel|fallbackBackground|percentageFallbackBackground|focusFallbackBackground)/,
  );
const parseJSON = (key, fallback = null) => {
  const item = localStorage.getItem(key);
  if (item === null || item === 'null') {
    return fallback;
  }
  try {
    const parsed = JSON.parse(item);
    return parsed !== null ? parsed : fallback;
  } catch {
    return fallback;
  }
};

/** Null when no usable image comes back, so callers fall back to the offline image. */
export async function fetchAPIImageData(excludedPun = null, apiOverride = null) {
  const api = apiOverride || localStorage.getItem('backgroundAPI') || 'unsplash';
  const quality = localStorage.getItem('apiQuality') || 'high';
  const categories = parseJSON('apiCategories', localStorage.getItem('apiCategories'));
  const excludes = [...parseJSON('backgroundExclude', []), ...(excludedPun ? [excludedPun] : [])];

  const baseURL = `${variables.constants.API_URL}/images`;
  const collection = localStorage.getItem('unsplashCollections');
  const topics = localStorage.getItem('unsplashTopics');
  const excludeList = excludes.filter(Boolean).join(',');

  let url;
  if (api === 'unsplash' || api === 'pexels') {
    const params = new URLSearchParams({ quality });
    // A typed collection only applies when no topic is picked: Unsplash
    // intersects the two filters.
    if (topics) {
      params.set('topics', topics);
    } else if (collection) {
      params.set('collections', collection);
    }
    if (excludeList) {
      params.set('exclude', excludeList);
    }
    url = `${baseURL}/unsplash?${params.toString()}`;
  } else {
    const params = new URLSearchParams({ categories: categories || '', quality });
    if (excludeList) {
      params.set('exclude', excludeList);
    }
    url = `${baseURL}/random?${params.toString()}`;
  }

  try {
    const accept = `application/json, ${(await supportsAVIF()) ? 'image/avif' : 'image/webp'}`;

    // The library API answers 500 intermittently, so it is retried before the
    // offline image is used.
    let data = null;
    for (let attempt = 0; attempt < 3 && !data?.file; attempt++) {
      const response = await fetch(url, { headers: { accept } });
      data = await response.json().catch(() => null);
    }

    if (!data?.file) {
      throw new Error('The image API did not return a usable image');
    }

    const location = data.location ?? {};

    return {
      url: data.file,
      type: 'api',
      currentAPI: api,
      photoInfo: {
        hidden: false,
        id: data.id,
        api: api === 'pexels' ? 'unsplash' : api,
        category: data.category,
        credit: data.photographer,
        location: location.name,
        camera: data.camera,
        url: data.file,
        photographerURL: api === 'unsplash' ? data.photographer_page : undefined,
        photoURL: api === 'unsplash' ? data.photo_page : undefined,
        latitude: location.latitude,
        longitude: location.longitude,
        views: data.views,
        downloads: data.downloads,
        likes: data.likes ?? data.hearts,
        description: data.description,
        colour: data.colour,
        blur_hash: data.blur_hash,
        pun: data.pun,
      },
    };
  } catch (error) {
    console.error('Failed to fetch API image:', error);
    return null;
  }
}

async function getProviderBackground(type, fallback = false) {
  const isOffline = localStorage.getItem('offlineMode') === 'true';

  // A favourite overrides whatever source is configured.
  const fav = fallback ? null : parseJSON('favourite');
  if (fav) {
    if (fav.type === 'random_colour' || fav.type === 'random_gradient') {
      return { type: 'colour', style: `background:${fav.url}` };
    }
    return { url: fav.url, video: videoCheck(fav.url), photoInfo: { ...fav, url: fav.url } };
  }

  switch (type) {
    case 'api':
    case 'api_mue':
    case 'api_unsplash':
      return fallback
        ? isOffline
          ? getOfflineImage('api')
          : fetchAPIImageData(null, getApiForBackgroundType(type))
        : getAPIBackground(isOffline);

    case 'api_coverr':
      return getVideoBackground(isOffline, 'coverr', fetchCoverrVideo);

    case 'api_mixkit':
      return getVideoBackground(isOffline, 'mixkit', fetchMixkitVideo);

    case 'api_pixabay':
      return getVideoBackground(isOffline, 'pixabay', fetchPixabayVideo);

    case 'api_pexels':
      return getVideoBackground(isOffline, 'pexels', fetchPexelsVideo);

    case 'api_nasa':
      return getVideoBackground(isOffline, 'nasa', fetchNasaVideo);

    case 'api_commons':
      return getVideoBackground(isOffline, 'commons', fetchCommonsVideo);

    case 'api_live':
      return getLiveBackground(isOffline);

    case 'colour':
      return fallback
        ? {
            type: 'colour',
            style: `background: ${localStorage.getItem('fallbackBackgroundColour') || '#20242c'}`,
          }
        : getColourBackground();

    case 'random_colour':
    case 'random_gradient':
      return randomColourStyleBuilder(type);

    case 'custom':
      return await getCustomBackground(isOffline);

    case 'photo_pack':
      return getPhotoPackBackground(isOffline);

    default:
      return null;
  }
}

export async function getFallbackBackground(failedType) {
  const type = localStorage.getItem('fallbackBackgroundType');
  let data;
  if (type && type !== 'none' && type !== failedType) {
    try {
      data = await getProviderBackground(type, true);
    } catch {
      /* Bundled image is the final fallback. */
    }
  }
  return {
    ...(data?.url || data?.style ? data : getOfflineImage('api')),
    sourceRole: 'fallback',
    sourceSelection: desiredBackgroundSource(),
  };
}

export async function getBackgroundData() {
  const selection = desiredBackgroundSource();
  if (selection !== 'primary') return getFallbackBackground();
  const type = localStorage.getItem('backgroundType');
  let data;
  try {
    data = await getProviderBackground(type);
  } catch {
    /* Recover using the configured fallback. */
  }
  if ((!data?.url && !data?.style) || data?.photoInfo?.offline) return getFallbackBackground(type);
  return { ...data, sourceRole: 'primary', sourceSelection: selection };
}

function getColourBackground() {
  return {
    type: 'colour',
    style: `background: ${localStorage.getItem('customBackgroundColour') || 'rgb(0,0,0)'}`,
  };
}

/** Serves the prefetched queue first, then refills it in the background. */
async function getAPIBackgroundUnlocked(isOffline) {
  const stamp = backgroundStamp();
  const valid = () => online() && stamp === backgroundStamp();
  if (localStorage.getItem('imageQueueConfig') !== stamp) {
    localStorage.removeItem('imageQueue');
    localStorage.setItem('imageQueueConfig', stamp);
  }
  if (isOffline) return getOfflineImage('api');

  const cachedQueue = parseJSON('imageQueue', []);
  let data;

  if (cachedQueue.length > 0) {
    data = cachedQueue.shift();
    localStorage.setItem('imageQueue', JSON.stringify(cachedQueue));
  } else {
    data = await fetchAPIImageData();
  }

  if (!valid()) return null;
  if (!data) return getOfflineImage('api');

  localStorage.setItem('currentBackground', JSON.stringify(data));

  const targetQueueSize = 3;
  const currentQueueSize = cachedQueue.length;

  if (currentQueueSize < targetQueueSize) {
    // Unsplash photos have no pun, so their id is used to skip repeats.
    const imageKey = (image) => image?.photoInfo?.id ?? image?.photoInfo?.pun;
    const currentKey = imageKey(data);
    const excludedPuns = [currentKey, ...cachedQueue.map(imageKey).filter(Boolean)];

    Promise.all(
      Array.from({ length: targetQueueSize - currentQueueSize }, (_, i) =>
        fetchAPIImageData(excludedPuns[i] || currentKey),
      ),
    )
      .then((newImages) =>
        withLock('moo-background-queue', () => {
          if (!valid()) return;
          const validImages = newImages.filter(Boolean);
          if (validImages.length > 0) {
            const updatedQueue = [...parseJSON('imageQueue', []), ...validImages].slice(
              0,
              targetQueueSize,
            );
            localStorage.setItem('imageQueue', JSON.stringify(updatedQueue));
          }
        }),
      )
      .catch(() => {});
  }
  return data;
}
const getAPIBackground = (isOffline) =>
  withLock('moo-background-queue', () => getAPIBackgroundUnlocked(isOffline));

const VIDEO_QUEUE_KEY = 'videoQueue';
const VIDEO_QUEUE_SIZE = 2;
const VIDEO_WARMUP_BYTES = 1048576;

let videoRefillRunning = false;

const readVideoQueue = (api) =>
  parseJSON(VIDEO_QUEUE_KEY, []).filter((clip) => clip?.url && clip.currentAPI === api);

/**
 * Pulls the first megabyte so the connection is already open when the clip
 * becomes the background; the media element fetches whatever this misses.
 */
const warmVideo = (url) => {
  if (localStorage.getItem('offlineMode') === 'true') return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10000);
  (async () => {
    try {
      const response = await fetch(url, {
        headers: { Range: `bytes=0-${VIDEO_WARMUP_BYTES - 1}` },
        signal: controller.signal,
      });
      const reader = response.body?.getReader();
      if (!reader) return;
      let received = 0;
      try {
        while (received < VIDEO_WARMUP_BYTES) {
          const { done, value } = await reader.read();
          if (done) break;
          received += value.byteLength;
        }
      } finally {
        await reader.cancel();
      }
    } catch {
      // Warming is optional; playback can still load the direct URL.
    } finally {
      clearTimeout(timer);
    }
  })();
};

/**
 * Keeps a short queue of resolved clips so the next tab needs no API call.
 */
function refillVideoQueue(api, fetchVideo) {
  const stamp = backgroundStamp();
  if (videoRefillRunning) return;

  const queued = readVideoQueue(api);
  const missing = VIDEO_QUEUE_SIZE - queued.length;

  if (missing <= 0) {
    if (queued[0]) warmVideo(queued[0].url);
    return;
  }

  videoRefillRunning = true;

  // Sequential: each source records what it served, so parallel calls would
  // race on that list and could return the same clip twice.
  withLock('moo-background-queue', async () => {
    const fresh = [];

    for (let index = 0; index < missing; index++) {
      const clip = await fetchVideo();
      if (clip) fresh.push(clip);
    }

    if (!online() || stamp !== backgroundStamp()) return;
    const latest = readVideoQueue(api);
    const seen = new Set(latest.map((clip) => clip.photoInfo?.id));
    const merged = [...latest, ...fresh.filter((clip) => !seen.has(clip.photoInfo?.id))].slice(
      0,
      VIDEO_QUEUE_SIZE,
    );

    if (merged.length) {
      localStorage.setItem(VIDEO_QUEUE_KEY, JSON.stringify(merged));
      warmVideo(merged[0].url);
    }
  })
    .catch(() => {})
    .finally(() => {
      videoRefillRunning = false;
    });
}

async function getVideoBackgroundUnlocked(isOffline, api, fetchVideo) {
  const stamp = backgroundStamp();
  if (localStorage.getItem('videoQueueConfig') !== stamp) {
    localStorage.removeItem('videoQueue');
    localStorage.setItem('videoQueueConfig', stamp);
  }
  if (isOffline) return getOfflineImage('api');

  // A queued clip is used straight away, so no API round trip delays the new tab.
  const queue = readVideoQueue(api);
  let data = queue.shift();

  if (data) {
    localStorage.setItem(VIDEO_QUEUE_KEY, JSON.stringify(queue));
  } else {
    data = await fetchVideo();
  }

  if (!online() || stamp !== backgroundStamp()) return null;
  if (!data) return getOfflineImage('api');

  localStorage.setItem('currentBackground', JSON.stringify(data));

  refillVideoQueue(api, fetchVideo);

  return data;
}

const getVideoBackground = (offline, api, fetchVideo) =>
  withLock('moo-background-queue', () => getVideoBackgroundUnlocked(offline, api, fetchVideo));

async function getCustomBackground(isOffline) {
  let selected;
  try {
    selected = await getRandomBackground();
  } catch {
    return getOfflineImage('custom');
  }

  // Profiles that predate IndexedDB keep bare URLs in localStorage.
  if (!selected) {
    const urls = parseJSON('customBackground', []);
    if (urls && urls.length > 0) {
      selected = { url: urls[Math.floor(Math.random() * urls.length)] };
    }
  }

  if (!selected) return null;

  const url = selected.url || selected;

  if (isOffline && !url.startsWith('data:')) {
    return getOfflineImage('custom');
  }

  const data = {
    url,
    type: 'custom',
    video: videoCheck(url),
    photoInfo: {
      hidden: true,
      blur_hash: selected.blurHash || null,
    },
  };

  // Metadata only: image data would exceed the localStorage quota.
  try {
    localStorage.setItem(
      'currentBackground',
      JSON.stringify({
        type: 'custom',
        video: data.video,
        photoInfo: data.photoInfo,
      }),
    );
  } catch (e) {
    console.warn('Could not save currentBackground to localStorage:', e);
  }

  return data;
}

function getPhotoPackBackground(isOffline) {
  if (isOffline) return getOfflineImage('photo_pack');

  const photos = parseJSON('installed', []).flatMap((item) =>
    item.type === 'photos' && item.photos ? item.photos : [],
  );

  if (photos.length === 0) return null;

  const interval = localStorage.getItem('backgroundchange');
  const startTime = Number(localStorage.getItem('backgroundStartTime'));
  const shouldRefresh =
    !interval || interval === 'refresh' || startTime + Number(interval) < Date.now();

  let index;
  if (shouldRefresh) {
    index = Math.floor(Math.random() * photos.length);
    localStorage.setItem('marketplaceNumber', index);
  } else {
    index = Number(localStorage.getItem('marketplaceNumber')) || 0;
  }

  const photo = photos[index];

  return photo
    ? {
        url: photo.url.default,
        type: 'photo_pack',
        photoInfo: { hidden: false, credit: photo.photographer, location: photo.location },
      }
    : null;
}
