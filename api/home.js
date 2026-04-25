const axios = require('axios');

export default async function handler(req, res) {
  // 15 Minutes Cache
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=120');
  const query = `query {
    spotlights: Page(page: 1, perPage: 10) { 
      media(type: ANIME, sort: TRENDING_DESC, status: RELEASING) { 
        id idMal title { english romaji } bannerImage coverImage { extraLarge } description averageScore 
      } 
    }
    trending: Page(page: 1, perPage: 15) { 
      media(type: ANIME, sort: TRENDING_DESC) { 
        id idMal title { english romaji } coverImage { large } averageScore 
      } 
    }
    popular: Page(page: 1, perPage: 15) { 
      media(type: ANIME, sort: POPULARITY_DESC) { 
        id idMal title { english romaji } coverImage { large } averageScore episodes 
      } 
    }
    topUpcoming: Page(page: 1, perPage: 15) { 
      media(type: ANIME, sort: POPULARITY_DESC, status: NOT_YET_RELEASED) { 
        id idMal title { english romaji } coverImage { large } averageScore 
      } 
    }
  }`;

  try {
    const response = await axios.post('https://graphql.anilist.co', { query });
    const data = response.data.data;

    // Normalize scores
    const normalize = (media) => media.map(m => ({
      ...m,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null
    }));

    res.status(200).json({
      success: true,
      data: {
        spotlights: normalize(data.spotlights.media),
        trending: normalize(data.trending.media),
        popular: normalize(data.popular.media),
        topUpcoming: normalize(data.topUpcoming.media)
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
