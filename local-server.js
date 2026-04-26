const http = require('http');
const { URL } = require('url');

const routes = {
  '/': require('./api/index'),
  '/api/home': require('./api/home'),
  '/api/info': require('./api/info'),
  '/api/episodes': require('./api/episodes'),
  '/api/servers': require('./api/servers'),
  '/api/stream': require('./api/stream')
};

function createResponse(res) {
  return {
    status(code) {
      res.statusCode = code;
      return this;
    },
    setHeader(name, value) {
      res.setHeader(name, value);
    },
    json(payload) {
      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(payload));
    },
    send(payload) {
      if (Buffer.isBuffer(payload) || typeof payload === 'string') {
        res.end(payload);
        return;
      }

      if (!res.headersSent) {
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
      }
      res.end(JSON.stringify(payload));
    },
    end(payload) {
      res.end(payload);
    }
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const handler = routes[url.pathname];

  if (!handler) {
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      success: false,
      error: 'Route not found'
    }));
    return;
  }

  const query = Object.fromEntries(url.searchParams.entries());
  const request = {
    method: req.method,
    url: req.url,
    headers: req.headers,
    query
  };

  try {
    await handler(request, createResponse(res));
  } catch (error) {
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({
      success: false,
      error: error.message
    }));
  }
});

const port = process.env.PORT || 3030;
server.listen(port, '127.0.0.1', () => {
  console.log(`Local API listening on http://127.0.0.1:${port}`);
});
