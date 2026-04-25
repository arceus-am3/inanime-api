const axios = require('axios');

export default async function handler(req, res) {
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
    const media = response.data.data.Page.media.map(m => ({
      ...m,
      averageScore: m.averageScore ? (m.averageScore / 10).toFixed(1) : null
    }));
    res.status(200).json({ success: true, data: { ...response.data.data.Page, media } });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
