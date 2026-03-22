const fs = require('fs');

const analysisCache = new Map();
const CACHE_TTL = parseInt(process.env.CACHE_TTL_MS || String(1000 * 60 * 30), 10); // 30 minutes default

function getCache(key) {
  const item = analysisCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL) {
    analysisCache.delete(key);
    return null;
  }
  return item.data;
}

function setCache(key, data) {
  analysisCache.set(key, { data, timestamp: Date.now() });
}

function generateCacheKey(imagePath) {
  const stats = fs.statSync(imagePath);
  return `${imagePath}-${stats.size}-${stats.mtime.getTime()}`;
}

// periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of analysisCache) {
    if (now - item.timestamp > CACHE_TTL) analysisCache.delete(key);
  }
}, 1000 * 60 * 10);

module.exports = { getCache, setCache, generateCacheKey, analysisCache };