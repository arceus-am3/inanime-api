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
const { getSourceOrder } = require('../lib/source-config');

function summarizeEpisodeFlags(episodes = []) {
  return {
    hasSub: episodes.some((item) => Boolean(item.hasSub)),
    hasDub: episodes.some((item) => Boolean(item.hasDub))
  };
}

module.exports = async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.info);
  const { id } = req.query;

  const query = `query ($id: Int) {
    Media (id: $id, type: ANIME) {
      id idMal
      title { romaji english native }
      description
      status episodes
      nextAiringEpisode { episode airingAt timeUntilAiring }
      season seasonYear
      bannerImage
      coverImage { extraLarge large color }
      genres
      averageScore
      trailer { id site }
      characters (sort: [ROLE, RELEVANCE, ID], perPage: 12) {
        edges {
          node { id name { full } image { large } }
        }
      }
      recommendations (perPage: 12) {
        nodes {
          mediaRecommendation {
            id idMal title { english romaji } coverImage { large } type
          }
        }
      }
    }
  }`;

  try {
    const responseData = await fetchAniList(
      query,
      { id: parseInt(id, 10) },
      { ttlMs: 30 * 24 * 60 * 60 * 1000 }
    );

    const data = responseData.Media;
    if (data) {
      const sourceOrder = getSourceOrder();
      let providerSummary = {
        hasSub: false,
        hasDub: false
      };

      for (const sourceSite of sourceOrder) {
        try {
          if (sourceSite === 'anikage') {
            const anikageEpisodes = normalizeEpisodeList(
              await fetchAnikageEpisodes(id).catch(() => [])
            );
            const summary = summarizeEpisodeFlags(anikageEpisodes);

            if (summary.hasSub || summary.hasDub) {
              providerSummary = summary;
              break;
            }
          }

          if (sourceSite === 'animex') {
            const animexEpisodes = normalizeAnimexEpisodeList(
              await fetchAnimexEpisodes(id, data.title).catch(() => [])
            );
            const summary = summarizeEpisodeFlags(animexEpisodes);

            if (summary.hasSub || summary.hasDub) {
              providerSummary = summary;
              break;
            }
          }
        } catch {
          // Ignore fallback source failures in info route.
        }
      }

      // Normalize Score
      if (data.averageScore) {
        data.averageScore = (data.averageScore / 10).toFixed(1);
      }
      
      // Smart Episode Count
      let currentEpisodeCount = data.episodes;
      if (data.status === 'RELEASING' && data.nextAiringEpisode) {
        currentEpisodeCount = data.nextAiringEpisode.episode - 1;
      }

      const {
        episodes,
        nextAiringEpisode,
        ...cleanData
      } = data;
      
      res.status(200).json({ 
        success: true, 
        data: {
          ...cleanData,
          currentEpisodeCount: currentEpisodeCount,
          streaming: {
            hasSub: providerSummary.hasSub,
            hasDub: providerSummary.hasDub
          }
        }
      });
    } else {
      res.status(200).json({ success: true, data });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
