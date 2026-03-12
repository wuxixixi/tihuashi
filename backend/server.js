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

// 多模态模型 qwen3-omni-flash（用于画作赏析，支持图文输入）
// 文档：https://doc.dmxapi.cn/qwen3-omni-flash.html
const OMNI_CONFIG = {
  apiKey: DMX_CONFIG.apiKey,
  responsesUrl: `${DMX_CONFIG.baseUrl}/responses`,
  model: 'qwen3-omni-flash-all'
};

// 调用 DMXAPI 大模型（文本对话，用于题诗等）
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
    const response = await axios.post(url, payload, { headers });
    console.log('DMXAPI Response:', response.data?.choices?.[0]?.message ? 'OK' : response.data);
    return response.data;
  } catch (error) {
    console.error('DMXAPI 调用失败:', error.response?.data || error.message);
    throw error;
  }
}

/**
 * 调用 qwen3-omni-flash 多模态模型（文+图 -> 文），仅支持流式输出
 * 文档要求 stream 必须为 true
 */
async function callQwenOmniImageToText(imageDataUrl, textPrompt) {
  const url = OMNI_CONFIG.responsesUrl;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': OMNI_CONFIG.apiKey
  };
  // DMXAPI Responses 接口：本地图片用 input_image + input_text，见 doc.dmxapi.com/res-base64-image.html
  const payload = {
    model: OMNI_CONFIG.model,
    input: [
      {
        role: 'user',
        content: [
          { type: 'input_image', image_url: imageDataUrl },
          { type: 'input_text', text: textPrompt }
        ]
      }
    ],
    stream: true,
    stream_options: { include_usage: true },
    modalities: ['text']
  };

  console.log('Qwen-Omni 请求:', url, 'model:', OMNI_CONFIG.model);
  const response = await axios.post(url, payload, {
    headers,
    responseType: 'stream',
    timeout: 60000
  });

  if (response.status !== 200) {
    throw new Error(`Qwen-Omni HTTP ${response.status}: ${response.statusText}`);
  }

  return new Promise((resolve, reject) => {
    let fullText = '';
    let currentEvent = null;
    let buffer = '';

    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('event: ')) {
          currentEvent = trimmed.slice(7).trim();
        } else if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            if (currentEvent === 'response.output_text.delta' && data.delta) {
              fullText += data.delta;
            }
          } catch (_) {}
        }
      }
    });

    response.data.on('end', () => {
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          if (currentEvent === 'response.output_text.delta' && data.delta) fullText += data.delta;
        } catch (_) {}
      }
      resolve(fullText.trim() || '抱歉，分析失败');
    });

    response.data.on('error', reject);
  });
}

// 历史记录存储文件（测试时可从环境变量覆盖）
const HISTORY_FILE = process.env.HISTORY_FILE || path.join(__dirname, 'history.json');

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

// 2. 分析画作（多模态：传入图片，由大模型看图写专业赏析，200-300 字）
app.post('/api/analyze', async (req, res) => {
  try {
    const { imagePath, imageUrl } = req.body;
    console.log('收到分析请求:', { imagePath, imageUrl });

    if (!imagePath || !fs.existsSync(imagePath)) {
      return res.status(400).json({ success: false, error: '图片路径无效' });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${base64}`;

    const prompt = `你是一位中国画鉴赏专家。请结合本图，从专业角度对这幅中国画进行赏析评论，需涵盖：
1. 题材与内容：画作描绘了什么主题与物象？
2. 构图与布局：画面构图、疏密、留白有何特点？
3. 技法与风格：用笔、用墨、设色等技法与风格特征？
4. 意境与情感：画作传达的意境与情感？
5. 艺术价值：简要评价其艺术价值。

要求：语言专业、优美流畅，字数严格控制在 200-300 字。`;

    const analysis = await callQwenOmniImageToText(dataUrl, prompt);
    console.log('AI分析结果长度:', analysis?.length);

    res.json({ success: true, analysis: analysis || '抱歉，分析失败' });
  } catch (error) {
    console.error('分析API错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 诗/词风格与对应 prompt 描述（诗：体裁；词：风格流派）
const STYLE_PROMPTS = {
  '诗-五言绝句': '体裁为五言绝句，四句二十字，符合格律',
  '诗-七言绝句': '体裁为七言绝句，四句二十八字，符合格律',
  '诗-五言律诗': '体裁为五言律诗，八句四十字，符合格律',
  '诗-七言律诗': '体裁为七言律诗，八句五十六字，符合格律',
  '诗-古体诗': '体裁为古体诗，句数、用韵可较自由',
  '词-婉约': '词体，婉约派风格，含蓄细腻',
  '词-豪放': '词体，豪放派风格，开阔激昂',
  '词-田园': '词体，田园山水风格，清新自然',
  '词-边塞': '词体，边塞风格，苍凉慷慨'
};

// 3. 生成诗词（须带标题，内容与 AI 赏析及用户感悟契合）
app.post('/api/poem', async (req, res) => {
  try {
    const { analysis, userFeeling, style } = req.body;

    const stylePrompt = STYLE_PROMPTS[style] || '体裁与风格自由发挥，可为诗或词';

    const prompt = `你是一位擅长题画诗/词的诗人。请根据下面的「画作赏析」与「用户感悟」，为这幅中国画创作一首题画作品。

【画作赏析】
${analysis}

【用户感悟】
${userFeeling}

要求：
1. 体裁与形式：${stylePrompt}
2. 必须给出一个切题的标题（单独一行，如「题某某图」），标题要与画意、赏析、感悟契合
3. 正文内容必须紧扣上述赏析与感悟，意境一致，不可泛泛而谈
4. 仅输出：第一行为标题，空一行后为正文（可含简短创作说明），不要其他前缀或解释`;

    const messages = [
      { role: 'user', content: prompt }
    ];

    const result = await callSparkAI(messages);
    const raw = result.choices?.[0]?.message?.content || '抱歉，创作失败';

    const { title, poem } = parseTitleAndPoem(raw);
    res.json({ success: true, title, poem: poem || raw });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

function parseTitleAndPoem(raw) {
  const lines = raw.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return { title: '无题', poem: raw };
  const first = lines[0];
  if (first.length <= 30 && !first.includes('。') && !first.includes('，')) {
    return { title: first, poem: lines.slice(1).join('\n') || raw };
  }
  return { title: '无题', poem: raw };
}

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

// 仅直接运行时启动服务，便于测试时只导入 app
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`🎨 墨韵 AI 后端服务已启动: http://localhost:${PORT}`);
  });
}

module.exports = app;
