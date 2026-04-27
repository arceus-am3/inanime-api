const {
  fetchAnikageEpisodes,
  fetchAnikageSources,
  normalizeEpisodeList,
  pickHost
} = require('../lib/providers/anikage');
const {
  fetchAnimexServers,
  fetchAnimexSources,
  pickAnimexProvider
} = require('../lib/providers/animex');
const {
  fetchAnidapServers,
  fetchAnidapSources
} = require('../lib/providers/anidap');
const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');
const { getSourceOrder, normalizeSourceName } = require('../lib/source-config');

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', true].includes(value);
}

module.exports = async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.stream);

  const id = req.query.id || req.query.anilistId;
  const episode = parseInt(req.query.episode || req.query.ep || '1', 10);
  const type = String(req.query.type || 'sub').toLowerCase() === 'dub' ? 'dub' : 'sub';
  const requestedSite = normalizeSourceName(req.query.site);
  const refresh = toBoolean(req.query.refresh, false);

  if (!id) {
    return res.status(400).json({
      success: false,
      error: 'id is required'
    });
  }

  if (!Number.isFinite(episode) || episode < 1) {
    return res.status(400).json({
      success: false,
      error: 'episode must be a positive number'
    });
  }

  try {
    const requestedHost = req.query.host ? String(req.query.host).toLowerCase() : null;
    const attempts = [];
    let streamData = null;
    let mediaTitle = null;
    const sourceOrder = getSourceOrder(requestedSite);

    for (const sourceSite of sourceOrder) {
      if (streamData) {
        break;
      }

      try {
        if (sourceSite === 'anikage') {
          streamData = await resolveAnikageStream(id, episode, type, requestedHost, refresh);
          continue;
        }

        if (sourceSite === 'animex') {
          mediaTitle = mediaTitle || await fetchMediaTitle(id, refresh);
          streamData = await resolveAnimexStream(id, mediaTitle, episode, type, requestedHost, refresh);
          continue;
        }

        if (sourceSite === 'anidap') {
          streamData = await resolveAnidapStream(id, episode, type, requestedHost, refresh);
        }
      } catch (error) {
        attempts.push(`${sourceSite}: ${error.message}`);
      }
    }

    if (!streamData) {
      return res.status(502).json({
        success: false,
        error: 'No stream source available',
        details: attempts
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: Number(id),
        episode,
        type,
        host: streamData.host,
        sourceSite: streamData.sourceSite,
        sources: streamData.sources || [],
        subtitles: streamData.subtitles || [],
        thumbnails: streamData.thumbnails || [],
        headers: streamData.headers || {}
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};

async function resolveAnikageStream(id, episode, type, requestedHost, refresh) {
  let host = requestedHost;

  if (!host) {
    const episodes = normalizeEpisodeList(await fetchAnikageEpisodes(id, refresh));
    const currentEpisode = Array.isArray(episodes)
      ? episodes.find((item) => Number(item.number) === episode)
      : null;

    if (!currentEpisode) {
      throw new Error('Episode not found');
    }

    host = pickHost(currentEpisode, null, type);
    if (!host) {
      throw new Error(`No ${type} providers found for this episode`);
    }
  }

  const sourceData = await fetchAnikageSources(id, episode, host, type, refresh);

  if (!Array.isArray(sourceData.sources) || sourceData.sources.length === 0) {
    throw new Error('Primary source returned no streams');
  }

  return {
    sourceSite: 'anikage',
    host,
    sources: sourceData.sources || [],
    subtitles: sourceData.subtitles || [],
    thumbnails: sourceData.thumbnails || [],
    headers: sourceData.headers || {}
  };
}

async function fetchMediaTitle(id, refresh) {
  const responseData = await fetchAniList(
    `query ($id: Int) {
      Media (id: $id, type: ANIME) {
        title { english romaji native }
      }
    }`,
    { id: Number(id) },
    { ttlMs: CACHE_POLICIES.info.sMaxAge * 1000, refresh }
  );

  return responseData.Media?.title || {};
}

async function resolveAnimexStream(id, mediaTitle, episode, type, requestedHost, refresh) {
  const serverData = await fetchAnimexServers(id, mediaTitle, episode, refresh);
  const host = pickAnimexProvider(serverData, requestedHost, type);

  if (!host) {
    throw new Error(`No ${type} providers found on Animex`);
  }

  const sourceData = await fetchAnimexSources(id, mediaTitle, episode, host, type, refresh);

  if (!Array.isArray(sourceData.sources) || sourceData.sources.length === 0) {
    throw new Error('Animex source returned no streams');
  }

  return {
    sourceSite: 'animex',
    host,
    sources: sourceData.sources || [],
    subtitles: sourceData.subtitles || [],
    thumbnails: sourceData.thumbnails || [],
    headers: sourceData.headers || {}
  };
}

async function resolveAnidapStream(id, episode, type, requestedHost, refresh) {
  const providerLists = await fetchAnidapServers(id, episode, refresh);
  const currentEpisode = {
    subProviders: providerLists.subProviders,
    dubProviders: providerLists.dubProviders
  };

  let host = pickHost(currentEpisode, requestedHost, type);
  if (!host) {
    throw new Error(`No ${type} providers found on backup source`);
  }

  let sourceData;

  try {
    sourceData = await fetchAnidapSources(id, episode, host, type, refresh);
  } catch (error) {
    if (!requestedHost) {
      throw error;
    }

    host = pickHost(currentEpisode, null, type);
    if (!host || host === requestedHost) {
      throw error;
    }

    sourceData = await fetchAnidapSources(id, episode, host, type, refresh);
  }

  if (!Array.isArray(sourceData.sources) || sourceData.sources.length === 0) {
    throw new Error('Backup source returned no streams');
  }

  return {
    sourceSite: 'anidap',
    host,
    sources: sourceData.sources,
    subtitles: sourceData.subtitles,
    thumbnails: sourceData.thumbnails,
    headers: sourceData.headers
  };
}
