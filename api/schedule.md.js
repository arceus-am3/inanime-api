const axios = require('axios');

export default async function handler(req, res) {
  const now = Math.floor(Date.now() / 1000);
  const nextWeek = now + (7 * 24 * 60 * 60);

  const query = `query ($start: Int, $end: Int) {
    Page(page: 1, perPage: 40) {
      airingSchedules(airingAt_greater: $start, airingAt_less: $end, sort: TIME) {
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
      variables: { start: now, end: nextWeek } 
    });
    res.status(200).json({ success: true, data: response.data.data.Page.airingSchedules });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
