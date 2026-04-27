const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

export default async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.schedule);
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
    const responseData = await fetchAniList(
      query,
      { start: now, end: nextWeek },
      { ttlMs: CACHE_POLICIES.schedule.sMaxAge * 1000 }
    );
    res.status(200).json({ success: true, data: responseData.Page.airingSchedules });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
