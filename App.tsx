
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { ModelType, Message, DebugLog, FileInfo, PaddleOCRConfig, OutputFormat, ASRConfig } from './types';
import Sidebar from './components/Sidebar';
import ChatWindow from './components/ChatWindow';
import DebugConsole from './components/DebugConsole';
import { Terminal, Github } from 'lucide-react';

const App: React.FC = () => {
  const [selectedModel, setSelectedModel] = useState<ModelType>(ModelType.DEEPSEEK);
  const [temperature, setTemperature] = useState(0.7);
  const [outputFormat, setOutputFormat] = useState<OutputFormat>(OutputFormat.TEXT);
  const [paddleOCRConfig, setPaddleOCRConfig] = useState<PaddleOCRConfig>({
    apiKey: '',
    apiUrl: 'http://localhost:3001/api/paddleocr/v1/ocr'
  });
  const [asrConfig, setAsrConfig] = useState<ASRConfig>({
    apiKey: '',
    server: 'grpc.nvcf.nvidia.com:443',
    functionId: 'b702f636-f60c-4a3d-a6f4-f3568c13bd7d'
  });
  const [selectedLanguage, setSelectedLanguage] = useState('multi');
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      role: 'assistant',
      content: '您好！我是您的 综合 AI 助手。我已经准备好为您服务了。',
      timestamp: Date.now(),
    },
  ]);
  const [logs, setLogs] = useState<DebugLog[]>([]);
  const [showDebug, setShowDebug] = useState(true);

  const addLog = useCallback((type: DebugLog['type'], title: string, payload: any) => {
    const newLog: DebugLog = {
      id: Math.random().toString(36).substr(2, 9),
      timestamp: Date.now(),
      type,
      model: selectedModel,
      title,
      payload,
    };
    setLogs(prev => [newLog, ...prev].slice(0, 100));
  }, [selectedModel]);

  const handleSendMessage = useCallback(async (content: string, files: FileInfo[]) => {
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content,
      timestamp: Date.now(),
      files,
    };
    setMessages(prev => [...prev, userMsg]);

    console.log('=== handleSendMessage called ===');
    console.log('selectedModel:', selectedModel);
    console.log('outputFormat:', outputFormat);
    console.log('ModelType.PADDLEOCR:', ModelType.PADDLEOCR);
    console.log('selectedModel === ModelType.PADDLEOCR:', selectedModel === ModelType.PADDLEOCR);

    try {
      let responseText: string;
      let msgFormat: 'text' | 'json' | 'html' = 'text';

      if (selectedModel === ModelType.NVIDIA_ASR) {
        if (!files || files.length === 0) {
          throw new Error('NVIDIA ASR requires at least one audio file');
        }

        const audioFile = files[0];
        if (!audioFile.data || !audioFile.type.startsWith('audio/')) {
          throw new Error('NVIDIA ASR only supports audio files');
        }

        addLog('request', `Send to ${selectedModel}`, {
          file: audioFile.name,
          type: audioFile.type,
          size: audioFile.size,
          language: selectedLanguage
        });

        const response = await fetch('http://localhost:3001/api/nvidia/v1/asr', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            file: audioFile.data,
            language: selectedLanguage
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'NVIDIA ASR API request failed');
        }

        const data = await response.json();
        responseText = data.text || 'No transcription detected';
        
        addLog('response', `Received from ${selectedModel}`, data);
      } else if (selectedModel === ModelType.PADDLEOCR) {
        if (!files || files.length === 0) {
          throw new Error('PaddleOCR requires at least one image file');
        }

        const imageFile = files[0];
        if (!imageFile.data || !imageFile.type.startsWith('image/')) {
          throw new Error('PaddleOCR only supports image files');
        }

        addLog('request', `Send to ${selectedModel}`, {
          file: imageFile.name,
          type: imageFile.type,
          size: imageFile.size
        });

        const headers: Record<string, string> = {
          'Content-Type': 'application/json'
        };
        
        if (paddleOCRConfig.apiKey) {
          headers['Authorization'] = `token ${paddleOCRConfig.apiKey}`;
        }
        
        const response = await fetch(paddleOCRConfig.apiUrl, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            file: imageFile.data,
            fileType: 1,
            useDocOrientationClassify: false,
            useDocUnwarping: false,
            useChartRecognition: false
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'PaddleOCR API request failed');
        }

        const data = await response.json();
        
        console.log('Output format:', outputFormat);
        console.log('OutputFormat.TEXT:', OutputFormat.TEXT);
        console.log('OutputFormat.JSON:', OutputFormat.JSON);
        console.log('OutputFormat.HTML:', OutputFormat.HTML);
        
        if (data.result && data.result.layoutParsingResults && data.result.layoutParsingResults.length > 0) {
          if (outputFormat === OutputFormat.TEXT) {
            responseText = data.result.layoutParsingResults
              .map((item: any) => item.markdown?.text || '')
              .join('\n\n');
            msgFormat = 'text';
          } else if (outputFormat === OutputFormat.JSON) {
            responseText = JSON.stringify(data.result, null, 2);
            msgFormat = 'json';
          } else if (outputFormat === OutputFormat.HTML) {
            const results = data.result.layoutParsingResults;
            let html = '<div class="ocr-result">\n';
            results.forEach((item: any, index: number) => {
              const text = item.markdown?.text || '';
              const bbox = item.bbox || [0, 0, 0, 0];
              html += `  <div class="text-block" data-index="${index}" style="position: absolute; left: ${bbox[0]}px; top: ${bbox[1]}px;">\n`;
              html += `    ${text}\n`;
              html += `  </div>\n`;
            });
            html += '</div>';
            responseText = html;
            msgFormat = 'html';
          } else {
            responseText = data.text || data.result || 'No text detected';
            msgFormat = 'text';
          }
        } else {
          responseText = data.text || data.result || 'No text detected';
        }
        
        addLog('response', `Received from ${selectedModel}`, data);
      } else if (selectedModel === ModelType.DEEPSEEK) {
        const messages = [{ role: 'user', content }];
        
        addLog('request', `Send to ${selectedModel}`, {
          model: selectedModel,
          messages,
          config: { temperature }
        });

        const response = await fetch('http://localhost:3001/api/deepseek/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'deepseek-chat',
            messages,
            temperature,
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'DeepSeek API request failed');
        }

        const data = await response.json();
        responseText = data.choices[0].message.content || "Model returned no response.";
        
        addLog('response', `Received from ${selectedModel}`, data);
      } else {
        // 构建多模态消息内容
        const messageContent: any[] = [];
        
        // 调试日志
        console.log('Files received:', files);
        console.log('Files length:', files?.length);
        
        // 添加文本内容
        if (content) {
          messageContent.push({
            type: 'text',
            text: content
          });
        }
        
        // 添加图片文件
        if (files && files.length > 0) {
          for (const file of files) {
            console.log('Processing file:', file.name, file.type, file.data ? 'has data' : 'no data');
            if (file.data && file.type.startsWith('image/')) {
              messageContent.push({
                type: 'image_url',
                image_url: {
                  url: `data:${file.type};base64,${file.data}`
                }
              });
            }
          }
        }
        
        console.log('Message content:', messageContent);
        
        const messages = [{ 
          role: 'user', 
          content: messageContent.length === 1 && messageContent[0].type === 'text' 
            ? messageContent[0].text 
            : messageContent 
        }];
        
        addLog('request', `Send to ${selectedModel}`, {
          model: selectedModel,
          messages,
          config: { temperature }
        });

        const response = await fetch('http://localhost:3001/api/kimi/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'moonshotai/kimi-k2.5',
            messages,
            max_tokens: 16384,
            temperature,
            top_p: 1.00,
            stream: false,
            chat_template_kwargs: { thinking: true }
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error?.message || 'Kimi API request failed');
        }

        const data = await response.json();
        responseText = data.choices[0].message.content || "Model returned no response.";
        
        addLog('response', `Received from ${selectedModel}`, data);
      }

      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: responseText,
        format: msgFormat,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, assistantMsg]);

    } catch (error: any) {
      console.error("API Error:", error);
      addLog('error', `API Failure`, {
        message: error.message,
        stack: error.stack
      });

      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Sorry, an error occurred: ${error.message || 'Unknown error'}.`,
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errorMsg]);
    }
  }, [selectedModel, addLog, outputFormat, selectedLanguage, temperature, paddleOCRConfig, asrConfig]);

  return (
    <div className="flex h-screen w-full bg-[#09090b] text-zinc-100 overflow-hidden font-sans">
      {/* Sidebar - Model Selection & Config */}
      <Sidebar 
        selectedModel={selectedModel} 
        onSelectModel={setSelectedModel}
        temperature={temperature}
        onTemperatureChange={setTemperature}
        paddleOCRConfig={paddleOCRConfig}
        onPaddleOCRConfigChange={setPaddleOCRConfig}
        outputFormat={outputFormat}
        onOutputFormatChange={setOutputFormat}
        asrConfig={asrConfig}
        onAsrConfigChange={setAsrConfig}
        selectedLanguage={selectedLanguage}
        onLanguageChange={setSelectedLanguage}
      />

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col relative overflow-hidden border-x border-zinc-800">
        <header className="h-16 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-950/50 backdrop-blur-md z-10">
          <div className="flex items-center gap-3">
            <div className={`w-3 h-3 rounded-full ${
              selectedModel === ModelType.PADDLEOCR ? 'bg-orange-500 shadow-[0_0_10px_#f97316]' :
              selectedModel === ModelType.KIMI_K25 ? 'bg-emerald-500 shadow-[0_0_10px_#10b981]' :
              selectedModel === ModelType.NVIDIA_ASR ? 'bg-purple-500 shadow-[0_0_10px_#a855f7]' :
              'bg-blue-500 shadow-[0_0_10px_#3b82f6]'
            }`} />
            <h1 className="font-semibold text-lg">
              {selectedModel === ModelType.PADDLEOCR ? 'PaddleOCR' : 
               selectedModel === ModelType.DEEPSEEK ? 'DeepSeek' : 
               selectedModel === ModelType.NVIDIA_ASR ? 'NVIDIA ASR' : 'Kimi K2.5'} Interface
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setShowDebug(!showDebug)}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-all ${showDebug ? 'bg-zinc-800 text-zinc-100' : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'}`}
            >
              <Terminal size={16} />
              Debug View
            </button>
            <div className="w-px h-4 bg-zinc-800" />
            <Github size={20} className="text-zinc-500 cursor-pointer hover:text-white transition-colors" />
          </div>
        </header>

        {/* Chat Component */}
        <ChatWindow 
          messages={messages} 
          onSend={handleSendMessage} 
          selectedModel={selectedModel}
        />
      </main>

      {/* Debug Panel */}
      {showDebug && (
        <DebugConsole 
          logs={logs} 
          onClose={() => setShowDebug(false)} 
        />
      )}
    </div>
  );
};

export default App;
