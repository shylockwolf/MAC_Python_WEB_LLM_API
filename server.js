import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync } from 'fs';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const envContent = readFileSync('.env.local', 'utf8');
const envVars = {};
envContent.split('\n').forEach(line => {
  const [key, ...values] = line.split('=');
  if (key && values.length > 0) {
    envVars[key.trim()] = values.join('=').trim();
  }
});

const app = express();

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// 创建SOCKS5代理agent
const socksProxyUrl = process.env.ALL_PROXY || 'socks5://127.0.0.1:12345';
const socksAgent = new SocksProxyAgent(socksProxyUrl);

app.post('/api/deepseek/v1/chat/completions', async (req, res) => {
  console.log('Received DeepSeek request');
  try {
    const response = await fetch('https://api.deepseek.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${envVars.DEEPSEEK_API_KEY}`
      },
      body: JSON.stringify(req.body)
    });

    const data = await response.json();
    console.log('DeepSeek response status:', response.status);
    res.json(data);
  } catch (error) {
    console.error('DeepSeek API error:', error);
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/kimi/v1/chat/completions', async (req, res) => {
  console.log('Received Kimi request');
  
  // 计算请求大小
  const requestBody = JSON.stringify(req.body);
  const requestSizeMB = (requestBody.length / 1024 / 1024).toFixed(2);
  console.log(`Request size: ${requestSizeMB} MB`);
  
  // 检查请求大小，如果超过10MB可能有问题
  if (requestBody.length > 10 * 1024 * 1024) {
    console.warn('Warning: Request size exceeds 10MB, may cause issues');
  }
  
  console.log('Using SOCKS5 proxy:', socksProxyUrl);
  
  try {
    const response = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${envVars.KIMI_API_KEY}`
      },
      body: requestBody,
      agent: socksAgent,
      timeout: 120000 // 120秒超时
    });

    console.log('Kimi response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Kimi API error response:', errorText);
      return res.status(response.status).json({ error: errorText });
    }
    
    const data = await response.json();
    console.log('Kimi response data:', JSON.stringify(data, null, 2));
    res.json(data);
  } catch (error) {
    console.error('Kimi API error:', error);
    res.status(500).json({ 
      error: error.message,
      type: error.type,
      code: error.code 
    });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Proxy server running on http://localhost:${PORT}`);
  console.log(`SOCKS5 Proxy: ${socksProxyUrl}`);
  console.log(`DEEPSEEK_API_KEY: ${envVars.DEEPSEEK_API_KEY ? 'loaded' : 'not loaded'}`);
  console.log(`KIMI_API_KEY: ${envVars.KIMI_API_KEY ? 'loaded' : 'not loaded'}`);
});
