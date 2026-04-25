const axios = require('axios');

export default async function handler(req, res) {
  // 10 Days Cache
  res.setHeader('Cache-Control', 's-maxage=864000, stale-while-revalidate=86400');
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
    const response = await axios.post('https://graphql.anilist.co', { 
      query, 
      variables: { start: now, end: endDate, page: parseInt(page) } 
    });
    const schedules = response.data.data.Page.airingSchedules.map(item => {
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
        pageInfo: response.data.data.Page.pageInfo,
        schedules: schedules
      }
    });
  } catch (e) {
    res.status(500).json({ success: false, error: e.response ? e.response.data : e.message });
  }
}
