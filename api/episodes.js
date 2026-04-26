const {
  fetchAnikageEpisodes,
  normalizeEpisodeList
} = require('../lib/providers/anikage');
const {
  fetchAnimexEpisodes,
  normalizeAnimexEpisodeList
} = require('../lib/providers/animex');
const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

module.exports = async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.episodes);
  const { id } = req.query;

  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        id
        title { english romaji native }
        status
        episodes
        nextAiringEpisode {
          episode
        }
      }
    }
  `;

  try {
    const responseData = await fetchAniList(
      query,
      { id: parseInt(id, 10) },
      { ttlMs: CACHE_POLICIES.episodes.sMaxAge * 1000 }
    );

    const mediaData = responseData.Media;
    const [sourceEpisodes, animexEpisodes] = await Promise.all([
      fetchAnikageEpisodes(id).catch(() => []),
      fetchAnimexEpisodes(id, mediaData.title).catch(() => [])
    ]);

    const anikageEpisodes = normalizeEpisodeList(sourceEpisodes);
    const animexEpisodeNumbers = normalizeAnimexEpisodeList(animexEpisodes);
    const episodeMap = new Map();

    for (const episodeItem of anikageEpisodes) {
      episodeMap.set(episodeItem.number, episodeItem.number);
    }

    for (const episodeItem of animexEpisodeNumbers) {
      if (!episodeMap.has(episodeItem.number)) {
        episodeMap.set(episodeItem.number, episodeItem.number);
      }
    }

    const episodes = [...episodeMap.values()]
      .sort((a, b) => a - b)
      .map((number) => ({ number }));
    
    // Smart Calculation for Current Episode Count
    let currentEpisodeCount = mediaData.episodes || null;
    if (mediaData.status === 'RELEASING' && mediaData.nextAiringEpisode) {
      currentEpisodeCount = mediaData.nextAiringEpisode.episode - 1;
    } else if (!currentEpisodeCount && episodes.length > 0) {
      currentEpisodeCount = Math.max(...episodes.map((item) => item.number));
    }

    const nextAiringEpisode = mediaData.nextAiringEpisode
      ? {
          episode: mediaData.nextAiringEpisode.episode
        }
      : null;

    res.status(200).json({
      success: true,
      data: {
        currentEpisodeCount: currentEpisodeCount,
        id: mediaData.id,
        status: mediaData.status,
        nextAiringEpisode,
        episodes
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
