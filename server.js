import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { SocksProxyAgent } from 'socks-proxy-agent';
import fetch from 'node-fetch';
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';

const execAsync = promisify(exec);

dotenv.config();

const envContent = readFileSync('.env', 'utf8');
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

app.post('/api/paddleocr/v1/ocr', async (req, res) => {
  console.log('Received PaddleOCR request');
  console.log('Request body keys:', Object.keys(req.body));
  
  try {
    const { file, fileType = 1, useDocOrientationClassify = false, useDocUnwarping = false, useChartRecognition = false } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'File data is required' });
    }
    
    // 从Authorization header获取API key
    const authHeader = req.headers.authorization;
    console.log('Auth header:', authHeader);
    
    let apiKey;
    if (authHeader) {
      if (authHeader.startsWith('Bearer ')) {
        apiKey = authHeader.substring(7);
      } else if (authHeader.startsWith('token ')) {
        apiKey = authHeader.substring(6);
      } else {
        apiKey = authHeader;
      }
    } else {
      apiKey = envVars.PADDLEOCR_API_KEY;
    }
    
    console.log('Extracted API key:', apiKey ? apiKey.substring(0, 10) + '...' : 'empty');
    
    if (!apiKey) {
      return res.status(401).json({ error: 'API key is required' });
    }
    
    console.log('Using PaddleOCR API key:', apiKey.substring(0, 10) + '...');
    console.log('File data length:', file.length);
    
    // 使用百度AI Studio的PaddleOCR API端点
    const paddleOCRUrl = 'https://u904m5r6w7lbfeb3.aistudio-app.com/layout-parsing';
    
    const response = await fetch(paddleOCRUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `token ${apiKey}`
      },
      body: JSON.stringify({
        file: file,
        fileType: fileType,
        useDocOrientationClassify: useDocOrientationClassify,
        useDocUnwarping: useDocUnwarping,
        useChartRecognition: useChartRecognition
      }),
      timeout: 60000
    });
    
    console.log('PaddleOCR response status:', response.status);
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('PaddleOCR API error response:', errorText);
      return res.status(response.status).json({ error: errorText });
    }
    
    const data = await response.json();
    console.log('PaddleOCR response data:', JSON.stringify(data, null, 2));
    res.json(data);
    
  } catch (error) {
    console.error('PaddleOCR API error:', error);
    res.status(500).json({ 
      error: error.message,
      type: error.type,
      code: error.code 
    });
  }
});

