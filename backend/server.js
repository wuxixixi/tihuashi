const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, uploadDir),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}${ext}`);
  }
});
const upload = multer({ 
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) cb(null, true);
    else cb(new Error('仅支持图片文件'));
  }
});

// 讯飞星火 API 配置 (已弃用)
// const XF_CONFIG = {
//   appId: '4242d2a81541ea8f1bb6346a38e816c6',
//   apiKey: 'MTFkNjA2YTU4Zjc0YjEyYjNiYzQ1OGY4',
//   apiHost: 'https://maas-coding-api.cn-huabei-1.xf-yun.com',
//   endpoint: '/v2/chat/prompting/chatcompletion',
//   model: 'astron-code-latest'
// };

// DMXAPI 配置
const DMX_CONFIG = {
  apiKey: 'sk-A12TQ5zlxcIyWlCwQjHpTc4P0mef1E19Kud2NEkShpRb1nAZ',
  baseUrl: 'https://www.dmxapi.cn/v1',
  model: 'gpt-5-mini'
};

// 生成鉴权 Header (讯飞 WSSE 鉴权) - 已弃用
// function generateAuthHeader() { ... }

// 调用 DMXAPI 大模型
async function callSparkAI(messages) {
  try {
    const url = `${DMX_CONFIG.baseUrl}/chat/completions`;
    const headers = {
      'Accept': 'application/json',
      'Authorization': DMX_CONFIG.apiKey,
      'Content-Type': 'application/json'
    };

    const payload = {
      model: DMX_CONFIG.model,
      messages: messages
    };

    console.log('DMXAPI Request URL:', url);
    console.log('DMXAPI Request Body:', JSON.stringify(payload, null, 2));

    const response = await axios.post(url, payload, { headers });

    console.log('DMXAPI Response:', JSON.stringify(response.data, null, 2));
    return response.data;
  } catch (error) {
    console.error('DMXAPI 调用失败:', error.response?.data || error.message);
    throw error;
  }
}

// 历史记录存储文件
const HISTORY_FILE = path.join(__dirname, 'history.json');

// 读取历史记录
function readHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf-8'));
    }
  } catch (e) {
    console.error('读取历史失败:', e);
  }
  return [];
}

// 保存历史记录
function saveHistory(record) {
  const history = readHistory();
  history.unshift(record);
  // 保留最近 50 条
  if (history.length > 50) history.pop();
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

// API 路由

// 1. 上传图片
app.post('/api/upload', upload.single('image'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传图片' });
  const url = `/uploads/${req.file.filename}`;
  res.json({ 
    success: true, 
    url, 
    filename: req.file.filename,
    fullPath: path.join(uploadDir, req.file.filename)
  });
});

// 2. 分析画作
app.post('/api/analyze', async (req, res) => {
  try {
    const { imagePath, imageUrl } = req.body;
    console.log('收到分析请求:', { imagePath, imageUrl });
    
    const prompt = `你是一位中国画鉴赏专家。请仔细欣赏这幅中国画，从以下几个方面进行分析：
1. 题材内容：画作描绘了什么？
2. 构图特点：画面布局有何特色？
3. 技法风格：使用了什么绘画技法？
4. 意境表达：画作传达了怎样的意境和情感？
5. 艺术价值：这幅画的艺术价值如何？

请用优美流畅的语言描述，字数控制在 300 字左右。`;

    const messages = [
      { role: 'user', content: prompt }
    ];

    const result = await callSparkAI(messages);
    console.log('AI分析结果:', result);
    
    const analysis = result.choices?.[0]?.message?.content || '抱歉，分析失败';

    res.json({ success: true, analysis });
  } catch (error) {
    console.error('分析API错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. 生成诗词
app.post('/api/poem', async (req, res) => {
  try {
    const { analysis, userFeeling, style } = req.body;
    
    let stylePrompt = '';
    if (style === '豪放') stylePrompt = '风格豪放激昂';
    else if (style === '婉约') stylePrompt = '风格婉约细腻';
    else if (style === '田园') stylePrompt = '风格清新田园';
    else if (style === '边塞') stylePrompt = '风格苍凉悲壮';
    
    const prompt = `你是一位著名诗人。请根据以下中国画赏析和用户感悟，为这幅画创作一首题画诗。

画作赏析：
${analysis}

用户感悟：
${userFeeling}

要求：
1. ${stylePrompt || '风格自由发挥'}
2. 古体诗或近体诗均可
3. 诗中要体现画的意境
4. 请在最后解释一下创作思路（用简短的几句话）

请直接输出诗词，不要其他说明。`;

    const messages = [
      { role: 'user', content: prompt }
    ];

    const result = await callSparkAI(messages);
    const poem = result.choices?.[0]?.message?.content || '抱歉，创作失败';
    
    res.json({ success: true, poem });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 获取历史记录
app.get('/api/history', (req, res) => {
  const history = readHistory();
  res.json({ success: true, history });
});

// 5. 删除历史记录
app.delete('/api/history/:id', (req, res) => {
  const { id } = req.params;
  let history = readHistory();
  history = history.filter(item => item.id !== id);
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  res.json({ success: true });
});

// 6. 保存赏画记录
app.post('/api/save', (req, res) => {
  const { imageUrl, analysis, userFeeling, poem, title } = req.body;
  const record = {
    id: uuidv4(),
    imageUrl,
    analysis,
    userFeeling,
    poem,
    title: title || '无题',
    createdAt: new Date().toISOString()
  };
  saveHistory(record);
  res.json({ success: true, record });
});

// 启动服务
app.listen(PORT, () => {
  console.log(`🎨 墨韵 AI 后端服务已启动: http://localhost:${PORT}`);
});
