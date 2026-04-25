const axios = require('axios');

export default async function handler(req, res) {
  // 1 Hour Cache for Search
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=59');

  const { q, genre, year, season, format, page = 1 } = req.query;

  const query = `query ($search: String, $genre: String, $year: Int, $season: MediaSeason, $format: MediaFormat, $page: Int) {
    Page (page: $page, perPage: 20) {
      pageInfo { total currentPage lastPage hasNextPage }
      media (search: $search, genre: $genre, seasonYear: $year, season: $season, format: $format, type: ANIME, sort: [POPULARITY_DESC]) {
        id idMal title { english romaji native } coverImage { large } status episodes averageScore
      }
    }
  }`;

  try {
    const variables = { 
      page: parseInt(page),
      ...(q && { search: q }),
      ...(genre && { genre }),
      ...(year && { year: parseInt(year) }),
      ...(season && { season: season.toUpperCase() }),
      ...(format && { format: format.toUpperCase().replace(' ', '_') })
    };

    const response = await axios.post('https://graphql.anilist.co', { query, variables });
    const media = response.data.data.Page.media.map(m => ({
      ...m,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null
    }));
    res.status(200).json({ success: true, data: { ...response.data.data.Page, media } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.response ? e.response.data : e.message });
  }
}