app.post('/api/nvidia/v1/asr', async (req, res) => {
  console.log('Received NVIDIA ASR request');
  console.log('Request body keys:', Object.keys(req.body));
  
  let tempAudioPath = null;
  let convertedAudioPath = null;
  
  try {
    const { file, language = 'multi' } = req.body;
    
    if (!file) {
      return res.status(400).json({ error: 'Audio file data is required' });
    }
    
    // 获取NVIDIA API配置
    const nvidiaApiKey = envVars.NVIDIA_API_KEY;
    const nvidiaServer = envVars.NVIDIA_SERVER || 'grpc.nvcf.nvidia.com:443';
    const nvidiaFunctionId = envVars.NVIDIA_FUNCTION_ID || 'b702f636-f60c-4a3d-a6f4-f3568c13bd7d';
    
    console.log('NVIDIA API Key:', nvidiaApiKey ? 'loaded' : 'not loaded');
    console.log('NVIDIA Server:', nvidiaServer);
    console.log('NVIDIA Function ID:', nvidiaFunctionId);
    
    if (!nvidiaApiKey) {
      return res.status(401).json({ error: 'NVIDIA API key is required' });
    }
    
    // 将base64音频数据保存为临时文件
    const buffer = Buffer.from(file, 'base64');
    // Save without extension first, or use a generic one. ffmpeg can usually detect format.
    // However, some formats require extension. Let's try to detect or just always convert.
    // For robustness, we'll save as .dat and let ffmpeg probe it.
    tempAudioPath = path.join(process.cwd(), `temp_audio_${Date.now()}.dat`);
    writeFileSync(tempAudioPath, buffer);
    console.log('Saved audio to temp file:', tempAudioPath);
    console.log('Audio file size:', buffer.length / 1024 / 1024, 'MB');
    
    // Always convert to ensure correct format (16kHz, mono, WAV) for Riva
    try {
      convertedAudioPath = path.join(process.cwd(), `temp_audio_converted_${Date.now()}.wav`);
      
      console.log('Converting audio with ffmpeg...');
      // ffmpeg is smart enough to detect input format from file content
      await execAsync(`ffmpeg -i "${tempAudioPath}" -ar 16000 -ac 1 -y "${convertedAudioPath}"`, {
        timeout: 300000 // 5分钟超时
      });
      
      console.log('Audio conversion successful');
      // Update tempAudioPath to point to the converted file for reading
      // We keep the original tempAudioPath for cleanup if needed (though we should clean both)
      // For now, let's just update the variable to read from
      const originalTempPath = tempAudioPath;
      tempAudioPath = convertedAudioPath;
      
      // Clean up the original uploaded file immediately
      try {
        if (existsSync(originalTempPath)) unlinkSync(originalTempPath);
      } catch (e) {
        console.error('Error deleting temp file:', e);
      }
      
    } catch (ffmpegError) {
      console.error('ffmpeg conversion failed:', ffmpegError);
      // Clean up temp file
      try {
        if (existsSync(tempAudioPath)) unlinkSync(tempAudioPath);
      } catch (e) {}
      
      return res.status(400).json({ 
        error: 'Audio conversion failed. Please ensure ffmpeg is installed and the audio format is supported.',
        details: ffmpegError.message
      });
    }
    
    // 调用NVIDIA ASR API
    console.log('Calling NVIDIA ASR API via gRPC...');
    
    // 读取音频文件
    const audioBuffer = readFileSync(tempAudioPath);
    
    // 使用gRPC连接到NVIDIA Riva服务
    const packageDefinition = protoLoader.loadSync('./proto/riva_asr.proto', {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    });
    
    const rivaProto = grpc.loadPackageDefinition(packageDefinition);
    
    // 创建gRPC客户端
    const client = new rivaProto.nvidia.riva.asr.RivaSpeechRecognition(
      nvidiaServer,
      grpc.credentials.createSsl(),
      {
        'grpc.ssl_target_name_override': 'grpc.nvcf.nvidia.com',
        'grpc.default_authority': 'grpc.nvcf.nvidia.com'
      }
    );
    
    // 构建识别配置
    const config = {
      language_code: language,
      max_alternatives: 1,
      enable_automatic_punctuation: true,
      enable_word_time_offsets: true,
      profanity_filter: false,
      encoding: 1, // LINEAR_PCM
      sample_rate_hertz: 16000
    };
    
    // 构建请求
    const request = {
      config: config,
      audio: audioBuffer
    };
    
    // 使用metadata传递认证信息
    const metadata = new grpc.Metadata();
    metadata.add('function-id', nvidiaFunctionId);
    metadata.add('authorization', `Bearer ${nvidiaApiKey}`);
    
    // 调用离线识别
    client.recognize(request, metadata, (error, response) => {
      if (error) {
        console.error('gRPC error:', error);
        return res.status(500).json({ 
          error: 'NVIDIA ASR API request failed',
          details: error.message
        });
      }
      
      console.log('NVIDIA ASR response received');
      
      // 处理转录结果
      let transcriptText = '';
      const sentences = [];
      
      if (response.results && response.results.length > 0) {
        for (const result of response.results) {
          if (result.alternatives && result.alternatives.length > 0) {
            const transcript = result.alternatives[0].transcript;
            if (transcript) {
              transcriptText += transcript;
              
              // 按句子分割
              const sentenceMatches = transcript.match(/[^.!?。！？，；；、]+[.!?。！？，；；、]*/g);
              if (sentenceMatches) {
                for (const sentence of sentenceMatches) {
                  const trimmed = sentence.trim();
                  if (trimmed) {
                    sentences.push(trimmed);
                  }
                }
              }
            }
          }
        }
      }
      
      // 如果没有句子分割，使用整个文本
      if (sentences.length === 0 && transcriptText) {
        sentences.push(transcriptText);
      }
      
      // 确保每个句子都有标点符号
      const finalSentences = sentences.map(sentence => {
        if (!/[.!?。！？，；；、]$/.test(sentence)) {
          return sentence + '。';
        }
        return sentence;
      });
      
      const finalText = finalSentences.join('\n');
      
      console.log('Final transcript:', finalText);
      
      res.json({
        text: finalText,
        sentences: finalSentences,
        debug: {
          language: language,
          audioSize: buffer.length,
          conversion: convertedAudioPath ? 'converted to WAV' : 'no conversion needed'
        }
      });
    });
    
  } catch (error) {
    console.error('NVIDIA ASR API error:', error);
    res.status(500).json({ 
      error: error.message,
      type: error.type,
      code: error.code 
    });
  } finally {
    // 清理临时文件
    if (tempAudioPath && existsSync(tempAudioPath)) {
      try {
        unlinkSync(tempAudioPath);
        console.log('Cleaned up temp file:', tempAudioPath);
      } catch (cleanupError) {
        console.error('Failed to clean up temp file:', cleanupError);
      }
    }
    
    if (convertedAudioPath && existsSync(convertedAudioPath)) {
      try {
        unlinkSync(convertedAudioPath);
        console.log('Cleaned up converted file:', convertedAudioPath);
      } catch (cleanupError) {
        console.error('Failed to clean up converted file:', cleanupError);
      }
    }
  }
});

