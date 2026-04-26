const { CACHE_POLICIES, setCacheHeaders } = require('../lib/cache/policies');

function endpointRow(path, description, example) {
  return `
    <tr>
      <td><code>${path}</code></td>
      <td>${description}</td>
      <td><a href="${example}"><code>${example}</code></a></td>
    </tr>
  `;
}

module.exports = async function handler(req, res) {
  setCacheHeaders(res, CACHE_POLICIES.home);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>InAnime API</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #0d1016;
      --panel: #171c26;
      --panel-2: #10151d;
      --text: #e8edf7;
      --muted: #98a3b8;
      --line: #283244;
      --accent: #56d39b;
      --warn: #ffcc66;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: Segoe UI, sans-serif;
      background: linear-gradient(180deg, #0b0f15 0%, #131a24 100%);
      color: var(--text);
    }
    .wrap {
      max-width: 1080px;
      margin: 0 auto;
      padding: 32px 20px 48px;
    }
    .hero, .card {
      background: rgba(23, 28, 38, 0.92);
      border: 1px solid var(--line);
      border-radius: 18px;
      padding: 22px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.22);
    }
    .hero { margin-bottom: 18px; }
    .cards {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 18px;
      margin-bottom: 18px;
    }
    h1, h2 { margin: 0 0 12px; }
    h1 { font-size: 32px; }
    h2 { font-size: 20px; }
    p, li { color: var(--muted); line-height: 1.6; }
    .tag {
      display: inline-block;
      padding: 6px 10px;
      border-radius: 999px;
      background: rgba(86, 211, 155, 0.14);
      color: var(--accent);
      border: 1px solid rgba(86, 211, 155, 0.25);
      font-size: 13px;
      margin-right: 8px;
      margin-bottom: 8px;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      overflow: hidden;
      border-radius: 14px;
      border: 1px solid var(--line);
      background: var(--panel-2);
    }
    th, td {
      padding: 14px 12px;
      text-align: left;
      vertical-align: top;
      border-bottom: 1px solid var(--line);
    }
    th { color: var(--text); background: rgba(255,255,255,0.03); }
    td { color: var(--muted); }
    code {
      color: #fff;
      background: rgba(255,255,255,0.07);
      border-radius: 8px;
      padding: 2px 6px;
      word-break: break-all;
    }
    a { color: #8fd9ff; text-decoration: none; }
    ul { margin: 0; padding-left: 18px; }
    .warn {
      border-left: 4px solid var(--warn);
      padding-left: 14px;
      color: #f7df9a;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <section class="hero">
      <h1>InAnime API</h1>
      <p>AniList based anime API with scraped episode, provider and stream support from multiple sites.</p>
      <div>
        <span class="tag">Primary: Anikage</span>
        <span class="tag">Fallback: Animex</span>
        <span class="tag">Backup: Anidap</span>
      </div>
    </section>

    <section class="cards">
      <div class="card">
        <h2>Main Endpoints</h2>
        <ul>
          <li><code>/api/home</code> trending and homepage sections</li>
          <li><code>/api/info?id=21</code> anime details + sub/dub summary</li>
          <li><code>/api/episodes?id=21</code> lightweight episode numbers</li>
          <li><code>/api/servers?id=21&ep=1</code> provider lists by site</li>
          <li><code>/api/stream?id=21&ep=1&type=sub&host=pahe</code> stream sources</li>
        </ul>
      </div>
      <div class="card">
        <h2>Provider Logic</h2>
        <ul>
          <li><code>stream</code> fallback order: <code>anikage -&gt; animex -&gt; anidap</code></li>
          <li><code>site=animex</code> ya <code>site=anikage</code> se manual source choose kar sakte ho</li>
          <li><code>host</code> se manual provider select kar sakte ho, jaise <code>pahe</code>, <code>mimi</code>, <code>mochi</code></li>
          <li><code>refresh=1</code> cache bypass karta hai</li>
        </ul>
      </div>
      <div class="card">
        <h2>Stream Note</h2>
        <p class="warn">Is project me ab direct source URLs milte hain. Proxy alag optional project me shift kar diya gaya hai.</p>
        <ul>
          <li>Current API lightweight rahega</li>
          <li>Backup auto stream fallback on hai</li>
          <li>Separate proxy baad me sirf zarurat par deploy kar sakte ho</li>
        </ul>
      </div>
    </section>

    <section class="card">
      <h2>All Paths</h2>
      <table>
        <thead>
          <tr>
            <th>Path</th>
            <th>Use</th>
            <th>Example</th>
          </tr>
        </thead>
        <tbody>
          ${endpointRow('/api/home', 'Homepage data like spotlights, trending, popular, upcoming', '/api/home')}
          ${endpointRow('/api/info', 'AniList info plus combined sub/dub provider summary', '/api/info?id=21')}
          ${endpointRow('/api/episodes', 'Lightweight episode list with just numbers and airing info', '/api/episodes?id=21')}
          ${endpointRow('/api/servers', 'Providers by site for a selected episode', '/api/servers?id=21&ep=1')}
          ${endpointRow('/api/stream', 'Final stream source endpoint with fallback support', '/api/stream?id=21&ep=1&type=sub&host=pahe')}
          ${endpointRow('/api/stream?site=animex', 'Direct Animex stream source selection', '/api/stream?id=21&ep=1&type=sub&site=animex&host=mimi')}
          ${endpointRow('/proxy project', 'Optional separate stream proxy project path on disk', 'f:/api/inanime-proxy')}
          ${endpointRow('/api/search', 'Search anime from AniList', '/api/search?q=one%20piece')}
          ${endpointRow('/api/collection', 'Collection style anime list endpoint', '/api/collection?page=1')}
          ${endpointRow('/api/schedule', 'Schedule endpoint', '/api/schedule')}
          ${endpointRow('/api/airing', 'Airing endpoint', '/api/airing')}
          ${endpointRow('/api/schedule.md', 'Markdown schedule output', '/api/schedule.md')}
        </tbody>
      </table>
    </section>
  </div>
</body>
</html>`;

  return res.status(200).send(html);
};
