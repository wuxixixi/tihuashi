const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const request = require('supertest');

// Create a stream that mimics Doubao Vision SSE format
function createVisionStream(text) {
  const s = new Readable({ read() {} });
  s.push(`data: ${JSON.stringify({ choices: [{ delta: { content: text } }] })}\n\n`);
  s.push('data: [DONE]\n\n');
  s.push(null);
  return s;
}

// Use a test database path
const testDbPath = path.join(__dirname, '..', 'test-moyun.db');
process.env.DB_PATH = testDbPath;

// Mock axios before requiring server
const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  post: (...args) => mockAxiosPost(...args),
}));

// Mock dotenv
jest.mock('dotenv', () => ({
  config: () => {},
}));

const server = require('../server');
const app = server;
const db = server.db;

describe('墨韵 AI 后端 API 集成测试', () => {
  beforeAll(() => {
    // Clear all data instead of deleting the DB file
    db.prepare('DELETE FROM history').run();

    // Set up default mock
    mockAxiosPost.mockImplementation((url, payload, options) => {
      if (options && options.responseType === 'stream') {
        return Promise.resolve({
          status: 200,
          data: createVisionStream('这是一幅山水画，意境深远。'),
        });
      }
      return Promise.resolve({
        data: { choices: [{ message: { content: '题山水图\n\n青山绿水绕人家' } }] },
      });
    });
  });

  afterAll(() => {
    db.close();
    // Clean up db files after closing
    try {
      if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
      if (fs.existsSync(testDbPath + '-wal')) fs.unlinkSync(testDbPath + '-wal');
      if (fs.existsSync(testDbPath + '-shm')) fs.unlinkSync(testDbPath + '-shm');
    } catch (e) {
      // Ignore cleanup errors
    }
  });

  beforeEach(() => {
    db.prepare('DELETE FROM history').run();
  });

  describe('GET /api/history', () => {
    it('应返回 success、history 数组和分页信息', async () => {
      const res = await request(app).get('/api/history');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('history');
      expect(Array.isArray(res.body.history)).toBe(true);
      expect(res.body).toHaveProperty('pagination');
      expect(res.body.pagination).toHaveProperty('total');
      expect(res.body.pagination).toHaveProperty('totalPages');
    });
  });

  describe('POST /api/save', () => {
    it('应保存记录并返回 success 与 record', async () => {
      const res = await request(app)
        .post('/api/save')
        .send({
          imageUrl: '/uploads/test.jpg',
          analysis: '测试赏析',
          userFeeling: '测试感悟',
          poem: '测试题诗',
          title: '测试标题',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.record).toMatchObject({
        imageUrl: '/uploads/test.jpg',
        analysis: '测试赏析',
        poem: '测试题诗',
        title: '测试标题',
      });
      expect(res.body.record.id).toBeDefined();
      expect(res.body.record.createdAt).toBeDefined();
    });

    it('缺少 title 时默认为无题', async () => {
      const res = await request(app)
        .post('/api/save')
        .send({
          imageUrl: '/uploads/a.jpg',
          analysis: 'a',
          userFeeling: '',
          poem: 'p',
        });
      expect(res.status).toBe(200);
      expect(res.body.record.title).toBe('无题');
    });
  });

  describe('GET /api/history 搜索与分页', () => {
    beforeEach(async () => {
      for (let i = 0; i < 5; i++) {
        await request(app).post('/api/save').send({
          imageUrl: `/uploads/page-${i}.jpg`,
          analysis: `分页测试赏析${i}`,
          userFeeling: '',
          poem: `分页测试诗${i}`,
          title: `分页标题${i}`,
        });
      }
    });

    it('支持搜索参数', async () => {
      const res = await request(app).get('/api/history?search=' + encodeURIComponent('分页标题2'));
      expect(res.status).toBe(200);
      expect(res.body.history.some(h => h.title === '分页标题2')).toBe(true);
    });

    it('支持分页参数', async () => {
      const res = await request(app).get('/api/history?page=1&pageSize=2');
      expect(res.status).toBe(200);
      expect(res.body.history.length).toBeLessThanOrEqual(2);
      expect(res.body.pagination.pageSize).toBe(2);
    });
  });

  describe('DELETE /api/history/:id', () => {
    let savedId;

    beforeEach(async () => {
      const saveRes = await request(app).post('/api/save').send({
        imageUrl: '/uploads/delete-test.jpg',
        analysis: '删除测试',
        userFeeling: '',
        poem: '删除测试诗',
        title: '删除测试',
      });
      savedId = saveRes.body.record.id;
    });

    it('GET 应包含刚保存的记录', async () => {
      const res = await request(app).get('/api/history');
      const found = res.body.history.find((h) => h.id === savedId);
      expect(found).toBeDefined();
      expect(found.title).toBe('删除测试');
    });

    it('DELETE 应删除指定记录', async () => {
      const res = await request(app).delete(`/api/history/${savedId}`);
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      const listRes = await request(app).get('/api/history');
      const found = listRes.body.history.find((h) => h.id === savedId);
      expect(found).toBeUndefined();
    });
  });

  describe('PATCH /api/history/:id (编辑)', () => {
    let savedId;

    beforeEach(async () => {
      const saveRes = await request(app).post('/api/save').send({
        imageUrl: '/uploads/edit-test.jpg',
        analysis: '编辑测试',
        userFeeling: '',
        poem: '原始诗词',
        title: '原始标题',
      });
      savedId = saveRes.body.record.id;
    });

    it('应更新诗词和标题', async () => {
      const res = await request(app)
        .patch(`/api/history/${savedId}`)
        .send({ poem: '修改后的诗词', title: '修改后的标题' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.record.poem).toBe('修改后的诗词');
      expect(res.body.record.title).toBe('修改后的标题');
    });

    it('无更新内容时返回 400', async () => {
      const res = await request(app)
        .patch(`/api/history/${savedId}`)
        .send({});
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/history/:id/favorite (收藏)', () => {
    let savedId;

    beforeEach(async () => {
      const saveRes = await request(app).post('/api/save').send({
        imageUrl: '/uploads/fav-test.jpg',
        analysis: '收藏测试',
        userFeeling: '',
        poem: '收藏测试诗',
        title: '收藏测试',
      });
      savedId = saveRes.body.record.id;
    });

    it('应切换收藏状态', async () => {
      const res1 = await request(app).patch(`/api/history/${savedId}/favorite`);
      expect(res1.status).toBe(200);
      expect(res1.body.favorite).toBe(1);

      const res2 = await request(app).patch(`/api/history/${savedId}/favorite`);
      expect(res2.status).toBe(200);
      expect(res2.body.favorite).toBe(0);
    });

    it('不存在的记录返回 404', async () => {
      const res = await request(app).patch('/api/history/nonexistent/favorite');
      expect(res.status).toBe(404);
    });
  });

  describe('POST /api/analyze', () => {
    const testImagePath = path.join(__dirname, 'fixtures', 'test.jpg');

    it('应调用 Doubao Vision 多模态并返回 analysis', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({ imagePath: testImagePath });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis).toBe('这是一幅山水画，意境深远。');
      expect(mockAxiosPost).toHaveBeenCalled();
    });

    it('图片路径无效时返回 400', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({ imagePath: '/nonexistent.jpg' });
      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });

    it('AI 失败时应返回 500', async () => {
      mockAxiosPost.mockImplementationOnce(() => Promise.reject(new Error('网络错误')));
      const res = await request(app)
        .post('/api/analyze')
        .send({ imagePath: testImagePath });
      expect(res.status).toBe(500);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toContain('网络错误');
    });
  });

  describe('POST /api/poem', () => {
    beforeAll(() => {
      mockAxiosPost.mockImplementation((url, payload, options) => {
        if (options && options.responseType === 'stream') {
          return Promise.resolve({
            status: 200,
            data: createVisionStream('分析结果'),
          });
        }
        return Promise.resolve({
          data: { choices: [{ message: { content: '题山水图\n\n青山绿水绕人家' } }] },
        });
      });
    });

    it('应返回 title 与 poem', async () => {
      const res = await request(app)
        .post('/api/poem')
        .send({
          analysis: '山水画',
          userFeeling: '宁静',
          style: '词-田园',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.title).toBe('题山水图');
      expect(res.body.poem).toContain('青山绿水绕人家');
    });

    it('支持自定义风格', async () => {
      const res = await request(app)
        .post('/api/poem')
        .send({
          analysis: '山水画',
          userFeeling: '宁静',
          style: '',
          customStyle: '仿李白风格',
        });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
    });
  });

  describe('POST /api/upload', () => {
    it('无文件时应返回 400', async () => {
      const res = await request(app).post('/api/upload');
      expect(res.status).toBe(400);
      expect(res.body.error).toContain('请上传图片');
    });

    it('上传图片应返回 url 与 fullPath', async () => {
      const res = await request(app)
        .post('/api/upload')
        .attach('image', Buffer.from('fake-image'), { filename: 'test.jpg' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toMatch(/^\/uploads\/.+/);
      expect(res.body.filename).toBeDefined();
      expect(res.body.fullPath).toBeDefined();
    });
  });
});
