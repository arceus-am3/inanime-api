const CACHE_POLICIES = {
  info: {
    sMaxAge: 30 * 24 * 60 * 60,
    staleWhileRevalidate: 24 * 60 * 60
  },
  stream: {
    sMaxAge: 5 * 60,
    staleWhileRevalidate: 30
  },
  episodes: {
    sMaxAge: 15 * 60,
    staleWhileRevalidate: 2 * 60
  },
  home: {
    sMaxAge: 15 * 60,
    staleWhileRevalidate: 2 * 60
  },
  schedule: {
    sMaxAge: 2 * 24 * 60 * 60,
    staleWhileRevalidate: 2 * 60 * 60
  },
  daily: {
    sMaxAge: 24 * 60 * 60,
    staleWhileRevalidate: 60 * 60
  }
};

function setCacheHeaders(res, policy) {
  res.setHeader(
    'Cache-Control',
    `s-maxage=${policy.sMaxAge}, stale-while-revalidate=${policy.staleWhileRevalidate}`
  );
}

module.exports = {
  CACHE_POLICIES,
  setCacheHeaders
};
