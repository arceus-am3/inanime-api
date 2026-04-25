const axios = require('axios');

const query = `query ($start: Int, $end: Int) {
  Page(page: 1, perPage: 40) {
    airingSchedules(airingAt_greater: $start, airingAt_less: $end, sort: [TIME]) {
      airingAt
    }
  }
}`;

const start = Math.floor(Date.now() / 1000);
const end = start + 7 * 24 * 60 * 60;

axios.post('https://graphql.anilist.co', { query, variables: { start, end } })
  .then(r => console.log('Success'))
  .catch(e => console.log(JSON.stringify(e.response.data, null, 2)));
