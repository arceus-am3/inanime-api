const axios = require('axios');

export default async function handler(req, res) {
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
    const response = await axios.post('https://graphql.anilist.co', { 
      query, 
      variables: { id: parseInt(id) } 
    });
    res.status(200).json({ success: true, data: response.data.data.Media });
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
