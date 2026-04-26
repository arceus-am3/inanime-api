const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

export default async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.daily);

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

    const responseData = await fetchAniList(
      query,
      variables,
      { ttlMs: CACHE_POLICIES.daily.sMaxAge * 1000 }
    );
    const media = responseData.Page.media.map(m => ({
      ...m,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null
    }));
    res.status(200).json({ success: true, data: { ...responseData.Page, media } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
