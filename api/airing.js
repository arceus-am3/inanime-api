const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

export default async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.daily);
  const { id } = req.query;

  const query = `query ($id: Int) {
    Media (id: $id, type: ANIME) {
      id
      status
      episodes
      nextAiringEpisode {
        airingAt
        timeUntilAiring
        episode
      }
    }
  }`;

  try {
    const responseData = await fetchAniList(
      query,
      { id: parseInt(id, 10) },
      { ttlMs: CACHE_POLICIES.daily.sMaxAge * 1000 }
    );
    res.status(200).json({ success: true, data: responseData.Media });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
