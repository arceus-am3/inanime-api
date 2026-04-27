const {
  fetchAnikageEpisodes,
  normalizeEpisodeList
} = require('../lib/providers/anikage');
const {
  fetchAnimexServers,
  normalizeAnimexServerLists
} = require('../lib/providers/animex');
const { fetchAnidapServers } = require('../lib/providers/anidap');
const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');
const { getSourceOrder, normalizeSourceName } = require('../lib/source-config');

function toBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') {
    return fallback;
  }

  return ['1', 'true', 'yes', true].includes(value);
}

function mapAnikageProviders(providers = [], type) {
  return (providers || []).map((id) => ({
    site: 'anikage',
    id,
    type
  }));
}

function mapAnimexProviders(providers = [], type) {
  return (providers || []).map((item) => ({
    site: 'animex',
    id: item.id,
    type,
    default: item.default,
    tip: item.tip
  }));
}

function mapAnidapProviders(providers = [], type) {
  return (providers || []).map((id) => ({
    site: 'anidap',
    id,
    type
  }));
}

module.exports = async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.episodes);

  const id = req.query.id || req.query.anilistId;
  const episode = parseInt(req.query.episode || req.query.ep || '1', 10);
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
    const sourceOrder = getSourceOrder(requestedSite);
    let mediaData = null;
    let resolved = null;
    const attempts = [];

    for (const sourceSite of sourceOrder) {
      try {
        if (sourceSite === 'anikage') {
          const anikageEpisodeData = await fetchAnikageEpisodes(id, refresh);
          const currentAnikageEpisode = normalizeEpisodeList(anikageEpisodeData)
            .find((item) => item.number === episode) || null;
          const subProviders = currentAnikageEpisode?.subProviders || [];
          const dubProviders = currentAnikageEpisode?.dubProviders || [];

          if (subProviders.length || dubProviders.length) {
            resolved = {
              sourceSite,
              hasSub: subProviders.length > 0,
              hasDub: dubProviders.length > 0,
              subProviders,
              dubProviders,
              providers: {
                sub: mapAnikageProviders(subProviders, 'sub'),
                dub: mapAnikageProviders(dubProviders, 'dub')
              }
            };
            break;
          }
        }

        if (sourceSite === 'animex') {
          if (!mediaData) {
            const responseData = await fetchAniList(
              `query ($id: Int) {
                Media (id: $id, type: ANIME) {
                  id
                  title { english romaji native }
                }
              }`,
              { id: parseInt(id, 10) },
              { ttlMs: CACHE_POLICIES.episodes.sMaxAge * 1000, refresh }
            );
            mediaData = responseData.Media;
          }

          const animexServerData = await fetchAnimexServers(id, mediaData.title, episode, refresh);
          const normalizedAnimexServers = normalizeAnimexServerLists(animexServerData);

          if (normalizedAnimexServers.subProviders.length || normalizedAnimexServers.dubProviders.length) {
            resolved = {
              sourceSite,
              hasSub: normalizedAnimexServers.subProviders.length > 0,
              hasDub: normalizedAnimexServers.dubProviders.length > 0,
              subProviders: normalizedAnimexServers.subProviders,
              dubProviders: normalizedAnimexServers.dubProviders,
              providers: {
                sub: mapAnimexProviders(normalizedAnimexServers.subProviders, 'sub'),
                dub: mapAnimexProviders(normalizedAnimexServers.dubProviders, 'dub')
              }
            };
            break;
          }
        }

        if (sourceSite === 'anidap') {
          const anidapServerData = await fetchAnidapServers(id, episode, refresh);
          const subProviders = anidapServerData.subProviders || [];
          const dubProviders = anidapServerData.dubProviders || [];

          if (subProviders.length || dubProviders.length) {
            resolved = {
              sourceSite,
              hasSub: subProviders.length > 0,
              hasDub: dubProviders.length > 0,
              subProviders,
              dubProviders,
              providers: {
                sub: mapAnidapProviders(subProviders, 'sub'),
                dub: mapAnidapProviders(dubProviders, 'dub')
              }
            };
            break;
          }
        }
      } catch (error) {
        attempts.push(`${sourceSite}: ${error.message}`);
      }
    }

    if (!resolved) {
      return res.status(502).json({
        success: false,
        error: 'No providers available',
        details: attempts
      });
    }

    return res.status(200).json({
      success: true,
      data: {
        id: Number(id),
        episode,
        sourceSite: resolved.sourceSite,
        hasSub: resolved.hasSub,
        hasDub: resolved.hasDub,
        subProviders: resolved.subProviders,
        dubProviders: resolved.dubProviders,
        providers: resolved.providers
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
