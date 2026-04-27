const localCacheStore = globalThis.__inanimeLocalCacheStore || new Map();
const inflightStore = globalThis.__inanimeInflightStore || new Map();
const { getEnv } = require('../runtime/env');

globalThis.__inanimeLocalCacheStore = localCacheStore;
globalThis.__inanimeInflightStore = inflightStore;

function getUpstashConfig() {
  const url = getEnv('UPSTASH_REDIS_REST_URL');
  const token = getEnv('UPSTASH_REDIS_REST_TOKEN');

  if (!url || !token) {
    return null;
  }

  return {
    url: url.replace(/\/$/, ''),
    token
  };
}

function getUpstashHeaders(config) {
  return {
    Authorization: `Bearer ${config.token}`,
    'Content-Type': 'application/json'
  };
}

function buildCacheKey(key) {
  return `inanime:${key}`;
}

async function readUpstashCache(key) {
  const config = getUpstashConfig();
  if (!config) {
    return null;
  }

  try {
    const response = await fetch(
      `${config.url}/get/${encodeURIComponent(buildCacheKey(key))}`,
      {
        headers: getUpstashHeaders(config)
      }
    );

    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload.result) {
      return null;
    }

    return JSON.parse(payload.result);
  } catch {
    return null;
  }
}

async function writeUpstashCache(key, value, ttlMs) {
  const config = getUpstashConfig();
  if (!config) {
    return;
  }

  try {
    await fetch(`${config.url}/pipeline`, {
      method: 'POST',
      headers: getUpstashHeaders(config),
      body: JSON.stringify([
        ['SETEX', buildCacheKey(key), Math.max(1, Math.ceil(ttlMs / 1000)), JSON.stringify(value)]
      ])
    });
  } catch {
    // Ignore optional external cache failures.
  }
}

async function getCachedValue(key, ttlMs, loader, forceRefresh = false) {
  const now = Date.now();

  if (!forceRefresh) {
    const localCached = localCacheStore.get(key);
    if (localCached && localCached.expiresAt > now) {
      return localCached.value;
    }

    const externalCached = await readUpstashCache(key);
    if (externalCached !== null) {
      localCacheStore.set(key, {
        value: externalCached,
        expiresAt: now + ttlMs
      });
      return externalCached;
    }

    const inflight = inflightStore.get(key);
    if (inflight) {
      return inflight;
    }
  }

  const promise = (async () => {
    try {
      const value = await loader();
      localCacheStore.set(key, {
        value,
        expiresAt: Date.now() + ttlMs
      });
      await writeUpstashCache(key, value, ttlMs);
      return value;
    } finally {
      inflightStore.delete(key);
    }
  })();

  inflightStore.set(key, promise);
  return promise;
}

module.exports = {
  getCachedValue
};
