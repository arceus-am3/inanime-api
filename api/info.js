const axios = require('axios');

export default async function handler(req, res) {
  // 30 Days Cache
  res.setHeader('Cache-Control', 's-maxage=2592000, stale-while-revalidate=86400');
  const { id } = req.query;

  const query = `query ($id: Int) {
    Media (id: $id, type: ANIME) {
      id idMal
      title { romaji english native }
      description
      status episodes
      nextAiringEpisode { episode airingAt timeUntilAiring }
      season seasonYear
      bannerImage
      coverImage { extraLarge large color }
      genres
      averageScore
      trailer { id site }
      characters (sort: [ROLE, RELEVANCE, ID], perPage: 12) {
        edges {
          node { id name { full } image { large } }
        }
      }
      recommendations (perPage: 12) {
        nodes {
          mediaRecommendation {
            id idMal title { english romaji } coverImage { large } type
          }
        }
      }
    }
  }`;

  try {
    const response = await axios.post('https://graphql.anilist.co', { 
      query, 
      variables: { id: parseInt(id) } 
    });
    
    const data = response.data.data.Media;
    if (data) {
      // Normalize Score
      if (data.averageScore) {
        data.averageScore = (data.averageScore / 10).toFixed(1);
      }
      
      // Smart Episode Count
      let currentEpisodeCount = data.episodes;
      if (data.status === 'RELEASING' && data.nextAiringEpisode) {
        currentEpisodeCount = data.nextAiringEpisode.episode - 1;
      }
      
      res.status(200).json({ 
        success: true, 
        data: {
          ...data,
          currentEpisodeCount: currentEpisodeCount
        }
      });
    } else {
      res.status(200).json({ success: true, data });
    }
  } catch (e) {
    res.status(500).json({ success: false, error: e.message });
  }
}
