const axios = require('axios');
const fs = require('fs');
const path = require('path');

// DMXAPI 配置
const DMX_CONFIG = {
  apiKey: 'sk-A12TQ5zlxcIyWlCwQjHpTc4P0mef1E19Kud2NEkShpRb1nAZ',
  baseUrl: 'https://www.dmxapi.cn/v1',
  model: 'Doubao-1.5-vision-pro-32k'
};

// 测试 Doubao Vision 模型
async function testDoubaoVision() {
  console.log('\n=== 测试 Doubao-1.5-vision-pro-32k 视觉模型 ===');
  
  try {
    // 读取测试图片
    const testImagePath = path.join(__dirname, '__tests__', 'fixtures', 'test.jpg');
    if (!fs.existsSync(testImagePath)) {
      console.log('❌ 测试图片不存在:', testImagePath);
      return false;
    }
    
    const imageBuffer = fs.readFileSync(testImagePath);
    const base64 = imageBuffer.toString('base64');
    const imageDataUrl = `data:image/jpeg;base64,${base64}`;
    
    const url = `${DMX_CONFIG.baseUrl}/chat/completions`;
    const headers = {
      'Content-Type': 'application/json',
      'Authorization': DMX_CONFIG.apiKey
    };

    const payload = {
      model: DMX_CONFIG.model,
      messages: [
        {
          role: 'user',
          content: [
            { 
              type: 'image_url', 
              image_url: {
                url: imageDataUrl
              }
            },
            { type: 'text', text: '请描述这张图片的内容' }
          ]
        }
      ],
      stream: true
    };

    console.log('请求 URL:', url);
    console.log('请求模型:', DMX_CONFIG.model);
    console.log('图片大小:', (imageBuffer.length / 1024).toFixed(2), 'KB');

    const response = await axios.post(url, payload, {
      headers,
      responseType: 'stream',
      timeout: 60000
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
              const delta = data.choices?.[0]?.delta?.content;
              if (delta) {
                fullText += delta;
                process.stdout.write(delta);
              }
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
        console.log('\n\n✅ 测试成功!');
        console.log('完整回复长度:', fullText.length, '字符');
        resolve(true);
      });

      response.data.on('error', (err) => {
        console.log('\n❌ 流读取错误:', err.message);
        resolve(false);
      });
    });
  } catch (error) {
    console.log('❌ 测试失败!');
    console.log('错误状态:', error.response?.status);
    console.log('错误信息:', error.response?.data || error.message);
    return false;
  }
}

// 主测试函数
async function runTests() {
  console.log('开始测试 Doubao Vision API...');
  console.log('API Key:', DMX_CONFIG.apiKey.substring(0, 20) + '...');
  console.log('Base URL:', DMX_CONFIG.baseUrl);
  console.log('Model:', DMX_CONFIG.model);

  const visionOk = await testDoubaoVision();

  console.log('\n=== 测试结果汇总 ===');
  console.log('Doubao-1.5-vision-pro-32k:', visionOk ? '✅ 正常' : '❌ 异常');
  
  if (!visionOk) {
    console.log('\n⚠️ 建议:');
    console.log('  - 请访问 https://www.dmxapi.cn 查看 Doubao 视觉模型文档');
    console.log('  - 检查 API Key 是否有效');
    console.log('  - 确认模型名称是否正确');
  }
}

runTests().catch(console.error);
