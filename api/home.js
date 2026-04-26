const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

module.exports = async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.home);
  const query = `query {
    spotlights: Page(page: 1, perPage: 10) { 
      media(type: ANIME, sort: TRENDING_DESC, status: RELEASING) { 
        id idMal title { english romaji } bannerImage coverImage { extraLarge } description averageScore status
      } 
    }
    trending: Page(page: 1, perPage: 15) { 
      media(type: ANIME, sort: TRENDING_DESC) { 
        id idMal title { english romaji } coverImage { large } averageScore status
      } 
    }
    popular: Page(page: 1, perPage: 15) { 
      media(type: ANIME, sort: POPULARITY_DESC) { 
        id idMal title { english romaji } coverImage { large } averageScore episodes status
      } 
    }
    topUpcoming: Page(page: 1, perPage: 15) { 
      media(type: ANIME, sort: POPULARITY_DESC, status: NOT_YET_RELEASED) { 
        id idMal title { english romaji } coverImage { large } averageScore status
      } 
    }
    topAiring: Page(page: 1, perPage: 15) { 
      media(type: ANIME, sort: POPULARITY_DESC, status: RELEASING) { 
        id idMal title { english romaji } coverImage { large } averageScore episodes status
        nextAiringEpisode { episode airingAt timeUntilAiring }
      } 
    }
    allTimeFavorites: Page(page: 1, perPage: 15) { 
      media(type: ANIME, sort: FAVOURITES_DESC) { 
        id idMal title { english romaji } coverImage { large } averageScore episodes status
      } 
    }
    latestEpisodes: Page(page: 1, perPage: 12) {
      airingSchedules(notYetAired: false, sort: [TIME_DESC]) {
        episode
        airingAt
        media {
          id
          idMal
          title { english romaji }
          coverImage { large }
          averageScore
          status
          nextAiringEpisode { episode airingAt timeUntilAiring }
        }
      } 
    }
  }`;

  try {
    const data = await fetchAniList(
      query,
      {},
      { ttlMs: CACHE_POLICIES.home.sMaxAge * 1000 }
    );

    const normalizeMedia = (media) => media.map((m) => ({
      ...m,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null
    }));

    const latestEpisodes = (data.latestEpisodes?.airingSchedules || [])
      .filter((item) => item?.media?.id)
      .map((item) => ({
        episode: item.episode,
        airingAt: item.airingAt,
        media: {
          ...item.media,
          averageScore: item.media.averageScore
            ? (item.media.averageScore / 10).toFixed(1)
            : null
        }
      }));

    res.status(200).json({
      success: true,
      data: {
        spotlights: normalizeMedia(data.spotlights.media),
        trending: normalizeMedia(data.trending.media),
        popular: normalizeMedia(data.popular.media),
        topUpcoming: normalizeMedia(data.topUpcoming.media),
        topAiring: normalizeMedia(data.topAiring.media),
        allTimeFavorites: normalizeMedia(data.allTimeFavorites.media),
        latestEpisodes
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
};
