const DEFAULT_SOURCE_ORDER = ['anikage', 'animex', 'anidap'];

function normalizeSourceName(value) {
  const source = String(value || '').toLowerCase();
  return DEFAULT_SOURCE_ORDER.includes(source) ? source : null;
}

function getSourceOrder(requestedSite) {
  const requested = normalizeSourceName(requestedSite);

  if (requested) {
    return [
      requested,
      ...DEFAULT_SOURCE_ORDER.filter((source) => source !== requested)
    ];
  }

  return [...DEFAULT_SOURCE_ORDER];
}

module.exports = {
  DEFAULT_SOURCE_ORDER,
  normalizeSourceName,
  getSourceOrder
};
