const axios = require('axios');
require('dotenv').config();

// DMXAPI 配置（从环境变量读取）
const DMX_CONFIG = {
  apiKey: process.env.DMX_API_KEY || '',
  baseUrl: process.env.DMX_BASE_URL || 'https://www.dmxapi.cn/v1',
  model: process.env.DMX_MODEL || 'gpt-5-mini'
};

if (!DMX_CONFIG.apiKey) {
  console.error('❌ 错误: 请设置环境变量 DMX_API_KEY');
  console.error('   可以创建 .env 文件或直接设置环境变量');
  process.exit(1);
}

const OMNI_CONFIG = {
  apiKey: DMX_CONFIG.apiKey,
  responsesUrl: `${DMX_CONFIG.baseUrl}/responses`,
  model: 'qwen3-omni-flash-all'
};

// 测试文本模型 (gpt-5-mini)
async function testTextModel() {
  console.log('\n=== 测试文本模型: gpt-5-mini ===');
  try {
    const url = `${DMX_CONFIG.baseUrl}/chat/completions`;
    const headers = {
      'Accept': 'application/json',
      'Authorization': DMX_CONFIG.apiKey,
      'Content-Type': 'application/json'
    };

    const payload = {
      model: DMX_CONFIG.model,
      messages: [{ role: 'user', content: '你好，请回复"测试成功"' }]
    };

    console.log('请求 URL:', url);
    console.log('请求模型:', DMX_CONFIG.model);
    
    const response = await axios.post(url, payload, { headers, timeout: 30000 });
    
    console.log('✅ 文本模型测试成功!');
    console.log('响应状态:', response.status);
    console.log('响应内容:', response.data?.choices?.[0]?.message?.content);
    return true;
  } catch (error) {
    console.log('❌ 文本模型测试失败!');
    console.log('错误状态:', error.response?.status);
    console.log('错误信息:', error.response?.data || error.message);
    return false;
  }
}

// 测试多模态模型 (qwen3-omni-flash-all) - 修复后的格式
async function testOmniModel() {
  console.log('\n=== 测试多模态模型: qwen3-omni-flash-all ===');
  try {
    const url = OMNI_CONFIG.responsesUrl;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': OMNI_CONFIG.apiKey
    };

    // 使用一个简单的 base64 图片（1x1 像素的透明 PNG）
    const tinyPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

    const payload = {
      model: OMNI_CONFIG.model,
      input: [
        {
          role: 'user',
          content: [
            { 
              type: 'input_image', 
              input_image: {
                data: tinyPng,
                format: 'png'
              }
            },
            { type: 'input_text', text: '这是一张测试图片，请回复"图片测试成功"' }
          ]
        }
      ],
      stream: true,
      stream_options: { include_usage: true },
      modalities: ['text']
    };

    console.log('请求 URL:', url);
    console.log('请求模型:', OMNI_CONFIG.model);

    const response = await axios.post(url, payload, {
      headers,
      responseType: 'stream',
      timeout: 30000
    });

    if (response.status !== 200) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
              if (data.delta) {
                fullText += data.delta;
              }
            } catch (_) {}
          }
        }
      });

      response.data.on('end', () => {
        console.log('✅ 多模态模型测试成功!');
        console.log('响应内容:', fullText.trim() || '(无内容)');
        resolve(true);
      });

      response.data.on('error', (err) => {
        console.log('❌ 流读取错误:', err.message);
        resolve(false);
      });
    });
  } catch (error) {
    console.log('❌ 多模态模型测试失败!');
    console.log('错误状态:', error.response?.status);
    console.log('错误信息:', error.response?.data || error.message);
    return false;
  }
}

// 测试模型列表
async function testModelList() {
  console.log('\n=== 获取可用模型列表 ===');
  try {
    const url = `${DMX_CONFIG.baseUrl}/models`;
    const headers = {
      'Authorization': DMX_CONFIG.apiKey
    };

    const response = await axios.get(url, { headers, timeout: 30000 });
    
    console.log('✅ 获取模型列表成功!');
    console.log('可用模型数量:', response.data?.data?.length || 0);
    
    // 查找我们需要的模型
    const models = response.data?.data || [];
    const gpt5Mini = models.find(m => m.id === 'gpt-5-mini');
    const qwenOmni = models.find(m => m.id === 'qwen3-omni-flash-all');
    
    console.log('\n模型状态:');
    console.log('  gpt-5-mini:', gpt5Mini ? '✅ 可用' : '❌ 不可用');
    console.log('  qwen3-omni-flash-all:', qwenOmni ? '✅ 可用' : '❌ 不可用');
    
    return { gpt5Mini: !!gpt5Mini, qwenOmni: !!qwenOmni };
  } catch (error) {
    console.log('❌ 获取模型列表失败!');
    console.log('错误状态:', error.response?.status);
    console.log('错误信息:', error.response?.data || error.message);
    return { gpt5Mini: false, qwenOmni: false };
  }
}

// 主测试函数
async function runTests() {
  console.log('开始测试 DMX API...');
  console.log('API Key:', DMX_CONFIG.apiKey.substring(0, 20) + '...');
  console.log('Base URL:', DMX_CONFIG.baseUrl);

  // 测试模型列表
  const modelStatus = await testModelList();
  
  // 测试文本模型
  const textModelOk = await testTextModel();
  
  // 测试多模态模型
  const omniModelOk = await testOmniModel();

  console.log('\n=== 测试结果汇总 ===');
  console.log('gpt-5-mini (文本模型):', textModelOk ? '✅ 正常' : '❌ 异常');
  console.log('qwen3-omni-flash-all (多模态):', omniModelOk ? '✅ 正常' : '❌ 异常');
  console.log('模型列表查询:', modelStatus.gpt5Mini || modelStatus.qwenOmni ? '✅ 正常' : '❌ 异常');
  
  if (!textModelOk || !omniModelOk) {
    console.log('\n⚠️ 建议:');
    if (!modelStatus.gpt5Mini) console.log('  - gpt-5-mini 模型可能不存在，请检查模型名称');
    if (!modelStatus.qwenOmni) console.log('  - qwen3-omni-flash-all 模型可能不存在，请检查模型名称');
    console.log('  - 请访问 https://www.dmxapi.cn 查看可用模型列表');
    console.log('  - 检查 API Key 是否有效');
  }
}

runTests().catch(console.error);
