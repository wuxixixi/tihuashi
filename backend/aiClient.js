const axios = require('axios');

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

async function callSparkAI(messages, model = null, options = {}) {
  const timeoutMs = options.timeoutMs || 15000;
  const retries = options.retries !== undefined ? options.retries : 2;
  const url = `${DMX_CONFIG.baseUrl}/chat/completions`;
  const headers = {
    'Accept': 'application/json',
    'Authorization': DMX_CONFIG.apiKey ? `Bearer ${DMX_CONFIG.apiKey}` : '',
    'Content-Type': 'application/json'
  };
  const useModel = model || DMX_CONFIG.model;
  const payload = { model: useModel, messages };

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await axios.post(url, payload, { headers, timeout: timeoutMs });
      return response.data;
    } catch (error) {
      const isLast = attempt === retries;
      console.error(`AI 调用失败（尝试 ${attempt + 1}/${retries + 1}）:`, error.response?.data || error.message);
      if (isLast) throw error;
      const backoff = Math.pow(2, attempt) * 1000;
      await new Promise(r => setTimeout(r, backoff));
    }
  }
}

async function callQwenOmniImageToText(imageDataUrl, textPrompt, model = null) {
  const url = OMNI_CONFIG.chatUrl;
  const useModel = model || OMNI_CONFIG.model;
  const headers = {
    'Content-Type': 'application/json',
    'Authorization': OMNI_CONFIG.apiKey ? `Bearer ${OMNI_CONFIG.apiKey}` : ''
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

  const response = await axios.post(url, payload, { headers, responseType: 'stream', timeout: 60000 });
  if (response.status !== 200) {
    throw new Error(`Vision AI HTTP ${response.status}: ${response.statusText}`);
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

module.exports = { callSparkAI, callQwenOmniImageToText };