const fs = require('fs');
const fsPromises = require('fs').promises;

const analysisCache = new Map();
const CACHE_TTL = parseInt(process.env.CACHE_TTL_MS || String(1000 * 60 * 30), 10); // 30 minutes default
const MAX_CACHE_SIZE = parseInt(process.env.MAX_CACHE_SIZE || '1000', 10); // 最大缓存条目数

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
  // 如果缓存已满，删除最旧的条目
  if (analysisCache.size >= MAX_CACHE_SIZE) {
    let oldestKey = null;
    let oldestTime = Infinity;
    for (const [k, item] of analysisCache) {
      if (item.timestamp < oldestTime) {
        oldestTime = item.timestamp;
        oldestKey = k;
      }
    }
    if (oldestKey) analysisCache.delete(oldestKey);
  }
  analysisCache.set(key, { data, timestamp: Date.now() });
}

// 同步版本（保持向后兼容）
function generateCacheKey(imagePath) {
  try {
    const stats = fs.statSync(imagePath);
    return `${imagePath}-${stats.size}-${stats.mtime.getTime()}`;
  } catch {
    return `${imagePath}-${Date.now()}`;
  }
}

// 异步版本（推荐使用）
async function generateCacheKeyAsync(imagePath) {
  try {
    const stats = await fsPromises.stat(imagePath);
    return `${imagePath}-${stats.size}-${stats.mtime.getTime()}`;
  } catch {
    return `${imagePath}-${Date.now()}`;
  }
}

// periodic cleanup
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of analysisCache) {
    if (now - item.timestamp > CACHE_TTL) analysisCache.delete(key);
  }
}, 1000 * 60 * 10);

module.exports = { getCache, setCache, generateCacheKey, generateCacheKeyAsync, analysisCache };