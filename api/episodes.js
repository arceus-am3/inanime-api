const axios = require('axios');

export default async function handler(req, res) {
  // 15 Minutes Cache
  res.setHeader('Cache-Control', 's-maxage=900, stale-while-revalidate=120');
  const { id } = req.query;

  const query = `
    query ($id: Int) {
      Media (id: $id, type: ANIME) {
        id
        status
        episodes
        nextAiringEpisode {
          episode
        }
      }
      Page(page: 1, perPage: 100) {
        airingSchedules(mediaId: $id, sort: [TIME_DESC]) {
          episode
          airingAt
          timeUntilAiring
        }
      }
    }
  `;

  try {
    const response = await axios.post('https://graphql.anilist.co', {
      query,
      variables: { id: parseInt(id) }
    });

    const mediaData = response.data.data.Media;
    const scheduleNodes = response.data.data.Page.airingSchedules || [];
    
    // Smart Calculation for Current Episode Count
    let currentEpisodeCount = mediaData.episodes; 
    if (mediaData.status === 'RELEASING' && mediaData.nextAiringEpisode) {
      currentEpisodeCount = mediaData.nextAiringEpisode.episode - 1;
    } else if (mediaData.status === 'RELEASING' && !mediaData.nextAiringEpisode) {
      const airedNodes = scheduleNodes.filter(n => n.timeUntilAiring < 0) || [];
      if (airedNodes.length > 0) {
        currentEpisodeCount = Math.max(...airedNodes.map(n => n.episode));
      }
    }

    // Convert timestamps to readable dates
    const formattedNodes = scheduleNodes.map(node => ({
      ...node,
      readableDate: new Date(node.airingAt * 1000).toLocaleString('en-IN', {
        timeZone: 'Asia/Kolkata',
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    }));

    res.status(200).json({
      success: true,
      data: {
        currentEpisodeCount: currentEpisodeCount,
        ...mediaData,
        airingSchedule: { nodes: formattedNodes }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}
