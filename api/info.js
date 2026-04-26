const {
  fetchAnikageEpisodes,
  summarizeProviders
} = require('../lib/providers/anikage');
const {
  fetchAnimexEpisodes,
  fetchAnimexServers,
  summarizeAnimexData
} = require('../lib/providers/animex');
const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

function mergeProviderLists(primary = [], secondary = []) {
  return [...new Set([...(primary || []), ...(secondary || [])])];
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
      const [sourceEpisodes, animexEpisodes, animexServers] = await Promise.all([
        fetchAnikageEpisodes(id).catch(() => []),
        fetchAnimexEpisodes(id, data.title).catch(() => []),
        fetchAnimexServers(id, data.title, 1).catch(() => ({
          subProviders: [],
          dubProviders: []
        }))
      ]);

      const anikageSummary = summarizeProviders(sourceEpisodes);
      const animexSummary = summarizeAnimexData(animexEpisodes, animexServers);
      const providerSummary = {
        hasSub: anikageSummary.hasSub || animexSummary.hasSub,
        hasDub: anikageSummary.hasDub || animexSummary.hasDub,
        subProviders: mergeProviderLists(anikageSummary.subProviders, animexSummary.subProviders),
        dubProviders: mergeProviderLists(anikageSummary.dubProviders, animexSummary.dubProviders)
      };

      // Normalize Score
      if (data.averageScore) {
        data.averageScore = (data.averageScore / 10).toFixed(1);
      }
      
      // Smart Episode Count
      let currentEpisodeCount = data.episodes;
      if (data.status === 'RELEASING' && data.nextAiringEpisode) {
        currentEpisodeCount = data.nextAiringEpisode.episode - 1;
      } else if (!currentEpisodeCount && animexSummary.currentEpisodeCount) {
        currentEpisodeCount = animexSummary.currentEpisodeCount;
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
            hasDub: providerSummary.hasDub,
            subProviders: providerSummary.subProviders,
            dubProviders: providerSummary.dubProviders
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
