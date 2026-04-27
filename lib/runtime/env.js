function getEnv(name) {
  if (globalThis.__inanimeEnv && globalThis.__inanimeEnv[name] !== undefined) {
    return globalThis.__inanimeEnv[name];
  }

  if (typeof process !== 'undefined' && process.env) {
    return process.env[name];
  }

  return undefined;
}

module.exports = {
  getEnv
};
