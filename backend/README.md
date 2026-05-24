Redis-backed analyze queue

This backend supports using Redis + BullMQ for the analyze task queue.

How to enable
1. Install new dependencies in backend:
   cd backend && npm install
   (dependencies: bullmq, ioredis)

2. Provide a Redis connection in environment, e.g. in backend/.env:
   REDIS_URL=redis://:password@redis-host:6379/0

3. Start the backend normally. If REDIS_URL is set and a Redis server is reachable, the analyze queue will use Redis. Otherwise it will fallback to the in-memory queue.

Notes
- Redis is required for persistence, multi-process workers, and better reliability. The in-memory fallback is only suitable for single-process, short-lived development.
- When using BullMQ, job results are retained briefly (configured with removeOnComplete/removeOnFail) and are retrievable via GET /api/analyze/result?jobId=...
