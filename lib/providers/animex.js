const { getCachedValue } = require('../cache/backend');

const ANIMEX_BASE_URL = 'https://animex.one';
const ANIMEX_API_URL = 'https://pp.animex.one/rest/api';
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json, text/html;q=0.9,*/*;q=0.8'
};

async function fetchText(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.text();
}

async function fetchJson(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function slugifyTitle(value = '') {
  return String(value)
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');
}

function buildAnimexPageCandidates(id, titleData = {}) {
  const rawTitles = [
    titleData.english,
    titleData.romaji,
    titleData.native
  ].filter(Boolean);

  const uniqueSlugs = [...new Set(rawTitles.map(slugifyTitle).filter(Boolean))];
  return uniqueSlugs.map((slug) => `${ANIMEX_BASE_URL}/anime/${slug}-${id}`);
}

function extractAnimexSlug(html) {
  const matches = [
    html.match(/\bslug:"([^"]+)"/),
    html.match(/"slug":"([^"]+)"/),
    html.match(/slug:\s*"([^"]+)"/)
  ];

  for (const match of matches) {
    if (match?.[1]) {
      return match[1];
    }
  }

  throw new Error('Could not extract Animex slug');
}

async function fetchAnimexContext(id, titleData, refresh = false) {
  const cacheKey = `animex:context:${id}`;

  return getCachedValue(
    cacheKey,
    30 * 24 * 60 * 60 * 1000,
    async () => {
      const candidates = buildAnimexPageCandidates(id, titleData);

      if (candidates.length === 0) {
        throw new Error('Animex title candidates not found');
      }

      let lastError = null;

      for (const candidateUrl of candidates) {
        try {
          const html = await fetchText(candidateUrl);
          return {
            url: candidateUrl,
            slug: extractAnimexSlug(html)
          };
        } catch (error) {
          lastError = error;
        }
      }

      throw lastError || new Error('Animex page not found');
    },
    refresh
  );
}

async function fetchAnimexEpisodes(id, titleData, refresh = false) {
  const context = await fetchAnimexContext(id, titleData, refresh);
  const cacheKey = `animex:episodes:${context.slug}`;

  return getCachedValue(
    cacheKey,
    15 * 60 * 1000,
    () => fetchJson(`${ANIMEX_API_URL}/episodes?id=${encodeURIComponent(context.slug)}`),
    refresh
  );
}

async function fetchAnimexServers(id, titleData, episode = 1, refresh = false) {
  const context = await fetchAnimexContext(id, titleData, refresh);
  const cacheKey = `animex:servers:${context.slug}:${episode}`;

  return getCachedValue(
    cacheKey,
    10 * 60 * 1000,
    async () => normalizeAnimexServerLists(
      await fetchJson(`${ANIMEX_API_URL}/servers?id=${encodeURIComponent(context.slug)}&epNum=${encodeURIComponent(String(episode))}`)
    ),
    refresh
  );
}

async function fetchAnimexSources(id, titleData, episode, providerId, type, refresh = false) {
  const context = await fetchAnimexContext(id, titleData, refresh);
  const cacheKey = `animex:sources:${context.slug}:${episode}:${providerId}:${type}`;

  return getCachedValue(
    cacheKey,
    5 * 60 * 1000,
    async () => normalizeAnimexSources(
      await fetchJson(
        `${ANIMEX_API_URL}/sources?id=${encodeURIComponent(context.slug)}&epNum=${encodeURIComponent(String(episode))}&type=${encodeURIComponent(type)}&providerId=${encodeURIComponent(providerId)}`
      )
    ),
    refresh
  );
}

function normalizeAnimexEpisodeItem(item = {}) {
  return {
    number: Number(item.number),
    hasSub: Boolean(item.hasSub),
    hasDub: Boolean(item.hasDub)
  };
}

function normalizeAnimexServerItem(item = {}) {
  return {
    id: item.id || null,
    default: Boolean(item.default),
    tip: item.tip || null
  };
}

function normalizeAnimexServerLists(servers = {}) {
  return {
    subProviders: Array.isArray(servers.subProviders)
      ? servers.subProviders.map(normalizeAnimexServerItem).filter((item) => item.id)
      : [],
    dubProviders: Array.isArray(servers.dubProviders)
      ? servers.dubProviders.map(normalizeAnimexServerItem).filter((item) => item.id)
      : []
  };
}

function normalizeAnimexEpisodeList(episodes = []) {
  return episodes
    .map(normalizeAnimexEpisodeItem)
    .filter((item) => Number.isFinite(item.number) && item.number > 0);
}

function normalizeAnimexSources(payload = {}) {
  const sources = Array.isArray(payload.sources)
    ? payload.sources
        .filter((item) => item?.url)
        .map((item) => ({
          url: item.url,
          quality: item.quality || 'auto'
        }))
    : [];

  const subtitles = Array.isArray(payload.tracks)
    ? payload.tracks
        .filter((item) => item?.file)
        .map((item) => ({
          url: item.file,
          lang: item.label || item.lang || 'Unknown'
        }))
    : [];

  return {
    sources,
    subtitles,
    thumbnails: [],
    headers: payload.headers || {
      Referer: 'https://vibeplayer.site/',
      'User-Agent': REQUEST_HEADERS['User-Agent']
    }
  };
}

function pickAnimexProvider(servers = {}, requestedProvider, type) {
  const normalizedServers = normalizeAnimexServerLists(servers);
  const providers = type === 'dub'
    ? normalizedServers.dubProviders
    : normalizedServers.subProviders;

  if (requestedProvider) {
    const matched = providers.find((item) => item.id === requestedProvider);
    if (matched) {
      return matched.id;
    }
  }

  const defaultProvider = providers.find((item) => item.default);
  if (defaultProvider) {
    return defaultProvider.id;
  }

  return providers[0]?.id || null;
}

function summarizeAnimexData(episodes = [], servers = {}) {
  const normalizedEpisodes = normalizeAnimexEpisodeList(episodes);
  const currentEpisodeCount = normalizedEpisodes.length
    ? Math.max(...normalizedEpisodes.map((item) => item.number))
    : null;

  return {
    currentEpisodeCount,
    hasSub: normalizedEpisodes.some((item) => item.hasSub),
    hasDub: normalizedEpisodes.some((item) => item.hasDub),
    subProviders: normalizeAnimexServerLists(servers).subProviders.map((item) => item.id),
    dubProviders: normalizeAnimexServerLists(servers).dubProviders.map((item) => item.id)
  };
}

module.exports = {
  fetchAnimexEpisodes,
  fetchAnimexServers,
  fetchAnimexSources,
  normalizeAnimexEpisodeList,
  normalizeAnimexServerLists,
  summarizeAnimexData,
  pickAnimexProvider
};
