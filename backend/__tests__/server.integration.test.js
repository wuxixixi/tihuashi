const path = require('path');
const fs = require('fs');
const { Readable } = require('stream');
const request = require('supertest');

function createOmniStream(text) {
  const s = new Readable({ read() {} });
  s.push(`event: response.output_text.delta\ndata: ${JSON.stringify({ delta: text })}\n\n`);
  s.push(null);
  return s;
}

// 测试前设置独立历史文件，避免污染正式数据
const testHistoryPath = path.join(__dirname, '..', 'test-history.json');
process.env.HISTORY_FILE = testHistoryPath;

// 在 require server 之前 mock axios，这样 callSparkAI 会走 mock
const mockAxiosPost = jest.fn();
jest.mock('axios', () => ({
  post: (...args) => mockAxiosPost(...args),
}));

// mock 后再加载 app
const app = require('../server');

describe('墨韵 AI 后端 API 集成测试', () => {
  beforeAll(() => {
    if (fs.existsSync(testHistoryPath)) fs.unlinkSync(testHistoryPath);
    // 赏析接口使用 qwen3-omni-flash 流式响应，题诗仍用 chat/completions
    mockAxiosPost.mockImplementation((url, payload) => {
      if (url && url.includes('/responses')) {
        return Promise.resolve({ status: 200, data: createOmniStream('这是一幅山水画，意境深远。') });
      }
      return Promise.resolve({
        data: { choices: [{ message: { content: '这是一幅山水画，意境深远。' } }] },
      });
    });
  });

  afterAll(() => {
    if (fs.existsSync(testHistoryPath)) fs.unlinkSync(testHistoryPath);
  });

  describe('GET /api/history', () => {
    it('应返回 success 与 history 数组', async () => {
      const res = await request(app).get('/api/history');
      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty('success', true);
      expect(res.body).toHaveProperty('history');
      expect(Array.isArray(res.body.history)).toBe(true);
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

    it('缺少 body 时仍应返回 200（title 默认为无题）', async () => {
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

  describe('GET /api/history 与 DELETE /api/history/:id', () => {
    let savedId;

    beforeAll(async () => {
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

  describe('POST /api/analyze', () => {
    const testImagePath = path.join(__dirname, 'fixtures', 'test.jpg');

    it('应调用 qwen3-omni-flash 多模态并返回 analysis', async () => {
      const res = await request(app)
        .post('/api/analyze')
        .send({ imagePath: testImagePath });
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.analysis).toBe('这是一幅山水画，意境深远。');
      expect(mockAxiosPost).toHaveBeenCalled();
      const [url, payload] = mockAxiosPost.mock.calls[0];
      expect(url).toContain('/responses');
      expect(payload.stream).toBe(true);
      expect(payload.input[0].content).toHaveLength(2);
      expect(payload.input[0].content[0].type).toBe('input_image');
      expect(typeof payload.input[0].content[0].image_url).toBe('string');
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
      mockAxiosPost.mockResolvedValue({
        data: {
          choices: [{ message: { content: '题山水图\n\n青山绿水绕人家' } }],
        },
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
