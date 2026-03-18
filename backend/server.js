require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const path = require('path');
const fs = require('fs');
const Database = require('better-sqlite3');

const app = express();
const PORT = process.env.PORT || 3001;

// 中间件
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static('uploads'));

// ==================== 性能优化 ====================

// 内存缓存（用于 AI 分析结果）
const analysisCache = new Map();
const CACHE_TTL = 1000 * 60 * 30; // 30 分钟缓存

// 获取缓存
function getCache(key) {
  const item = analysisCache.get(key);
  if (!item) return null;
  if (Date.now() - item.timestamp > CACHE_TTL) {
    analysisCache.delete(key);
    return null;
  }
  return item.data;
}

// 设置缓存
function setCache(key, data) {
  analysisCache.set(key, { data, timestamp: Date.now() });
}

// 生成缓存 key（基于图片文件内容）
function generateCacheKey(imagePath) {
  const stats = fs.statSync(imagePath);
  return `${imagePath}-${stats.size}-${stats.mtime.getTime()}`;
}

// 定期清理过期缓存
setInterval(() => {
  const now = Date.now();
  for (const [key, item] of analysisCache) {
    if (now - item.timestamp > CACHE_TTL) {
      analysisCache.delete(key);
    }
  }
}, 1000 * 60 * 10); // 每 10 分钟清理一次

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'uploads');
const compressedDir = path.join(__dirname, 'uploads', 'compressed');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(compressedDir)) {
  fs.mkdirSync(compressedDir, { recursive: true });
}

