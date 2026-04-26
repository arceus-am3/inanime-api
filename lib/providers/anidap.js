const { getCachedValue } = require('../cache/backend');

const ANIDAP_BASE_URL = 'https://anidap.se';
const ANIDAP_API_URL = `${ANIDAP_BASE_URL}/api/anime`;
const ANIDAP_CORS_BASE_URL = 'https://cors.otakuhg.site';
const ANIDAP_STREAM_ORIGIN = 'https://otakuhg.site/';
const REQUEST_HEADERS = {
  'User-Agent': 'Mozilla/5.0',
  Accept: 'application/json, text/plain, */*',
  'Accept-Language': 'en-US,en;q=0.9',
  Origin: ANIDAP_BASE_URL,
  Referer: `${ANIDAP_BASE_URL}/`
};

async function fetchJson(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

async function fetchText(url) {
  const response = await fetch(url, { headers: REQUEST_HEADERS });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.text();
}

function extractAnidapSlug(html) {
  const exactMatch = html.match(
    /currentUrl\\",\\"https?:\/\/anidap\.se\/watch\?id=[^"]+\\",\\"id\\",\\"([^"]+)\\",\\"slug\\"/
  );

  if (exactMatch?.[1]) {
    return exactMatch[1];
  }

  const fallbackMatch = html.match(/\\"id\\",\\"([a-z0-9-]+)\\",\\"slug\\"/i);
  if (fallbackMatch?.[1]) {
    return fallbackMatch[1];
  }

  throw new Error('Could not extract Anidap slug');
}

function normalizeProviderLists(data = {}) {
  return {
    subProviders: Array.isArray(data.subProviders) ? data.subProviders : [],
    dubProviders: Array.isArray(data.dubProviders) ? data.dubProviders : []
  };
}

function buildAnidapMediaUrl(pathOrToken) {
  const baseUrl = pathOrToken.startsWith('http')
    ? new URL(pathOrToken)
    : new URL(`/media/${pathOrToken}`, ANIDAP_CORS_BASE_URL);

  if (!baseUrl.searchParams.has('origin')) {
    baseUrl.searchParams.set('origin', ANIDAP_STREAM_ORIGIN);
  }

  return baseUrl.toString();
}

function parseQualityName(metadataLine = '') {
  const nameMatch = metadataLine.match(/NAME="([^"]+)"/i);
  if (nameMatch?.[1]) {
    return nameMatch[1];
  }

  const resolutionMatch = metadataLine.match(/RESOLUTION=\d+x(\d+)/i);
  if (resolutionMatch?.[1]) {
    return `${resolutionMatch[1]}p`;
  }

  return 'auto';
}

async function fetchAnidapPlaylist(masterUrl) {
  const playlistText = await fetchText(masterUrl);
  const lines = playlistText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

  const sources = [];

  for (let index = 0; index < lines.length; index += 1) {
    if (!lines[index].startsWith('#EXT-X-STREAM-INF')) {
      continue;
    }

    const nextLine = lines[index + 1];
    if (!nextLine || nextLine.startsWith('#')) {
      continue;
    }

    sources.push({
      url: buildAnidapMediaUrl(nextLine),
      quality: parseQualityName(lines[index])
    });
  }

  return {
    playlistText,
    sources
  };
}

async function fetchAnidapSlug(id, refresh = false) {
  const cacheKey = `anidap:slug:${id}`;

  return getCachedValue(
    cacheKey,
    30 * 24 * 60 * 60 * 1000,
    async () => {
      const html = await fetchText(
        `${ANIDAP_BASE_URL}/watch?id=${encodeURIComponent(String(id))}&ep=1&type=sub&provider=gogo`
      );

      return extractAnidapSlug(html);
    },
    refresh
  );
}

async function fetchAnidapServers(id, episode, refresh = false) {
  const slug = await fetchAnidapSlug(id, refresh);
  const cacheKey = `anidap:servers:${slug}:${episode}`;

  return getCachedValue(
    cacheKey,
    10 * 60 * 1000,
    async () => {
      const payload = await fetchJson(
        `${ANIDAP_API_URL}/servers?id=${encodeURIComponent(slug)}&ep=${encodeURIComponent(String(episode))}`
      );

      if (!payload?.success || !payload.data) {
        throw new Error('Anidap servers not found');
      }

      return normalizeProviderLists(payload.data);
    },
    refresh
  );
}

async function fetchAnidapSources(id, episode, host, type, refresh = false) {
  const slug = await fetchAnidapSlug(id, refresh);
  const cacheKey = `anidap:sources:${slug}:${episode}:${host}:${type}`;

  return getCachedValue(
    cacheKey,
    2 * 60 * 1000,
    async () => {
      const payload = await fetchJson(
        `${ANIDAP_API_URL}/sources?id=${encodeURIComponent(slug)}&ep=${encodeURIComponent(String(episode))}&host=${encodeURIComponent(host)}&type=${encodeURIComponent(type)}`
      );

      if (!payload?.success || !payload.data) {
        throw new Error('Anidap source token not found');
      }

      const masterUrl = buildAnidapMediaUrl(payload.data);
      const playlistData = await fetchAnidapPlaylist(masterUrl);

      return {
        sources: [
          { url: masterUrl, quality: 'auto' },
          ...playlistData.sources
        ],
        subtitles: [],
        thumbnails: [],
        headers: {
          Referer: `${ANIDAP_BASE_URL}/`
        }
      };
    },
    refresh
  );
}

module.exports = {
  fetchAnidapServers,
  fetchAnidapSources
};
