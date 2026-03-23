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
    // 测试图片需要放在 uploadDir 下才能通过安全检查
    const testImagePath = path.join(__dirname, '..', 'uploads', 'test-analyze.jpg');

    beforeAll(() => {
      // 创建测试用的图片文件
      const fixturesDir = path.join(__dirname, 'fixtures');
      if (!fs.existsSync(fixturesDir)) fs.mkdirSync(fixturesDir, { recursive: true });
      const uploadsDir = path.join(__dirname, '..', 'uploads');
      if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
      // 创建一个最小的有效 JPEG 文件
      const minimalJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0xFF, 0xC4, 0x00, 0xB5, 0x10, 0x00, 0x02, 0x01, 0x03,
        0x03, 0x02, 0x04, 0x03, 0x05, 0x05, 0x04, 0x04, 0x00, 0x00, 0x01, 0x7D,
        0x01, 0x02, 0x03, 0x00, 0x04, 0x11, 0x05, 0x12, 0x21, 0x31, 0x41, 0x06,
        0x13, 0x51, 0x61, 0x07, 0x22, 0x71, 0x14, 0x32, 0x81, 0x91, 0xA1, 0x08,
        0x23, 0x42, 0xB1, 0xC1, 0x15, 0x52, 0xD1, 0xF0, 0x24, 0x33, 0x62, 0x72,
        0x82, 0x09, 0x0A, 0x16, 0x17, 0x18, 0x19, 0x1A, 0x25, 0x26, 0x27, 0x28,
        0x29, 0x2A, 0x34, 0x35, 0x36, 0x37, 0x38, 0x39, 0x3A, 0x43, 0x44, 0x45,
        0x46, 0x47, 0x48, 0x49, 0x4A, 0x53, 0x54, 0x55, 0x56, 0x57, 0x58, 0x59,
        0x5A, 0x63, 0x64, 0x65, 0x66, 0x67, 0x68, 0x69, 0x6A, 0x73, 0x74, 0x75,
        0x76, 0x77, 0x78, 0x79, 0x7A, 0x83, 0x84, 0x85, 0x86, 0x87, 0x88, 0x89,
        0x8A, 0x92, 0x93, 0x94, 0x95, 0x96, 0x97, 0x98, 0x99, 0x9A, 0xA2, 0xA3,
        0xA4, 0xA5, 0xA6, 0xA7, 0xA8, 0xA9, 0xAA, 0xB2, 0xB3, 0xB4, 0xB5, 0xB6,
        0xB7, 0xB8, 0xB9, 0xBA, 0xC2, 0xC3, 0xC4, 0xC5, 0xC6, 0xC7, 0xC8, 0xC9,
        0xCA, 0xD2, 0xD3, 0xD4, 0xD5, 0xD6, 0xD7, 0xD8, 0xD9, 0xDA, 0xE1, 0xE2,
        0xE3, 0xE4, 0xE5, 0xE6, 0xE7, 0xE8, 0xE9, 0xEA, 0xF1, 0xF2, 0xF3, 0xF4,
        0xF5, 0xF6, 0xF7, 0xF8, 0xF9, 0xFA, 0xFF, 0xDA, 0x00, 0x08, 0x01, 0x01,
        0x00, 0x00, 0x3F, 0x00, 0xFB, 0xD5, 0xDB, 0x20, 0xB8, 0xF8, 0x53, 0xC5,
        0xFF, 0xD9
      ]);
      fs.writeFileSync(testImagePath, minimalJpeg);
    });

    afterAll(() => {
      // 清理测试图片
      try { if (fs.existsSync(testImagePath)) fs.unlinkSync(testImagePath); } catch (e) {}
    });

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
      // 清除缓存以确保调用真正的 API
      const { analysisCache } = require('../cache');
      analysisCache.clear();

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
      // 创建一个有效的最小 JPEG 文件
      const minimalJpeg = Buffer.from([
        0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
        0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
        0x00, 0x08, 0x06, 0x06, 0x07, 0x06, 0x05, 0x08, 0x07, 0x07, 0x07, 0x09,
        0x09, 0x08, 0x0A, 0x0C, 0x14, 0x0D, 0x0C, 0x0B, 0x0B, 0x0C, 0x19, 0x12,
        0x13, 0x0F, 0x14, 0x1D, 0x1A, 0x1F, 0x1E, 0x1D, 0x1A, 0x1C, 0x1C, 0x20,
        0x24, 0x2E, 0x27, 0x20, 0x22, 0x2C, 0x23, 0x1C, 0x1C, 0x28, 0x37, 0x29,
        0x2C, 0x30, 0x31, 0x34, 0x34, 0x34, 0x1F, 0x27, 0x39, 0x3D, 0x38, 0x32,
        0x3C, 0x2E, 0x33, 0x34, 0x32, 0xFF, 0xC0, 0x00, 0x0B, 0x08, 0x00, 0x01,
        0x00, 0x01, 0x01, 0x01, 0x11, 0x00, 0xFF, 0xC4, 0x00, 0x1F, 0x00, 0x00,
        0x01, 0x05, 0x01, 0x01, 0x01, 0x01, 0x01, 0x01, 0x00, 0x00, 0x00, 0x00,
        0x00, 0x00, 0x00, 0x00, 0x01, 0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x08,
        0x09, 0x0A, 0x0B, 0xFF, 0xD9
      ]);
      const res = await request(app)
        .post('/api/upload')
        .attach('image', minimalJpeg, { filename: 'test.jpg' });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.url).toMatch(/^\/uploads\/.+/);
      expect(res.body.filename).toBeDefined();
      expect(res.body.fullPath).toBeDefined();
    });
  });
});
