const {
  fetchAnikageEpisodes,
  normalizeEpisodeList
} = require('../lib/providers/anikage');
const {
  fetchAnimexServers,
  normalizeAnimexServerLists
} = require('../lib/providers/animex');
const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

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

module.exports = async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.episodes);

  const id = req.query.id || req.query.anilistId;
  const episode = parseInt(req.query.episode || req.query.ep || '1', 10);
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

    const mediaData = responseData.Media;

    const [anikageEpisodeData, animexServerData] = await Promise.all([
      fetchAnikageEpisodes(id, refresh).catch(() => []),
      fetchAnimexServers(id, mediaData.title, episode, refresh).catch(() => ({
        subProviders: [],
        dubProviders: []
      }))
    ]);

    const currentAnikageEpisode = normalizeEpisodeList(anikageEpisodeData)
      .find((item) => item.number === episode) || null;
    const normalizedAnimexServers = normalizeAnimexServerLists(animexServerData);

    const bySite = {
      anikage: {
        subProviders: currentAnikageEpisode?.subProviders || [],
        dubProviders: currentAnikageEpisode?.dubProviders || []
      },
      animex: {
        subProviders: normalizedAnimexServers.subProviders,
        dubProviders: normalizedAnimexServers.dubProviders
      }
    };

    return res.status(200).json({
      success: true,
      data: {
        id: Number(id),
        episode,
        bySite,
        providers: {
          sub: [
            ...mapAnikageProviders(bySite.anikage.subProviders, 'sub'),
            ...mapAnimexProviders(bySite.animex.subProviders, 'sub')
          ],
          dub: [
            ...mapAnikageProviders(bySite.anikage.dubProviders, 'dub'),
            ...mapAnimexProviders(bySite.animex.dubProviders, 'dub')
          ]
        }
      }
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
};
