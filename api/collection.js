const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

module.exports = async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.daily);
  const { sort = 'TRENDING_DESC', page = 1, status } = req.query;

  const query = `query ($page: Int, $sort: [MediaSort], $status: MediaStatus) {
    Page (page: $page, perPage: 24) {
      pageInfo { total currentPage lastPage hasNextPage }
      media (type: ANIME, sort: $sort, status: $status) {
        id idMal
        title { english romaji }
        coverImage { large }
        bannerImage
        genres
        averageScore
        episodes
        status
      }
    }
  }`;

  try {
    const variables = {
      page: parseInt(page, 10),
      sort: String(sort)
        .split(',')
        .map((item) => item.trim().toUpperCase())
        .filter(Boolean),
      ...(status ? { status: String(status).trim().toUpperCase() } : {})
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
};
