const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

export default async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.daily);
  const { page = 1 } = req.query;
  const now = Math.floor(Date.now() / 1000);
  const endDate = now + (10 * 24 * 60 * 60);

  const query = `query ($start: Int, $end: Int, $page: Int) {
    Page(page: $page, perPage: 100) {
      pageInfo { hasNextPage total currentPage lastPage }
      airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: [TIME]) {
        airingAt
        episode
        media {
          id
          idMal
          title { english romaji }
          coverImage { large }
          genres
          averageScore
        }
      }
    }
  }`;

  try {
    const responseData = await fetchAniList(
      query,
      { start: now, end: endDate, page: parseInt(page, 10) },
      { ttlMs: CACHE_POLICIES.daily.sMaxAge * 1000 }
    );
    const schedules = responseData.Page.airingSchedules.map(item => {
      if (item.media && item.media.averageScore) {
        item.media.averageScore = (item.media.averageScore / 10).toFixed(1);
      }
      return {
        ...item,
        readableDate: new Date(item.airingAt * 1000).toLocaleString('en-IN', {
          timeZone: 'Asia/Kolkata',
          weekday: 'short',
          day: '2-digit',
          month: 'short',
          hour: '2-digit',
          minute: '2-digit'
        })
      };
    });
    res.status(200).json({ 
      success: true, 
      data: {
        pageInfo: responseData.Page.pageInfo,
        schedules: schedules
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
