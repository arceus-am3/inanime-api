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
          episodes
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

    const latestEpisodes = [];
    const latestSeen = new Set();

    for (const item of data.latestEpisodes?.airingSchedules || []) {
      const media = item?.media;
      if (!media?.id || latestSeen.has(media.id)) {
        continue;
      }

      latestSeen.add(media.id);
      latestEpisodes.push({
        id: media.id,
        idMal: media.idMal,
        title: media.title,
        coverImage: media.coverImage,
        averageScore: media.averageScore
          ? (media.averageScore / 10).toFixed(1)
          : null,
        episodes: media.episodes || null,
        status: media.status
      });
    }

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
