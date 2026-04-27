const { fetchAniList } = require('../lib/clients/anilist');
const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

function formatScheduleParts(timestamp) {
  if (!timestamp) {
    return {
      releaseDate: null,
      time: null
    };
  }

  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  const parts = Object.fromEntries(
    formatter.formatToParts(new Date(timestamp * 1000))
      .filter((item) => item.type !== 'literal')
      .map((item) => [item.type, item.value])
  );

  return {
    releaseDate: `${parts.year}-${parts.month}-${parts.day}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`
  };
}

function buildDateRange(dateValue) {
  if (dateValue) {
    const dateMatch = String(dateValue).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!dateMatch) {
      throw new Error('date must be in YYYY-MM-DD format');
    }

    const [, year, month, day] = dateMatch;
    const start = new Date(`${year}-${month}-${day}T00:00:00+05:30`);
    const end = new Date(`${year}-${month}-${day}T23:59:59+05:30`);

    return {
      start: Math.floor(start.getTime() / 1000),
      end: Math.floor(end.getTime() / 1000)
    };
  }

  const now = Math.floor(Date.now() / 1000);
  return {
    start: now,
    end: now + (10 * 24 * 60 * 60)
  };
}

module.exports = async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.schedule);
  const { page = 1, date } = req.query;

  try {
    const { start, end } = buildDateRange(date);

    const query = `query ($start: Int, $end: Int, $page: Int) {
      Page(page: $page, perPage: 100) {
        pageInfo { hasNextPage total currentPage lastPage }
        airingSchedules(airingAt_greater: $start, airingAt_lesser: $end, sort: [TIME]) {
          airingAt
          episode
          media {
            id
            title { english romaji native }
          }
        }
      }
    }`;

    const responseData = await fetchAniList(
      query,
      { start, end, page: parseInt(page, 10) },
      { ttlMs: CACHE_POLICIES.schedule.sMaxAge * 1000 }
    );

    const results = responseData.Page.airingSchedules.map((item) => {
      const mediaTitle = item.media?.title?.english
        || item.media?.title?.romaji
        || item.media?.title?.native
        || null;
      const japaneseTitle = item.media?.title?.native
        || item.media?.title?.romaji
        || item.media?.title?.english
        || null;
      const schedule = formatScheduleParts(item.airingAt);

      return {
        id: item.media?.id || null,
        data_id: `${item.media?.id}&ep=${item.episode}`,
        title: mediaTitle,
        japanese_title: japaneseTitle,
        releaseDate: schedule.releaseDate,
        time: schedule.time,
        episode_no: item.episode
      };
    });

    res.status(200).json({
      success: true,
      results
    });
  } catch (e) {
    const statusCode = e.message.includes('YYYY-MM-DD') ? 400 : 500;
    res.status(statusCode).json({ success: false, error: e.message });
  }
};
