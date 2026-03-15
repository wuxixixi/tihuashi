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

async function callSparkAI(messages) {
  try {
    const url = `${DMX_CONFIG.baseUrl}/chat/completions`;
    const headers = {
      'Accept': 'application/json',
      'Authorization': DMX_CONFIG.apiKey,
      'Content-Type': 'application/json'
    };
    const payload = { model: DMX_CONFIG.model, messages };
    console.log('DMXAPI Request URL:', url);
    const response = await axios.post(url, payload, { headers });
    console.log('DMXAPI Response:', response.data?.choices?.[0]?.message ? 'OK' : response.data);
    return response.data;
  } catch (error) {
    console.error('DMXAPI 调用失败:', error.response?.data || error.message);
    throw error;
  }
}

async function callQwenOmniImageToText(imageDataUrl, textPrompt) {
  const url = OMNI_CONFIG.chatUrl;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': OMNI_CONFIG.apiKey
  };
  const payload = {
    model: OMNI_CONFIG.model,
    messages: [{
      role: 'user',
      content: [
        { type: 'image_url', image_url: { url: imageDataUrl } },
        { type: 'text', text: textPrompt }
      ]
    }],
    stream: true
  };

  console.log('Doubao Vision 请求:', url, 'model:', OMNI_CONFIG.model);
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
    return { title: first, poem: lines.slice(1).join('\n') || raw };
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

    const prompt = `你是一位中国画鉴赏专家。请结合本图，从专业角度对这幅中国画进行赏析评论，需涵盖：
1. 题材与内容：画作描绘了什么主题与物象？
2. 构图与布局：画面构图、疏密、留白有何特点？
3. 技法与风格：用笔、用墨、设色等技法与风格特征？
4. 意境与情感：画作传达的意境与情感？
5. 艺术价值：简要评价其艺术价值。

要求：语言专业、优美流畅，字数严格控制在 200-300 字。

最后请另起一行，以"【流派】"开头，写出该画所属的流派/画科（如：山水画、花鸟画、人物画、工笔画、写意画等），只写流派名称。`;

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

    if (titleMatch) polishedTitle = titleMatch[1].trim()
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

    if (titleMatch) newTitle = titleMatch[1].trim()
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

// 仅直接运行时启动服务
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`墨韵 AI 后端服务已启动: http://localhost:${PORT}`);
  });
}

module.exports = app;
module.exports.db = db;