app.post('/api/nvidia/v1/tts', async (req, res) => {
  console.log('Received NVIDIA TTS request');
  console.log('Request body keys:', Object.keys(req.body));
  
  try {
    const { text, voice = 'Magpie-Multilingual.EN-US.Aria', language = 'en-US' } = req.body;
    
    if (!text) {
      return res.status(400).json({ error: 'Text is required' });
    }
    
    // 获取NVIDIA API配置
    const nvidiaApiKey = envVars.NVIDIA_API_KEY;
    const nvidiaServer = envVars.NVIDIA_SERVER || 'grpc.nvcf.nvidia.com:443';
    // Use TTS specific function ID if available, otherwise default to the one from App.tsx or env
    const nvidiaFunctionId = envVars.NVIDIA_TTS_FUNCTION_ID || '877104f7-e885-42b9-8de8-f6e4c6303969';
    
    console.log('NVIDIA API Key:', nvidiaApiKey ? 'loaded' : 'not loaded');
    console.log('NVIDIA Server:', nvidiaServer);
    console.log('NVIDIA Function ID:', nvidiaFunctionId);
    
    if (!nvidiaApiKey) {
      return res.status(401).json({ error: 'NVIDIA API key is required' });
    }
    
    // 调用NVIDIA TTS API
    console.log('Calling NVIDIA TTS API via gRPC...');
    
    // 使用gRPC连接到NVIDIA Riva服务
    const packageDefinition = protoLoader.loadSync('./proto/riva_tts.proto', {
      keepCase: true,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true,
      includeDirs: ['./proto'] // Ensure it can find riva_audio.proto
    });
    
    const rivaProto = grpc.loadPackageDefinition(packageDefinition);
    
    // 创建gRPC客户端
    const client = new rivaProto.nvidia.riva.tts.RivaSpeechSynthesis(
      nvidiaServer,
      grpc.credentials.createSsl(),
      {
        'grpc.ssl_target_name_override': 'grpc.nvcf.nvidia.com',
        'grpc.default_authority': 'grpc.nvcf.nvidia.com'
      }
    );
    
    // Helper function to detect if text contains Chinese characters
    const isChinese = (text) => {
      let chineseChars = 0;
      for (let i = 0; i < text.length; i++) {
        const charCode = text.charCodeAt(i);
        if (charCode >= 0x4e00 && charCode <= 0x9fff) {
          chineseChars++;
        }
      }
      return chineseChars > text.length * 0.2;
    };
    
    // Auto-detect language if not specified or default 'en-US'
    let languageCode = language;
    if (languageCode === 'en-US' || !languageCode) {
        if (isChinese(text)) {
            languageCode = 'zh-CN';
            console.log('Detected Chinese language from text');
        } else {
            languageCode = 'en-US';
        }
    }
    
    // 构建请求
    const request = {
      text: text,
      language_code: languageCode,
      encoding: 1, // LINEAR_PCM
      sample_rate_hz: 22050, // Match tts_app.py sample rate
      voice_name: voice
    };
    
    console.log('TTS Request:', JSON.stringify(request));
    
    // 使用metadata传递认证信息
    const metadata = new grpc.Metadata();
    metadata.add('function-id', nvidiaFunctionId);
    metadata.add('authorization', `Bearer ${nvidiaApiKey}`);
    
    // Helper to add WAV header
    const addWavHeader = (samples, sampleRate, numChannels, bitsPerSample) => {
      const buffer = Buffer.alloc(44 + samples.length);
      
      // RIFF chunk descriptor
      buffer.write('RIFF', 0);
      buffer.writeUInt32LE(36 + samples.length, 4);
      buffer.write('WAVE', 8);
      
      // fmt sub-chunk
      buffer.write('fmt ', 12);
      buffer.writeUInt32LE(16, 16); // Subchunk1Size
      buffer.writeUInt16LE(1, 20); // AudioFormat (1 = PCM)
      buffer.writeUInt16LE(numChannels, 22);
      buffer.writeUInt32LE(sampleRate, 24);
      buffer.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28); // ByteRate
      buffer.writeUInt16LE(numChannels * (bitsPerSample / 8), 32); // BlockAlign
      buffer.writeUInt16LE(bitsPerSample, 34);
      
      // data sub-chunk
      buffer.write('data', 36);
      buffer.writeUInt32LE(samples.length, 40);
      
      samples.copy(buffer, 44);
      return buffer;
    };

    // 调用合成
    client.Synthesize(request, metadata, (error, response) => {
      if (error) {
        console.error('gRPC error:', error);
        return res.status(500).json({ 
          error: 'NVIDIA TTS API request failed',
          details: error.message
        });
      }
      
      console.log('NVIDIA TTS response received');
      
      if (response && response.audio) {
        // Add WAV header to raw PCM data
        // Riva typically returns 16-bit PCM (2 bytes per sample)
        const wavBuffer = addWavHeader(response.audio, 22050, 1, 16);
        
        // Convert buffer to base64
        const audioBase64 = wavBuffer.toString('base64');
        
        res.json({
          audio: audioBase64,
          debug: {
            voice: voice,
            sampleRate: 22050,
            encoding: 'LINEAR_PCM',
            addedWavHeader: true
          }
        });
      } else {
        res.status(500).json({ error: 'No audio data received' });
      }
    });
    
  } catch (error) {
    console.error('NVIDIA TTS API error:', error);
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
  console.log(`NVIDIA_API_KEY: ${envVars.NVIDIA_API_KEY ? 'loaded' : 'not loaded'}`);
});
