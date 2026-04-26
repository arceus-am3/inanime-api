const { getCachedValue } = require('../cache/backend');

const ANILIST_API = 'https://graphql.anilist.co';
const REQUEST_HEADERS = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
  'User-Agent': 'Mozilla/5.0'
};

async function fetchAniList(query, variables = {}, options = {}) {
  const ttlMs = options.ttlMs || 5 * 60 * 1000;
  const refresh = Boolean(options.refresh);
  const cacheKey = `anilist:${JSON.stringify({ query, variables })}`;

  return getCachedValue(
    cacheKey,
    ttlMs,
    async () => {
      const response = await fetch(ANILIST_API, {
        method: 'POST',
        headers: REQUEST_HEADERS,
        body: JSON.stringify({ query, variables })
      });

      if (!response.ok) {
        throw new Error(`AniList request failed: ${response.status}`);
      }

      const payload = await response.json();
      if (payload.errors?.length) {
        throw new Error(payload.errors[0].message || 'AniList request failed');
      }

      return payload.data;
    },
    refresh
  );
}

module.exports = {
  fetchAniList
};
