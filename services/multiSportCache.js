// services/multiSportCache.js

const sportCache = {};
const CACHE_DURATION = 60 * 60 * 1000; // 1 hour

function getCache(key) {
  const cachedItem = sportCache[key];

  if (!cachedItem) {
    return null;
  }

  const isExpired = Date.now() - cachedItem.timestamp > CACHE_DURATION;

  if (isExpired) {
    delete sportCache[key];
    return null;
  }

  return cachedItem.data;
}

function setCache(key, data) {
  sportCache[key] = {
    data,
    timestamp: Date.now()
  };
}

module.exports = {
  getCache,
  setCache
};
