const { getCachedValue } = require('../cache/backend');

const ANIKAGE_API = 'https://anikage.cc/api/anime';
const ANIKAGE_TOKEN = 'x9f2k7m4q1w8e3r6t5y0';
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json'
};

function xorEncode(input) {
  const data = new TextEncoder().encode(input);
  const key = new TextEncoder().encode(ANIKAGE_TOKEN);
  const output = new Uint8Array(data.length);

  for (let i = 0; i < data.length; i += 1) {
    output[i] = data[i] ^ key[i % key.length];
  }

  return Buffer.from(output)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function encodePayload(payload) {
  return xorEncode(JSON.stringify({
    ...payload,
    _t: String(Math.floor(Date.now() / 1000))
  }));
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchAnikageEpisodes(id, refresh = false) {
  const token = encodePayload({
    id: String(id),
    refresh: refresh ? 'true' : 'false'
  });
  const cacheKey = `anikage:episodes:${id}`;

  return getCachedValue(
    cacheKey,
    10 * 60 * 1000,
    () => fetchJson(`${ANIKAGE_API}/episodes/${token}`),
    refresh
  );
}

async function fetchAnikageSources(id, episode, host, type, refresh = false) {
  const token = encodePayload({
    id: String(id),
    host,
    epNum: String(episode),
    type,
    cache: refresh ? 'false' : 'true'
  });
  const cacheKey = `anikage:sources:${id}:${episode}:${host}:${type}`;

  return getCachedValue(
    cacheKey,
    2 * 60 * 1000,
    () => fetchJson(`${ANIKAGE_API}/sources/${token}`),
    refresh
  );
}

function normalizeEpisodeItem(item) {
  return {
    number: Number(item.number),
    title: item.title || null,
    description: item.description || null,
    img: item.img || null,
    isFiller: Boolean(item.isFiller),
    hasSub: Array.isArray(item.subProviders) && item.subProviders.length > 0,
    hasDub: Array.isArray(item.dubProviders) && item.dubProviders.length > 0,
    subProviders: item.subProviders || [],
    dubProviders: item.dubProviders || []
  };
}

function normalizeEpisodeList(episodes = []) {
  return episodes.map(normalizeEpisodeItem);
}

function summarizeProviders(episodes = []) {
  const subProviders = new Set();
  const dubProviders = new Set();

  for (const episode of episodes) {
    for (const provider of episode.subProviders || []) {
      subProviders.add(provider);
    }

    for (const provider of episode.dubProviders || []) {
      dubProviders.add(provider);
    }
  }

  return {
    hasSub: subProviders.size > 0,
    hasDub: dubProviders.size > 0,
    subProviders: [...subProviders],
    dubProviders: [...dubProviders]
  };
}

function pickHost(currentEpisode, requestedHost, type) {
  const providers = type === 'dub'
    ? (currentEpisode?.dubProviders || [])
    : (currentEpisode?.subProviders || []);

  if (requestedHost && providers.includes(requestedHost)) {
    return requestedHost;
  }

  if (providers.includes('pahe')) {
    return 'pahe';
  }

  if (providers.includes('gogo')) {
    return 'gogo';
  }

  return providers[0] || null;
}

module.exports = {
  fetchAnikageEpisodes,
  fetchAnikageSources,
  normalizeEpisodeList,
  pickHost,
  summarizeProviders
};