// 图片压缩函数（使用 Canvas 或简单缩放）
async function compressImage(inputPath, outputPath, maxWidth = 1200, quality = 0.8) {
  return new Promise((resolve, reject) => {
    try {
      // 使用 sharp 进行压缩（如果可用）
      const sharp = require('sharp');
      sharp(inputPath)
        .resize(maxWidth, null, { fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: Math.round(quality * 100), mozjpeg: true })
        .toFile(outputPath)
        .then(() => resolve(outputPath))
        .catch(reject);
    } catch (e) {
      // sharp 不可用，直接复制文件
      fs.copyFileSync(inputPath, outputPath);
      resolve(outputPath);
    }
  });
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

// API 配置（从环境变量读取）
const DMX_CONFIG = {
  apiKey: process.env.DMX_API_KEY || '',
  baseUrl: process.env.DMX_BASE_URL || 'https://www.dmxapi.cn/v1',
  model: process.env.DMX_MODEL || 'gpt-5-mini'
};

const OMNI_CONFIG = {
  apiKey: DMX_CONFIG.apiKey,
  chatUrl: `${DMX_CONFIG.baseUrl}/chat/completions`,
  model: process.env.VISION_MODEL || 'Doubao-1.5-vision-pro-32k'
};

// ==================== 多模型配置 ====================

// 可用的文本模型列表（2026年3月更新）
const TEXT_MODELS = {
  // OpenAI 系列
  'gpt-4o': { name: 'GPT-4o', provider: 'openai', description: '强大稳定，创作质量高', tested: true },
  'gpt-5-mini': { name: 'GPT-5 Mini', provider: 'openai', description: '最新轻量版', tested: false },
  'gpt-5': { name: 'GPT-5', provider: 'openai', description: '最新旗舰模型', tested: false },
  // Anthropic 系列
  'claude-3-7-sonnet': { name: 'Claude 3.7 Sonnet', provider: 'anthropic', description: '最新版本，推理更强', tested: false },
  // DeepSeek 系列
  'deepseek-chat': { name: 'DeepSeek V3', provider: 'deepseek', description: '中文理解出色', tested: true },
  'deepseek-reasoner': { name: 'DeepSeek R1', provider: 'deepseek', description: '深度思考模型', tested: false },
  // 阿里系列
  'qwen-max': { name: '通义千问 Max', provider: 'alibaba', description: '最强版本', tested: false },
  // Google 系列
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', provider: 'google', description: 'Google最强', tested: false }
};

// 可用的视觉模型列表（2026年3月更新）
const VISION_MODELS = {
  // OpenAI 系列
  'gpt-4o': { name: 'GPT-4o', provider: 'openai', description: '强大图像理解', tested: true },
  'gpt-4o-mini': { name: 'GPT-4o Mini', provider: 'openai', description: '快速图像分析', tested: true },
  'gpt-5-mini': { name: 'GPT-5 Mini', provider: 'openai', description: '最新轻量版', tested: false },
  // Anthropic 系列
  'claude-3-7-sonnet': { name: 'Claude 3.7 Sonnet', provider: 'anthropic', description: '最新版本', tested: false },
  // 阿里系列
  'qwen-vl-max': { name: '通义千问 VL Max', provider: 'alibaba', description: '最强视觉版', tested: false },
  'qwen-vl-plus': { name: '通义千问 VL Plus', provider: 'alibaba', description: '中国画专长', tested: true },
  // 字节系列
  'doubao-1.5-vision-pro-32k': { name: '豆包视觉 Pro 32K', provider: 'bytedance', description: '默认视觉模型', tested: true },
  // Google 系列
  'gemini-2.5-pro': { name: 'Gemini 2.5 Pro', provider: 'google', description: 'Google最强视觉', tested: false }
};

// 当前选中的模型（可动态切换）
let currentTextModel = process.env.DMX_MODEL || 'gpt-4o';
let currentVisionModel = process.env.VISION_MODEL || 'gpt-4o';

// ==================== 提示词模板管理 ====================

// 默认提示词模板
const DEFAULT_TEMPLATES = {
  analysis: {
    id: 'default-analysis',
    name: '默认赏析模板',
    template: `你是一位中国画鉴赏专家。请结合本图，从专业角度对这幅中国画进行赏析评论，需涵盖：
1. 题材与内容：画作描绘了什么主题与物象？
2. 构图与布局：画面构图、疏密、留白有何特点？
3. 技法与风格：用笔、用墨、设色等技法与风格特征？
4. 意境与情感：画作传达的意境与情感？
5. 艺术价值：简要评价其艺术价值。

要求：语言专业、优美流畅，字数严格控制在 200-300 字。

最后请另起一行，以"【流派】"开头，写出该画所属的流派/画科（如：山水画、花鸟画、人物画、工笔画、写意画等），只写流派名称。`
  },
  poem: {
    id: 'default-poem',
    name: '默认诗词模板',
    template: `你是一位擅长题画诗/词的诗人。请根据下面的「画作赏析」与「用户感悟」，为这幅中国画创作一首题画作品。

【画作赏析】
{analysis}

【用户感悟】
{userFeeling}

要求：
1. 体裁与形式：{style}
2. 必须给出一个切题的标题（单独一行，如「题某某图」），标题要与画意、赏析、感悟契合
3. 正文内容必须紧扣上述赏析与感悟，意境一致，不可泛泛而谈
4. 仅输出：第一行为标题，空一行后为正文（可含简短创作说明），不要其他前缀或解释`
  },
  polish: {
    id: 'default-polish',
    name: '默认润色模板',
    template: `你是一位精通古诗词的文学专家。请对以下诗词进行润色优化：

【原标题】{title}
【原诗】
{poem}

【原风格】{style}

要求：
1. 保持原意和情感基调不变
2. 优化用词，使其更加典雅、凝练
3. 检查格律是否工整，如有问题请修正
4. 如有典故引用不当，请指出并修正

请按以下格式输出（严格遵循）：
【润色标题】新标题
【润色诗词】
润色后的诗词正文
【修改说明】
简要说明修改了什么（2-3句话）`
  }
};

// 从数据库加载自定义模板
function loadTemplates() {
  try {
    const rows = db.prepare('SELECT * FROM prompt_templates').all();
    const templates = { ...DEFAULT_TEMPLATES };
    for (const row of rows) {
      templates[row.id] = {
        id: row.id,
        name: row.name,
        template: row.template,
        isCustom: true
      };
    }
    return templates;
  } catch (e) {
    return DEFAULT_TEMPLATES;
  }
}

// 保存自定义模板
function saveTemplate(id, name, template) {
  db.prepare(`
    INSERT OR REPLACE INTO prompt_templates (id, name, template, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, name, template, new Date().toISOString(), new Date().toISOString());
}

// ==================== SQLite 数据库 ====================
const DB_PATH = process.env.DB_PATH || path.join(__dirname, 'moyun.db');
const db = new Database(DB_PATH);

// 启用 WAL 模式提升并发性能
db.pragma('journal_mode = WAL');

// 初始化表
db.exec(`
  CREATE TABLE IF NOT EXISTS history (
    id TEXT PRIMARY KEY,
    imageUrl TEXT,
    analysis TEXT,
    userFeeling TEXT,
    poem TEXT,
    title TEXT DEFAULT '无题',
    style TEXT DEFAULT '',
    genre TEXT DEFAULT '',
    tags TEXT DEFAULT '[]',
    favorite INTEGER DEFAULT 0,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,
    name TEXT,
    content TEXT NOT NULL,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS paintings (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    artist TEXT,
    dynasty TEXT,
    school TEXT,
    category TEXT,
    imageUrl TEXT NOT NULL,
    description TEXT,
    width INTEGER,
    height INTEGER,
    createdAt TEXT
  );

  CREATE TABLE IF NOT EXISTS gallery_favorites (
    id TEXT PRIMARY KEY,
    paintingId TEXT NOT NULL,
    sessionId TEXT NOT NULL,
    createdAt TEXT,
    UNIQUE(paintingId, sessionId)
  );

  CREATE TABLE IF NOT EXISTS prompt_templates (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    template TEXT NOT NULL,
    createdAt TEXT,
    updatedAt TEXT
  );

  CREATE TABLE IF NOT EXISTS user_settings (
    key TEXT PRIMARY KEY,
    value TEXT,
    updatedAt TEXT
  )
`);

// 从旧 history.json 迁移数据（仅一次）
function migrateFromJson() {
  const jsonPath = path.join(__dirname, 'history.json');
  if (!fs.existsSync(jsonPath)) return;
  try {
    const data = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
    if (!Array.isArray(data) || data.length === 0) return;
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM history').get();
    if (existing.cnt > 0) return; // 已有数据，不重复迁移
    const insert = db.prepare(`
      INSERT OR IGNORE INTO history (id, imageUrl, analysis, userFeeling, poem, title, style, favorite, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)
    `);
    const tx = db.transaction((records) => {
      for (const r of records) {
        insert.run(r.id || uuidv4(), r.imageUrl, r.analysis, r.userFeeling, r.poem, r.title || '无题', r.style || '', r.createdAt || new Date().toISOString());
      }
    });
    tx(data);
    console.log(`已从 history.json 迁移 ${data.length} 条记录到 SQLite`);
  } catch (e) {
    console.error('JSON 迁移失败:', e.message);
  }
}
migrateFromJson();

// ==================== AI 调用 ====================

async function callSparkAI(messages, model = null) {
  try {
    const url = `${DMX_CONFIG.baseUrl}/chat/completions`;
    const headers = {
      'Accept': 'application/json',
      'Authorization': DMX_CONFIG.apiKey,
      'Content-Type': 'application/json'
    };
    const useModel = model || currentTextModel || DMX_CONFIG.model;
    const payload = { model: useModel, messages };
    console.log('AI Request - Model:', useModel, 'URL:', url);
    const response = await axios.post(url, payload, { headers });
    console.log('AI Response:', response.data?.choices?.[0]?.message ? 'OK' : response.data);
    return response.data;
  } catch (error) {
    console.error('AI 调用失败:', error.response?.data || error.message);
    throw error;
  }
}

async function callQwenOmniImageToText(imageDataUrl, textPrompt, model = null) {
  const url = OMNI_CONFIG.chatUrl;
  const useModel = model || currentVisionModel || OMNI_CONFIG.model;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': OMNI_CONFIG.apiKey
  };
  const payload = {
    model: useModel,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: textPrompt }
      ]
    }],
    stream: true
  };

  console.log('Vision AI 请求:', url, 'model:', useModel);
  let response;
  try {
    response = await axios.post(url, payload, {
      headers,
      responseType: 'stream',
      timeout: 60000
    });
  } catch (err) {
    // 尝试读取错误响应体
    if (err.response && err.response.data) {
      const errorData = [];
      await new Promise((resolve) => {
        err.response.data.on('data', chunk => errorData.push(chunk));
        err.response.data.on('end', resolve);
      });
      const errorText = Buffer.concat(errorData).toString();
      console.error('Doubao Vision 错误响应:', errorText);
      throw new Error(`API 错误: ${errorText}`);
    }
    throw err;
  }

  if (response.status !== 200) {
    throw new Error(`Doubao Vision HTTP ${response.status}: ${response.statusText}`);
  }

  return new Promise((resolve, reject) => {
    let fullText = '';
    let buffer = '';
    response.data.on('data', (chunk) => {
      buffer += chunk.toString();
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || '';
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('data: ')) {
          const dataStr = trimmed.slice(6).trim();
          if (dataStr === '[DONE]') continue;
          try {
            const data = JSON.parse(dataStr);
            const delta = data.choices?.[0]?.delta?.content;
            if (delta) fullText += delta;
          } catch (_) {}
        }
      }
    });
    response.data.on('end', () => {
      if (buffer.trim().startsWith('data: ')) {
        try {
          const data = JSON.parse(buffer.trim().slice(6));
          const delta = data.choices?.[0]?.delta?.content;
          if (delta) fullText += delta;
        } catch (_) {}
      }
      resolve(fullText.trim() || '抱歉，分析失败');
    });
    response.data.on('error', reject);
  });
}

// ==================== 诗词风格 ====================

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

// 风格重写映射
const REWRITE_STYLE_PROMPTS = {
  '五言绝句': '改写为五言绝句，四句二十字，符合格律',
  '七言绝句': '改写为七言绝句，四句二十八字，符合格律',
  '五言律诗': '改写为五言律诗，八句四十字，符合格律',
  '七言律诗': '改写为七言律诗，八句五十六字，符合格律',
  '古体诗': '改写为古体诗，句数、用韵可较自由',
  '婉约词': '改写为婉约派词作，含蓄细腻',
  '豪放词': '改写为豪放派词作，开阔激昂',
  '田园词': '改写为田园山水风格词作，清新自然',
  '边塞词': '改写为边塞风格词作，苍凉慷慨'
};

function parseTitleAndPoem(raw) {
  const lines = raw.trim().split(/\r?\n/).map(s => s.trim()).filter(Boolean);
  if (lines.length === 0) return { title: '无题', poem: raw };
  const first = lines[0];
  if (first.length <= 30 && !first.includes('。') && !first.includes('，')) {
    // 去除标题首尾的 ** 符号（Markdown 粗体标记）
    let title = first.replace(/^\*+|\*+$/g, '').trim();
    return { title: title || '无题', poem: lines.slice(1).join('\n') || raw };
  }
  return { title: '无题', poem: raw };
}

// ==================== API 路由 ====================

// 1. 上传图片（支持压缩）
app.post('/api/upload', upload.single('image'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: '请上传图片' });

  const originalPath = req.file.path;
  const filename = req.file.filename;
  const compressedFilename = `compressed_${filename.replace(/\.[^.]+$/, '.jpg')}`;
  const compressedPath = path.join(compressedDir, compressedFilename);

  try {
    // 尝试压缩图片
    await compressImage(originalPath, compressedPath, 1200, 0.8);

    // 检查压缩后是否更小
    const originalSize = fs.statSync(originalPath).size;
    const compressedSize = fs.statSync(compressedPath).size;

    let finalUrl, finalPath;
    if (compressedSize < originalSize * 0.9) {
      // 压缩后小于原文件 90%，使用压缩版本
      finalUrl = `/uploads/compressed/${compressedFilename}`;
      finalPath = compressedPath;
      // 删除原文件以节省空间
      fs.unlinkSync(originalPath);
    } else {
      // 压缩效果不明显，使用原文件
      finalUrl = `/uploads/${filename}`;
      finalPath = originalPath;
      fs.unlinkSync(compressedPath);
    }

    res.json({
      success: true,
      url: finalUrl,
      filename: path.basename(finalUrl),
      fullPath: finalPath,
      originalSize,
      compressedSize: compressedSize < originalSize * 0.9 ? compressedSize : originalSize
    });
  } catch (err) {
    // 压缩失败，使用原文件
    console.error('图片压缩失败:', err.message);
    res.json({
      success: true,
      url: `/uploads/${filename}`,
      filename,
      fullPath: originalPath
    });
  }
});

// 2. 分析画作（支持缓存）
app.post('/api/analyze', async (req, res) => {
  try {
    const { imagePath } = req.body;
    if (!imagePath || !fs.existsSync(imagePath)) {
      return res.status(400).json({ success: false, error: '图片路径无效' });
    }

    // 检查缓存
    const cacheKey = generateCacheKey(imagePath);
    const cached = getCache(cacheKey);
    if (cached) {
      console.log('使用缓存的分析结果');
      return res.json({ success: true, ...cached, fromCache: true });
    }

    const imageBuffer = fs.readFileSync(imagePath);
    const base64 = imageBuffer.toString('base64');
    const ext = path.extname(imagePath).toLowerCase();
    const mime = ext === '.png' ? 'image/png' : ext === '.webp' ? 'image/webp' : 'image/jpeg';
    const dataUrl = `data:${mime};base64,${base64}`;

    // 使用自定义模板
    const templates = loadTemplates();
    const prompt = templates.analysis.template;

    const analysisRaw = await callQwenOmniImageToText(dataUrl, prompt);

    // 从文本中提取流派
    let analysisText = analysisRaw;
    let genre = '';
    const genreMatch = analysisRaw.match(/【流派】\s*(.+)/);
    if (genreMatch) {
      genre = genreMatch[1].trim();
      analysisText = analysisRaw.replace(/【流派】.+/, '').trim();
    }

    const result = { analysis: analysisText || '抱歉，分析失败', genre };

    // 存入缓存
    setCache(cacheKey, result);

    res.json({ success: true, ...result });
  } catch (error) {
    console.error('分析API错误:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 3. 生成诗词
app.post('/api/poem', async (req, res) => {
  try {
    const { analysis, userFeeling, style, customStyle } = req.body;
    let stylePrompt;
    if (customStyle) {
      stylePrompt = `按照以下风格要求创作：${customStyle}`;
    } else {
      stylePrompt = STYLE_PROMPTS[style] || '体裁与风格自由发挥，可为诗或词';
    }

    // 使用自定义模板并替换变量
    const templates = loadTemplates();
    let prompt = templates.poem.template;
    prompt = prompt.replace(/{analysis}/g, analysis || '');
    prompt = prompt.replace(/{userFeeling}/g, userFeeling || '');
    prompt = prompt.replace(/{style}/g, stylePrompt);

    const messages = [{ role: 'user', content: prompt }];
    const result = await callSparkAI(messages);
    const raw = result.choices?.[0]?.message?.content || '抱歉，创作失败';
    const { title, poem } = parseTitleAndPoem(raw);
    res.json({ success: true, title, poem: poem || raw });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. 获取历史记录（支持搜索、分页、筛选）
app.get('/api/history', (req, res) => {
  try {
    const { search, page = 1, pageSize = 20, favoriteOnly, style } = req.query;
    const pageNum = Math.max(1, parseInt(page));
    const size = Math.min(100, Math.max(1, parseInt(pageSize) || 20));
    const offset = (pageNum - 1) * size;

    let where = [];
    let params = [];

    if (search) {
      where.push('(title LIKE ? OR poem LIKE ? OR analysis LIKE ? OR userFeeling LIKE ?)');
      const q = `%${search}%`;
      params.push(q, q, q, q);
    }
    if (favoriteOnly === 'true') {
      where.push('favorite = 1');
    }
    if (style) {
      where.push('style = ?');
      params.push(style);
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) as total FROM history ${whereClause}`;
    const { total } = db.prepare(countSql).get(...params);

    const dataSql = `SELECT * FROM history ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`;
    const history = db.prepare(dataSql).all(...params, size, offset);

    res.json({
      success: true,
      history,
      pagination: {
        page: pageNum,
        pageSize: size,
        total,
        totalPages: Math.ceil(total / size)
      }
    });
  } catch (error) {
    console.error('获取历史失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. 删除历史记录
app.delete('/api/history/:id', (req, res) => {
  try {
    db.prepare('DELETE FROM history WHERE id = ?').run(req.params.id);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 6. 保存赏画记录
app.post('/api/save', (req, res) => {
  try {
    const { imageUrl, analysis, userFeeling, poem, title, style, genre, tags } = req.body;
    const record = {
      id: uuidv4(),
      imageUrl,
      analysis,
      userFeeling,
      poem,
      title: title || '无题',
      style: style || '',
      genre: genre || '',
      tags: JSON.stringify(tags || []),
      favorite: 0,
      createdAt: new Date().toISOString()
    };
    db.prepare(`
      INSERT INTO history (id, imageUrl, analysis, userFeeling, poem, title, style, genre, tags, favorite, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(record.id, record.imageUrl, record.analysis, record.userFeeling, record.poem, record.title, record.style, record.genre, record.tags, record.favorite, record.createdAt);
    res.json({ success: true, record });
  } catch (error) {
    console.error('保存失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// 7. 更新历史记录（编辑诗词）
app.patch('/api/history/:id', (req, res) => {
  try {
    const { poem, title } = req.body;
    const updates = [];
    const params = [];
    if (poem !== undefined) { updates.push('poem = ?'); params.push(poem); }
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (updates.length === 0) return res.status(400).json({ success: false, error: '无更新内容' });
    params.push(req.params.id);
    db.prepare(`UPDATE history SET ${updates.join(', ')} WHERE id = ?`).run(...params);
    const record = db.prepare('SELECT * FROM history WHERE id = ?').get(req.params.id);
    res.json({ success: true, record });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 8. 切换收藏状态
app.patch('/api/history/:id/favorite', (req, res) => {
  try {
    const record = db.prepare('SELECT * FROM history WHERE id = ?').get(req.params.id);
    if (!record) return res.status(404).json({ success: false, error: '记录不存在' });
    const newFav = record.favorite ? 0 : 1;
    db.prepare('UPDATE history SET favorite = ? WHERE id = ?').run(newFav, req.params.id);
    res.json({ success: true, favorite: newFav });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 9. 导出全部历史记录
app.get('/api/export', (req, res) => {
  try {
    const { format = 'json' } = req.query;
    const history = db.prepare('SELECT * FROM history ORDER BY createdAt DESC').all();

    if (format === 'csv') {
      const headers = ['ID', '标题', '诗词', '赏析', '用户感悟', '风格', '流派', '标签', '收藏', '创建时间', '图片URL']
      const rows = history.map(h => [
        h.id,
        h.title,
        h.poem?.replace(/"/g, '""') || '',
        h.analysis?.replace(/"/g, '""') || '',
        h.userFeeling?.replace(/"/g, '""') || '',
        h.style,
        h.genre,
        h.tags,
        h.favorite,
        h.createdAt,
        h.imageUrl
      ])
      const csv = [headers.join(','), ...rows.map(r => r.map(v => `"${v || ''}"`).join(','))].join('\n')
      res.setHeader('Content-Type', 'text/csv;charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename=moyun_backup_${new Date().toISOString().slice(0,10)}.csv`)
      res.send('\ufeff' + csv)
    } else {
      // JSON 格式
      res.setHeader('Content-Type', 'application/json;charset=utf-8')
      res.setHeader('Content-Disposition', `attachment; filename=moyun_backup_${new Date().toISOString().slice(0,10)}.json`)
      res.json({
        version: '1.0',
        exportedAt: new Date().toISOString(),
        total: history.length,
        data: history
      })
    }
  } catch (error) {
    console.error('导出失败:', error)
    res.status(500).json({ success: false, error: error.message });
  }
});

// 10. 导入历史记录
app.post('/api/import', (req, res) => {
  try {
    const { data, mode = 'merge' } = req.body;

    if (!Array.isArray(data)) {
      return res.status(400).json({ success: false, error: '数据格式错误，需要数组' });
    }

    let imported = 0;
    let skipped = 0;

    if (mode === 'replace') {
      // 替换模式：清空现有数据
      db.prepare('DELETE FROM history').run();
    }

    const insert = db.prepare(`
      INSERT OR REPLACE INTO history (id, imageUrl, analysis, userFeeling, poem, title, style, genre, tags, favorite, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const tx = db.transaction((records) => {
      for (const r of records) {
        if (r.id && r.title && r.poem) {
          insert.run(
            r.id || uuidv4(),
            r.imageUrl || '',
            r.analysis || '',
            r.userFeeling || '',
            r.poem || '',
            r.title || '无题',
            r.style || '',
            r.genre || '',
            typeof r.tags === 'string' ? r.tags : JSON.stringify(r.tags || []),
            r.favorite ? 1 : 0,
            r.createdAt || new Date().toISOString()
          )
          imported++
        } else {
          skipped++
        }
      }
    })

    tx(data)
    res.json({ success: true, imported, skipped, total: data.length })
  } catch (error) {
    console.error('导入失败:', error)
    res.status(500).json({ success: false, error: error.message });
  }
});

// 11. 批量更新标签
app.patch('/api/history/:id/tags', (req, res) => {
  try {
    const { tags } = req.body
    if (!Array.isArray(tags)) {
      return res.status(400).json({ success: false, error: '标签格式错误' })
    }
    db.prepare('UPDATE history SET tags = ? WHERE id = ?').run(JSON.stringify(tags), req.params.id)
    const record = db.prepare('SELECT * FROM history WHERE id = ?').get(req.params.id)
    res.json({ success: true, tags: record?.tags })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 12. 批量操作
app.post('/api/history/batch', (req, res) => {
  try {
    const { ids, action, data } = req.body
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ success: false, error: '请选择要操作的项目' })
    }

    if (action === 'delete') {
      const placeholders = ids.map(() => '?').join(',')
      db.prepare(`DELETE FROM history WHERE id IN (${placeholders})`).run(...ids)
      res.json({ success: true, deleted: ids.length })
    } else if (action === 'favorite') {
      const placeholders = ids.map(() => '?').join(',')
      db.prepare(`UPDATE history SET favorite = ? WHERE id IN (${placeholders})`).run(data.favorite ? 1 : 0, ...ids)
      res.json({ success: true, updated: ids.length })
    } else {
      res.status(400).json({ success: false, error: '未知操作' })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 13. 删除全部历史记录
app.delete('/api/history', (req, res) => {
  try {
    const result = db.prepare('DELETE FROM history').run()
    res.json({ success: true, deleted: result.changes })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 留言 API ====================

// 获取留言列表
app.get('/api/messages', (req, res) => {
  try {
    const messages = db.prepare('SELECT * FROM messages ORDER BY createdAt DESC LIMIT 50').all()
    res.json({ success: true, messages })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 提交留言
app.post('/api/messages', (req, res) => {
  try {
    const { name, content } = req.body
    if (!content || content.trim() === '') {
      return res.status(400).json({ success: false, error: '留言内容不能为空' })
    }
    if (content.length > 500) {
      return res.status(400).json({ success: false, error: '留言内容不能超过500字' })
    }
    const id = uuidv4()
    const createdAt = new Date().toISOString()
    db.prepare('INSERT INTO messages (id, name, content, createdAt) VALUES (?, ?, ?, ?)').run(
      id,
      (name || '匿名用户').slice(0, 50),
      content.trim(),
      createdAt
    )
    res.json({ success: true, message: { id, name: name || '匿名用户', content: content.trim(), createdAt } })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== AI 增强功能 API ====================

// 14. 诗词润色
app.post('/api/polish', async (req, res) => {
  try {
    const { poem, title, style } = req.body
    if (!poem || poem.trim() === '') {
      return res.status(400).json({ success: false, error: '诗词内容不能为空' })
    }

    const styleDesc = STYLE_PROMPTS[style] || '古诗词'
    const prompt = `你是一位精通古诗词的文学专家。请对以下诗词进行润色优化：

【原标题】${title || '无题'}
【原诗】
${poem}

【原风格】${styleDesc}

要求：
1. 保持原意和情感基调不变
2. 优化用词，使其更加典雅、凝练
3. 检查格律是否工整，如有问题请修正
4. 如有典故引用不当，请指出并修正

请按以下格式输出（严格遵循）：
【润色标题】新标题
【润色诗词】
润色后的诗词正文
【修改说明】
简要说明修改了什么（2-3句话）`

    const messages = [{ role: 'user', content: prompt }]
    const result = await callSparkAI(messages)
    const raw = result.choices?.[0]?.message?.content || ''

    // 解析输出
    let polishedTitle = title || '无题'
    let polishedPoem = poem
    let suggestions = ''

    const titleMatch = raw.match(/【润色标题】\s*(.+)/)
    const poemMatch = raw.match(/【润色诗词】\s*([\s\S]+?)(?=【修改说明】|$)/)
    const suggestMatch = raw.match(/【修改说明】\s*([\s\S]+)$/)

    if (titleMatch) polishedTitle = titleMatch[1].trim().replace(/^\*+|\*+$/g, '').trim()
    if (poemMatch) polishedPoem = poemMatch[1].trim()
    if (suggestMatch) suggestions = suggestMatch[1].trim()

    res.json({
      success: true,
      polishedTitle,
      polishedPoem,
      suggestions
    })
  } catch (error) {
    console.error('润色失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 15. 风格重写
app.post('/api/rewrite', async (req, res) => {
  try {
    const { poem, title, targetStyle } = req.body
    if (!poem || poem.trim() === '') {
      return res.status(400).json({ success: false, error: '诗词内容不能为空' })
    }
    if (!targetStyle) {
      return res.status(400).json({ success: false, error: '请选择目标风格' })
    }

    const stylePrompt = REWRITE_STYLE_PROMPTS[targetStyle] || targetStyle
    const prompt = `你是一位精通古诗词的文学专家。请将以下诗词改写为指定风格：

【原标题】${title || '无题'}
【原诗】
${poem}

【改写要求】${stylePrompt}

要求：
1. 保持原诗的意境和情感不变
2. 严格按照目标风格的格律要求改写
3. 用词要典雅，符合改写后的风格特点
4. 标题可适当调整以契合新风格

请按以下格式输出（严格遵循）：
【新标题】新标题
【新诗词】
改写后的诗词正文`

    const messages = [{ role: 'user', content: prompt }]
    const result = await callSparkAI(messages)
    const raw = result.choices?.[0]?.message?.content || ''

    // 解析输出
    let newTitle = title || '无题'
    let newPoem = poem

    const titleMatch = raw.match(/【新标题】\s*(.+)/)
    const poemMatch = raw.match(/【新诗词】\s*([\s\S]+)$/)

    if (titleMatch) newTitle = titleMatch[1].trim().replace(/^\*+|\*+$/g, '').trim()
    if (poemMatch) newPoem = poemMatch[1].trim()

    res.json({
      success: true,
      newTitle,
      newPoem,
      targetStyle
    })
  } catch (error) {
    console.error('重写失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 16. 诗词解析
app.post('/api/analyze-poem', async (req, res) => {
  try {
    const { poem, title } = req.body
    if (!poem || poem.trim() === '') {
      return res.status(400).json({ success: false, error: '诗词内容不能为空' })
    }

    const prompt = `你是一位精通古诗词的文学专家。请对以下诗词进行深度解析：

【标题】${title || '无题'}
【诗词】
${poem}

请从以下角度进行详细解析：

1. **典故引用**：诗中引用了哪些典故？出处何在？请逐一说明。如无典故，请说明"本诗未明显引用典故"。

2. **意象分析**：诗中有哪些意象？分别象征什么？营造了怎样的意境？

3. **格律分析**：这是什么体裁（五言绝句、七言律诗等）？格律是否工整？押韵情况如何？

4. **情感表达**：这首诗表达了什么情感？情感基调如何？

5. **艺术评价**：简要评价这首诗的艺术价值和特色。

请用优美的文学语言进行分析，每个部分约100字左右。`

    const messages = [{ role: 'user', content: prompt }]
    const result = await callSparkAI(messages)
    const analysis = result.choices?.[0]?.message?.content || '解析失败，请重试'

    res.json({
      success: true,
      analysis
    })
  } catch (error) {
    console.error('解析失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 画廊功能 ====================

// 初始化画作数据
function initPaintings() {
  const paintingsPath = path.join(__dirname, 'paintings.json')
  if (!fs.existsSync(paintingsPath)) return

  try {
    const existing = db.prepare('SELECT COUNT(*) as cnt FROM paintings').get()
    if (existing.cnt > 0) return // 已有数据，不重复初始化

    const paintings = JSON.parse(fs.readFileSync(paintingsPath, 'utf-8'))
    const insert = db.prepare(`
      INSERT INTO paintings (id, name, artist, dynasty, school, category, imageUrl, description, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)
    const tx = db.transaction((items) => {
      for (const p of items) {
        insert.run(
          p.id,
          p.name,
          p.artist || '',
          p.dynasty || '',
          p.school || '',
          p.category || '',
          p.imageUrl,
          p.description || '',
          new Date().toISOString()
        )
      }
    })
    tx(paintings)
    console.log(`已初始化 ${paintings.length} 幅画作`)
  } catch (e) {
    console.error('初始化画作失败:', e.message)
  }
}
initPaintings()

// 17. 获取画作列表
app.get('/api/gallery', (req, res) => {
  try {
    const { search, dynasty, category, page = 1, pageSize = 12, sessionId } = req.query
    const pageNum = Math.max(1, parseInt(page))
    const size = Math.min(50, Math.max(1, parseInt(pageSize) || 12))
    const offset = (pageNum - 1) * size

    let where = []
    let params = []

    if (search) {
      where.push('(name LIKE ? OR artist LIKE ? OR dynasty LIKE ?)')
      const q = `%${search}%`
      params.push(q, q, q)
    }
    if (dynasty) {
      where.push('dynasty = ?')
      params.push(dynasty)
    }
    if (category) {
      where.push('category = ?')
      params.push(category)
    }

    const whereClause = where.length > 0 ? `WHERE ${where.join(' AND ')}` : ''

    const countSql = `SELECT COUNT(*) as total FROM paintings ${whereClause}`
    const { total } = db.prepare(countSql).get(...params)

    const dataSql = `SELECT * FROM paintings ${whereClause} ORDER BY createdAt DESC LIMIT ? OFFSET ?`
    const paintings = db.prepare(dataSql).all(...params, size, offset)

    // 获取用户收藏状态
    let favorites = []
    if (sessionId) {
      const favRows = db.prepare('SELECT paintingId FROM gallery_favorites WHERE sessionId = ?').all(sessionId)
      favorites = favRows.map(r => r.paintingId)
    }

    const paintingsWithFav = paintings.map(p => ({
      ...p,
      isFavorite: favorites.includes(p.id)
    }))

    // 获取所有朝代和分类（用于筛选）
    const dynasties = db.prepare("SELECT DISTINCT dynasty FROM paintings WHERE dynasty != '' ORDER BY dynasty").all().map(r => r.dynasty)
    const categories = db.prepare("SELECT DISTINCT category FROM paintings WHERE category != '' ORDER BY category").all().map(r => r.category)

    res.json({
      success: true,
      paintings: paintingsWithFav,
      filters: { dynasties, categories },
      pagination: {
        page: pageNum,
        pageSize: size,
        total,
        totalPages: Math.ceil(total / size)
      }
    })
  } catch (error) {
    console.error('获取画廊失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 18. 获取画作详情
app.get('/api/gallery/:id', (req, res) => {
  try {
    const { sessionId } = req.query
    const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(req.params.id)
    if (!painting) {
      return res.status(404).json({ success: false, error: '画作不存在' })
    }

    let isFavorite = false
    if (sessionId) {
      const fav = db.prepare('SELECT * FROM gallery_favorites WHERE paintingId = ? AND sessionId = ?').get(req.params.id, sessionId)
      isFavorite = !!fav
    }

    res.json({ success: true, painting: { ...painting, isFavorite } })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 19. 收藏/取消收藏画作
app.post('/api/gallery/:id/favorite', (req, res) => {
  try {
    const { sessionId } = req.body
    if (!sessionId) {
      return res.status(400).json({ success: false, error: '缺少会话ID' })
    }

    const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(req.params.id)
    if (!painting) {
      return res.status(404).json({ success: false, error: '画作不存在' })
    }

    const existing = db.prepare('SELECT * FROM gallery_favorites WHERE paintingId = ? AND sessionId = ?').get(req.params.id, sessionId)

    if (existing) {
      // 取消收藏
      db.prepare('DELETE FROM gallery_favorites WHERE paintingId = ? AND sessionId = ?').run(req.params.id, sessionId)
      res.json({ success: true, isFavorite: false, message: '已取消收藏' })
    } else {
      // 添加收藏
      db.prepare('INSERT INTO gallery_favorites (id, paintingId, sessionId, createdAt) VALUES (?, ?, ?, ?)').run(
        uuidv4(),
        req.params.id,
        sessionId,
        new Date().toISOString()
      )
      res.json({ success: true, isFavorite: true, message: '已收藏' })
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 20. 获取收藏的画作
app.get('/api/gallery/favorites/:sessionId', (req, res) => {
  try {
    const { page = 1, pageSize = 12 } = req.query
    const pageNum = Math.max(1, parseInt(page))
    const size = Math.min(50, Math.max(1, parseInt(pageSize) || 12))
    const offset = (pageNum - 1) * size

    const countSql = `SELECT COUNT(*) as total FROM gallery_favorites WHERE sessionId = ?`
    const { total } = db.prepare(countSql).get(req.params.sessionId)

    const dataSql = `
      SELECT p.*, gf.createdAt as favoritedAt
      FROM paintings p
      JOIN gallery_favorites gf ON p.id = gf.paintingId
      WHERE gf.sessionId = ?
      ORDER BY gf.createdAt DESC
      LIMIT ? OFFSET ?
    `
    const paintings = db.prepare(dataSql).all(req.params.sessionId, size, offset)

    res.json({
      success: true,
      paintings,
      pagination: {
        page: pageNum,
        pageSize: size,
        total,
        totalPages: Math.ceil(total / size)
      }
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 21. 上传名画图片
app.post('/api/gallery/:id/upload', upload.single('image'), (req, res) => {
  try {
    const { id } = req.params
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请选择图片文件' })
    }

    const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(id)
    if (!painting) {
      return res.status(404).json({ success: false, error: '画作不存在' })
    }

    const imageUrl = `/uploads/${req.file.filename}`

    db.prepare('UPDATE paintings SET imageUrl = ? WHERE id = ?').run(imageUrl, id)

    res.json({
      success: true,
      imageUrl,
      message: '图片上传成功'
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 22. 添加新画作
app.post('/api/gallery', upload.single('image'), (req, res) => {
  try {
    const { name, artist, dynasty, school, category, description } = req.body

    if (!name) {
      return res.status(400).json({ success: false, error: '画作名称不能为空' })
    }

    const id = 'p' + Date.now().toString(36) + Math.random().toString(36).substr(2, 5)
    let imageUrl = ''

    if (req.file) {
      imageUrl = `/uploads/${req.file.filename}`
    }

    db.prepare(`
      INSERT INTO paintings (id, name, artist, dynasty, school, category, imageUrl, description, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(id, name, artist || '', dynasty || '', school || '', category || '', imageUrl, description || '', new Date().toISOString())

    const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(id)

    res.json({ success: true, painting, message: '画作添加成功' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 23. 删除画作
app.delete('/api/gallery/:id', (req, res) => {
  try {
    const { id } = req.params
    const painting = db.prepare('SELECT * FROM paintings WHERE id = ?').get(id)
    if (!painting) {
      return res.status(404).json({ success: false, error: '画作不存在' })
    }

    db.prepare('DELETE FROM paintings WHERE id = ?').run(id)
    db.prepare('DELETE FROM gallery_favorites WHERE paintingId = ?').run(id)

    res.json({ success: true, message: '画作已删除' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 模型和模板管理 API ====================

// 24. 获取可用模型列表
app.get('/api/models', (req, res) => {
  res.json({
    success: true,
    textModels: TEXT_MODELS,
    visionModels: VISION_MODELS,
    currentTextModel,
    currentVisionModel
  })
})

// 22. 切换模型
app.post('/api/models/switch', (req, res) => {
  try {
    const { textModel, visionModel } = req.body

    if (textModel && TEXT_MODELS[textModel]) {
      currentTextModel = textModel
      // 保存到数据库
      db.prepare('INSERT OR REPLACE INTO user_settings (key, value, updatedAt) VALUES (?, ?, ?)')
        .run('textModel', textModel, new Date().toISOString())
    }

    if (visionModel && VISION_MODELS[visionModel]) {
      currentVisionModel = visionModel
      db.prepare('INSERT OR REPLACE INTO user_settings (key, value, updatedAt) VALUES (?, ?, ?)')
        .run('visionModel', visionModel, new Date().toISOString())
    }

    res.json({
      success: true,
      currentTextModel,
      currentVisionModel,
      message: '模型已切换'
    })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 23. 获取提示词模板列表
app.get('/api/templates', (req, res) => {
  try {
    const templates = loadTemplates()
    res.json({ success: true, templates })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 24. 保存自定义模板
app.post('/api/templates', (req, res) => {
  try {
    const { id, name, template } = req.body

    if (!id || !name || !template) {
      return res.status(400).json({ success: false, error: '缺少必要参数' })
    }

    saveTemplate(id, name, template)
    res.json({ success: true, message: '模板保存成功' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 25. 删除自定义模板
app.delete('/api/templates/:id', (req, res) => {
  try {
    // 不允许删除默认模板
    if (DEFAULT_TEMPLATES[req.params.id]) {
      return res.status(400).json({ success: false, error: '不能删除默认模板' })
    }

    db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(req.params.id)
    res.json({ success: true, message: '模板已删除' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 26. 重置模板到默认
app.post('/api/templates/:id/reset', (req, res) => {
  try {
    const defaultTemplate = DEFAULT_TEMPLATES[req.params.id]
    if (!defaultTemplate) {
      return res.status(404).json({ success: false, error: '模板不存在' })
    }

    // 删除自定义版本
    db.prepare('DELETE FROM prompt_templates WHERE id = ?').run(req.params.id)
    res.json({ success: true, template: defaultTemplate, message: '模板已重置' })
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// ==================== 模型测试 API ====================

// 27. 测试文本模型是否可用
app.post('/api/models/test', async (req, res) => {
  try {
    const { model, type } = req.body
    if (!model) {
      return res.status(400).json({ success: false, error: '请指定模型' })
    }

    const isTextModel = type === 'text' || TEXT_MODELS[model]
    const isVisionModel = type === 'vision' || VISION_MODELS[model]

    if (!isTextModel && !isVisionModel) {
      return res.status(400).json({ success: false, error: '未知模型' })
    }

    const startTime = Date.now()

    if (isTextModel && type !== 'vision') {
      // 测试文本模型
      try {
        const result = await callSparkAI(
          [{ role: 'user', content: '你好，请回复"模型测试成功"' }],
          model
        )
        const response = result.choices?.[0]?.message?.content || ''
        const latency = Date.now() - startTime

        res.json({
          success: true,
          model,
          type: 'text',
          latency,
          response: response.substring(0, 100),
          available: true
        })
      } catch (err) {
        res.json({
          success: false,
          model,
          type: 'text',
          latency: Date.now() - startTime,
          error: err.response?.data?.error?.message || err.message,
          available: false
        })
      }
    } else {
      // 测试视觉模型（用一个小测试图片）
      try {
        // 使用 100x100 像素测试图片（符合 API 最小尺寸要求）
        const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAnklEQVR42u3QMQEAAAwCIPtnNIwV9u2BCKScRYEsWbJkyZKlQJYsWbJkyVIgS5YsWbJkKZAlS5YsWbIUyJIlS5YsWQpkyZIlS5YsBbJkyZIlS5YCWbJkyZIlS4EsWbJkyZKlQJYsWbJkyVIgS5YsWbJkKZAlS5YsWbIUyJIlS5YsWQpkyZIlS5YsBbJkyZIlS5YCWbJkyZIlS4EsWd8G9lK7Het9974AAAAASUVORK5CYII='
        const testDataUrl = `data:image/png;base64,${testImageBase64}`

        const result = await callQwenOmniImageToText(testDataUrl, '请回复"视觉模型测试成功"', model)
        const latency = Date.now() - startTime

        res.json({
          success: true,
          model,
          type: 'vision',
          latency,
          response: result.substring(0, 100),
          available: true
        })
      } catch (err) {
        res.json({
          success: false,
          model,
          type: 'vision',
          latency: Date.now() - startTime,
          error: err.response?.data?.error?.message || err.message,
          available: false
        })
      }
    }
  } catch (error) {
    res.status(500).json({ success: false, error: error.message })
  }
})

// 28. 批量测试所有模型
app.get('/api/models/test-all', async (req, res) => {
  const results = {
    textModels: {},
    visionModels: {},
    testedAt: new Date().toISOString()
  }

  // 测试文本模型
  for (const [id, info] of Object.entries(TEXT_MODELS)) {
    try {
      const start = Date.now()
      await callSparkAI([{ role: 'user', content: '测试' }], id)
      results.textModels[id] = {
        ...info,
        available: true,
        latency: Date.now() - start,
        error: null
      }
    } catch (err) {
      results.textModels[id] = {
        ...info,
        available: false,
        latency: null,
        error: err.response?.data?.error?.message || err.message
      }
    }
  }

  // 测试视觉模型
  const testImageBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAGQAAABkCAIAAAD/gAIDAAAAnklEQVR42u3QMQEAAAwCIPtnNIwV9u2BCKScRYEsWbJkyZKlQJYsWbJkyVIgS5YsWbJkKZAlS5YsWbIUyJIlS5YsWQpkyZIlS5YsBbJkyZIlS5YCWbJkyZIlS4EsWbJkyZKlQJYsWbJkyVIgS5YsWbJkKZAlS5YsWbIUyJIlS5YsWQpkyZIlS5YsBbJkyZIlS5YCWbJkyZIlS4EsWd8G9lK7Het9974AAAAASUVORK5CYII='
  const testDataUrl = `data:image/png;base64,${testImageBase64}`

  for (const [id, info] of Object.entries(VISION_MODELS)) {
    try {
      const start = Date.now()
      await callQwenOmniImageToText(testDataUrl, '测试', id)
      results.visionModels[id] = {
        ...info,
        available: true,
        latency: Date.now() - start,
        error: null
      }
    } catch (err) {
      results.visionModels[id] = {
        ...info,
        available: false,
        latency: null,
        error: err.response?.data?.error?.message || err.message
      }
    }
  }

  res.json({ success: true, results })
})

// ==================== 统计 API ====================

// 29. 获取创作统计数据
app.get('/api/stats', (req, res) => {
  try {
    // 总创作数量
    const { total } = db.prepare('SELECT COUNT(*) as total FROM history').get()

    // 本月创作数量
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const { monthCount } = db.prepare('SELECT COUNT(*) as monthCount FROM history WHERE createdAt >= ?').get(monthStart)

    // 今日创作数量
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString()
    const { todayCount } = db.prepare('SELECT COUNT(*) as todayCount FROM history WHERE createdAt >= ?').get(todayStart)

    // 收藏数量
    const { favoriteCount } = db.prepare('SELECT COUNT(*) as favoriteCount FROM history WHERE favorite = 1').get()

    // 风格统计
    const styleStats = db.prepare(`
      SELECT style, COUNT(*) as count
      FROM history
      WHERE style IS NOT NULL AND style != ''
      GROUP BY style
      ORDER BY count DESC
      LIMIT 10
    `).all()

    // 流派/画科统计
    const genreStats = db.prepare(`
      SELECT genre, COUNT(*) as count
      FROM history
      WHERE genre IS NOT NULL AND genre != ''
      GROUP BY genre
      ORDER BY count DESC
      LIMIT 10
    `).all()

    // 创作时间分布（按小时）
    const hourlyDistribution = db.prepare(`
      SELECT CAST(strftime('%H', createdAt) AS INTEGER) as hour, COUNT(*) as count
      FROM history
      GROUP BY hour
      ORDER BY hour
    `).all()

    // 创作时间分布（按星期）
    const weekdayDistribution = db.prepare(`
      SELECT CAST(strftime('%w', createdAt) AS INTEGER) as weekday, COUNT(*) as count
      FROM history
      GROUP BY weekday
      ORDER BY weekday
    `).all()

    // 最近7天创作趋势
    const weeklyTrend = db.prepare(`
      SELECT date(createdAt) as date, COUNT(*) as count
      FROM history
      WHERE createdAt >= date('now', '-7 days')
      GROUP BY date
      ORDER BY date
    `).all()

    // 常用词汇（从诗词中提取，简单统计）
    const recentPoems = db.prepare('SELECT poem FROM history ORDER BY createdAt DESC LIMIT 100').all()
    const wordFreq = {}
    recentPoems.forEach(row => {
      if (row.poem) {
        // 提取常见诗词词汇（2字词）
        const words = row.poem.match(/[\u4e00-\u9fa5]{2}/g) || []
        words.forEach(word => {
          wordFreq[word] = (wordFreq[word] || 0) + 1
        })
      }
    })
    const topWords = Object.entries(wordFreq)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([word, count]) => ({ word, count }))

    res.json({
      success: true,
      stats: {
        total,
        monthCount,
        todayCount,
        favoriteCount,
        styleStats,
        genreStats,
        hourlyDistribution,
        weekdayDistribution,
        weeklyTrend,
        topWords
      }
    })
  } catch (error) {
    console.error('获取统计失败:', error)
    res.status(500).json({ success: false, error: error.message })
  }
})

// 初始化时加载用户设置
function loadUserSettings() {
  try {
    const textModelSetting = db.prepare('SELECT value FROM user_settings WHERE key = ?').get('textModel')
    const visionModelSetting = db.prepare('SELECT value FROM user_settings WHERE key = ?').get('visionModel')

    if (textModelSetting && TEXT_MODELS[textModelSetting.value]) {
      currentTextModel = textModelSetting.value
    }
    if (visionModelSetting && VISION_MODELS[visionModelSetting.value]) {
      currentVisionModel = visionModelSetting.value
    }

    console.log('已加载用户设置 - 文本模型:', currentTextModel, '视觉模型:', currentVisionModel)
  } catch (e) {
    console.log('加载用户设置失败，使用默认模型')
  }
}
loadUserSettings()

// 仅直接运行时启动服务
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`墨韵 AI 后端服务已启动: http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.db = db;
