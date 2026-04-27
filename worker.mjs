import airingModule from './api/airing.js';
import collectionModule from './api/collection.js';
import episodesModule from './api/episodes.js';
import homeModule from './api/home.js';
import indexModule from './api/index.js';
import infoModule from './api/info.js';
import scheduleModule from './api/schedule.js';
import scheduleMarkdownModule from './api/schedule.md.js';
import searchModule from './api/search.js';
import serversModule from './api/servers.js';
import streamModule from './api/stream.js';

function normalizeHandler(mod) {
  return mod?.default || mod;
}

const routes = new Map([
  ['/', normalizeHandler(indexModule)],
  ['/api/airing', normalizeHandler(airingModule)],
  ['/api/collection', normalizeHandler(collectionModule)],
  ['/api/episodes', normalizeHandler(episodesModule)],
  ['/api/home', normalizeHandler(homeModule)],
  ['/api/info', normalizeHandler(infoModule)],
  ['/api/schedule', normalizeHandler(scheduleModule)],
  ['/api/schedule.md', normalizeHandler(scheduleMarkdownModule)],
  ['/api/search', normalizeHandler(searchModule)],
  ['/api/servers', normalizeHandler(serversModule)],
  ['/api/stream', normalizeHandler(streamModule)]
]);

function createWorkerRequest(request) {
  const url = new URL(request.url);
  const query = Object.fromEntries(url.searchParams.entries());
  const headers = {};

  for (const [key, value] of request.headers.entries()) {
    headers[key.toLowerCase()] = value;
  }

  return {
    method: request.method,
    url: request.url,
    headers,
    query
  };
}

function createWorkerResponse() {
  let statusCode = 200;
  const headers = new Headers();
  let body = '';

  function normalizePayload(payload) {
    if (payload === undefined || payload === null) {
      return '';
    }

    if (payload instanceof Uint8Array || payload instanceof ArrayBuffer) {
      return payload;
    }

    if (typeof payload === 'string') {
      return payload;
    }

    if (!headers.has('Content-Type')) {
      headers.set('Content-Type', 'application/json; charset=utf-8');
    }

    return JSON.stringify(payload);
  }

  return {
    status(code) {
      statusCode = code;
      return this;
    },
    setHeader(name, value) {
      headers.set(name, value);
    },
    json(payload) {
      if (!headers.has('Content-Type')) {
        headers.set('Content-Type', 'application/json; charset=utf-8');
      }
      body = JSON.stringify(payload);
      return this;
    },
    send(payload) {
      body = normalizePayload(payload);
      return this;
    },
    end(payload = '') {
      body = normalizePayload(payload);
      return this;
    },
    toResponse() {
      return new Response(body, {
        status: statusCode,
        headers
      });
    }
  };
}

export default {
  async fetch(request, env = {}) {
    globalThis.__inanimeEnv = env;

    const url = new URL(request.url);
    const pathname = url.pathname.length > 1 && url.pathname.endsWith('/')
      ? url.pathname.slice(0, -1)
      : url.pathname;
    const handler = routes.get(pathname);

    if (!handler) {
      return Response.json(
        {
          success: false,
          error: 'Route not found'
        },
        { status: 404 }
      );
    }

    const req = createWorkerRequest(request);
    const res = createWorkerResponse();

    try {
      await handler(req, res);
      return res.toResponse();
    } catch (error) {
      return Response.json(
        {
          success: false,
          error: error.message
        },
        { status: 500 }
      );
    }
  }
};
