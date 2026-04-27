const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

function formatEpisodeSchedule(timestamp) {
  if (!timestamp) {
    return null;
  }

  return new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  }).format(new Date(timestamp * 1000));
}

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
          airingAt
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
    const animeTitle = mediaData.title?.english
      || mediaData.title?.romaji
      || mediaData.title?.native
      || null;
    const japaneseTitle = mediaData.title?.native
      || mediaData.title?.romaji
      || mediaData.title?.english
      || null;
    
    // Smart Calculation for Current Episode Count
    let currentEpisodeCount = mediaData.episodes || null;
    if (mediaData.status === 'RELEASING' && mediaData.nextAiringEpisode) {
      currentEpisodeCount = mediaData.nextAiringEpisode.episode - 1;
    }

    const episodes = Number.isFinite(currentEpisodeCount) && currentEpisodeCount > 0
      ? Array.from({ length: currentEpisodeCount }, (_, index) => ({
          episode_no: index + 1,
          id: `${mediaData.id}&ep=${index + 1}`,
          data_id: mediaData.id,
          title: animeTitle,
          japanese_title: japaneseTitle
        }))
      : [];

    const nextEpisode = mediaData.nextAiringEpisode?.episode || null;
    const nextEpisodeSchedule = formatEpisodeSchedule(
      mediaData.nextAiringEpisode?.airingAt
    );

    res.status(200).json({
      success: true,
      results: [
        {
          totalEpisodes: currentEpisodeCount,
          episodes,
          nextEpisode,
          nextEpisodeSchedule
        }
      ]
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};
