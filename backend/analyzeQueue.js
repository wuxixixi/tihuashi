const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const { callQwenOmniImageToText } = require('./aiClient');
const { getCache, setCache, generateCacheKey } = require('./cache');

function initAnalyzeQueue({ uploadDir, loadTemplates }) {
  const REDIS_URL = process.env.REDIS_URL;

  if (REDIS_URL) {
    try {
      const { Queue, Worker, QueueScheduler } = require('bullmq');
      const IORedis = require('ioredis');
      const connection = new IORedis(REDIS_URL);

      const queue = new Queue('analyze', { connection });
      // Ensure scheduled jobs are handled
      new QueueScheduler('analyze', { connection });

      const worker = new Worker('analyze', async (job) => {
        const imagePath = job.data.imagePath;
        const resolvedPath = path.resolve(imagePath);
        if (!resolvedPath.startsWith(uploadDir) || !fs.existsSync(resolvedPath)) {
          throw new Error('图片不存在或路径无效');
        }

        const cacheKey = generateCacheKey(resolvedPath);
        const cached = getCache(cacheKey);
        if (cached) return cached;

        const imageBuffer = fs.readFileSync(resolvedPath);
        const base64 = imageBuffer.toString('base64');
        const ext = path.extname(resolvedPath).toLowerCase();
        const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
        const dataUrl = `data:${mime};base64,${base64}`;

        const templates = loadTemplates();
        const prompt = templates.analysis.template;
        const analysisRaw = await callQwenOmniImageToText(dataUrl, prompt);

        let analysisText = analysisRaw;
        let genre = '';
        const genreMatch = analysisRaw.match(/【流派】\s*(.+)/);
        if (genreMatch) {
          genre = genreMatch[1].trim();
          analysisText = analysisRaw.replace(/【流派】.+/, '').trim();
        }

        const result = { analysis: analysisText || '抱歉，分析失败', genre };
        setCache(cacheKey, result);
        return result;
      }, { connection });

      worker.on('failed', (job, err) => {
        console.error('Analyze job failed', job.id, err);
      });

      function enqueueAnalyze(imagePath) {
        const jobId = uuidv4();
        // add job asynchronously; return jobId immediately
        queue.add('analyze', { imagePath }, { jobId, removeOnComplete: { age: 3600 }, removeOnFail: { age: 3600 } })
          .catch(err => console.error('enqueue failed', err));
        return jobId;
      }

      async function getJob(jobId) {
        const job = await queue.getJob(jobId);
        if (!job) return null;
        const state = await job.getState();
        const status = state === 'waiting' ? 'pending' : state;
        const result = state === 'completed' ? job.returnvalue || null : null;
        return { status, result, createdAt: job.timestamp ? new Date(job.timestamp).toISOString() : null };
      }

      return { enqueueAnalyze, getJob };
    } catch (e) {
      console.error('Redis queue initialization failed, falling back to in-memory queue:', e.message);
    }
  }

  // Fallback: in-memory queue
  const analyzeQueue = [];
  const analyzeJobs = new Map();
  const MAX_CONCURRENT_ANALYZE = parseInt(process.env.MAX_ANALYZE_WORKERS || '2', 10);
  let analyzeWorkers = 0;

  function enqueueAnalyze(imagePath) {
    const jobId = uuidv4();
    analyzeJobs.set(jobId, { status: 'pending', createdAt: new Date().toISOString(), result: null, error: null });
    analyzeQueue.push({ jobId, imagePath });
    processAnalyzeQueue();
    return jobId;
  }

  function getJob(jobId) {
    return analyzeJobs.get(jobId) || null;
  }

  function processAnalyzeQueue() {
    while (analyzeWorkers < MAX_CONCURRENT_ANALYZE && analyzeQueue.length > 0) {
      const task = analyzeQueue.shift();
      analyzeWorkers++;
      (async () => {
        const { jobId, imagePath } = task;
        try {
          const resolvedPath = path.resolve(imagePath);
          if (!resolvedPath.startsWith(uploadDir) || !fs.existsSync(resolvedPath)) {
            throw new Error('图片不存在或路径无效');
          }
          const cacheKey = generateCacheKey(resolvedPath);
          const cached = getCache(cacheKey);
          if (cached) {
            analyzeJobs.set(jobId, { status: 'done', result: cached, createdAt: new Date().toISOString() });
          } else {
            const imageBuffer = fs.readFileSync(resolvedPath);
            const base64 = imageBuffer.toString('base64');
            const ext = path.extname(resolvedPath).toLowerCase();
            const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
            const dataUrl = `data:${mime};base64,${base64}`;
            const templates = loadTemplates();
            const prompt = templates.analysis.template;
            const analysisRaw = await callQwenOmniImageToText(dataUrl, prompt);
            let analysisText = analysisRaw;
            let genre = '';
            const genreMatch = analysisRaw.match(/【流派】\s*(.+)/);
            if (genreMatch) {
              genre = genreMatch[1].trim();
              analysisText = analysisRaw.replace(/【流派】.+/, '').trim();
            }
            const result = { analysis: analysisText || '抱歉，分析失败', genre };
            setCache(cacheKey, result);
            analyzeJobs.set(jobId, { status: 'done', result, createdAt: new Date().toISOString() });
          }
        } catch (err) {
          analyzeJobs.set(jobId, { status: 'error', error: err.message || String(err), createdAt: new Date().toISOString() });
        } finally {
          analyzeWorkers--;
          setImmediate(processAnalyzeQueue);
        }
      })();
    }
  }

  return { enqueueAnalyze, getJob };
}

module.exports = { initAnalyzeQueue };