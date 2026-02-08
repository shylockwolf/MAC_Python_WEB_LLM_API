
import React, { useState } from 'react';
import { ModelType, PaddleOCRConfig, OutputFormat, ASRConfig } from '../types';
import { Layers, Zap, Cpu, History, Settings, ExternalLink, Key, X, FileText, Code, Globe, Mic } from 'lucide-react';

interface SidebarProps {
  selectedModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
  paddleOCRConfig: PaddleOCRConfig;
  onPaddleOCRConfigChange: (config: PaddleOCRConfig) => void;
  outputFormat: OutputFormat;
  onOutputFormatChange: (format: OutputFormat) => void;
  asrConfig: ASRConfig;
  onAsrConfigChange: (config: ASRConfig) => void;
  selectedLanguage: string;
  onLanguageChange: (language: string) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedModel, onSelectModel, temperature, onTemperatureChange, paddleOCRConfig, onPaddleOCRConfigChange, outputFormat, onOutputFormatChange, asrConfig, onAsrConfigChange, selectedLanguage, onLanguageChange }) => {
  const [showApiKeyDialog, setShowApiKeyDialog] = useState(false);
  const [tempApiKey, setTempApiKey] = useState(paddleOCRConfig.apiKey);
  const [tempApiUrl, setTempApiUrl] = useState(paddleOCRConfig.apiUrl);
  const [showAsrConfigDialog, setShowAsrConfigDialog] = useState(false);
  const [tempAsrApiKey, setTempAsrApiKey] = useState(asrConfig.apiKey);
  const [tempAsrServer, setTempAsrServer] = useState(asrConfig.server);
  const [tempAsrFunctionId, setTempAsrFunctionId] = useState(asrConfig.functionId);

  const models = [
    { type: ModelType.DEEPSEEK, icon: <Zap size={18} className="text-blue-400" />, desc: 'High speed & efficient' },
    { type: ModelType.KIMI_K25, icon: <Cpu size={18} className="text-emerald-400" />, desc: 'Complex reasoning & coding' },
    { type: ModelType.PADDLEOCR, icon: <Key size={18} className="text-orange-400" />, desc: 'OCR text recognition' },
    { type: ModelType.NVIDIA_ASR, icon: <Mic size={18} className="text-purple-400" />, desc: 'Speech recognition' },
  ];

  const getDisplayName = (type: ModelType) => {
    switch(type) {
      case ModelType.DEEPSEEK: return 'DeepSeek Chat';
      case ModelType.KIMI_K25: return 'Kimi K2.5';
      case ModelType.PADDLEOCR: return 'PaddleOCR';
      case ModelType.NVIDIA_ASR: return 'NVIDIA ASR';
      default: return type;
    }
  };

  const handleSaveApiKey = () => {
    onPaddleOCRConfigChange({
      apiKey: tempApiKey,
      apiUrl: tempApiUrl
    });
    setShowApiKeyDialog(false);
  };

  const handleCancelApiKey = () => {
    setTempApiKey(paddleOCRConfig.apiKey);
    setTempApiUrl(paddleOCRConfig.apiUrl);
    setShowApiKeyDialog(false);
  };

  const handleSaveAsrConfig = () => {
    onAsrConfigChange({
      apiKey: tempAsrApiKey,
      server: tempAsrServer,
      functionId: tempAsrFunctionId
    });
    setShowAsrConfigDialog(false);
  };

  const handleCancelAsrConfig = () => {
    setTempAsrApiKey(asrConfig.apiKey);
    setTempAsrServer(asrConfig.server);
    setTempAsrFunctionId(asrConfig.functionId);
    setShowAsrConfigDialog(false);
  };

  return (
    <aside className="w-72 bg-zinc-950 flex flex-col h-full border-r border-zinc-900">
      <div className="p-6 flex items-center gap-2 border-b border-zinc-900">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center shadow-lg">
          <Layers size={18} className="text-white" />
        </div>
        <span className="font-bold text-xl tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-zinc-400">
          LLM Omni
        </span>
      </div>

      <div className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
        <div>
          <h3 className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">AI Models</h3>
          <div className="space-y-1">
            {models.map((m) => (
              <button
                key={m.type}
                onClick={() => onSelectModel(m.type)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-all duration-200 group ${
                  selectedModel === m.type 
                    ? 'bg-zinc-800 text-white shadow-sm ring-1 ring-zinc-700' 
                    : 'text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200'
                }`}
              >
                {m.icon}
                <div className="flex flex-col items-start text-left">
                  <span className="text-sm font-medium leading-none mb-1">{getDisplayName(m.type)}</span>
                  <span className="text-[10px] text-zinc-500 group-hover:text-zinc-400">{m.desc}</span>
                </div>
              </button>
            ))}
          </div>
        </div>

        <div>
          <h3 className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">API Parameters</h3>
          <div className="px-3 space-y-4">
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 flex justify-between">
                Temperature <span>{temperature.toFixed(1)}</span>
              </label>
              <input 
                type="range" 
                min="0" 
                max="2" 
                step="0.1" 
                value={temperature}
                onChange={(e) => onTemperatureChange(parseFloat(e.target.value))}
                className="w-full accent-indigo-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer" 
              />
            </div>
            
            {selectedModel === ModelType.PADDLEOCR && (
              <div className="space-y-2">
                <label className="text-xs text-zinc-400">Output Format</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => onOutputFormatChange(OutputFormat.TEXT)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      outputFormat === OutputFormat.TEXT
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    <FileText size={16} />
                    <span className="text-xs">Text</span>
                  </button>
                  <button
                    onClick={() => onOutputFormatChange(OutputFormat.JSON)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      outputFormat === OutputFormat.JSON
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    <Code size={16} />
                    <span className="text-xs">JSON</span>
                  </button>
                  <button
                    onClick={() => onOutputFormatChange(OutputFormat.HTML)}
                    className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
                      outputFormat === OutputFormat.HTML
                        ? 'bg-indigo-600 text-white'
                        : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'
                    }`}
                  >
                    <Globe size={16} />
                    <span className="text-xs">HTML</span>
                  </button>
                </div>
              </div>
            )}
            
            {selectedModel === ModelType.NVIDIA_ASR && (
              <div className="space-y-2">
                <label className="text-xs text-zinc-400">Language</label>
                <select
                  value={selectedLanguage}
                  onChange={(e) => onLanguageChange(e.target.value)}
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="multi">Auto Detect</option>
                  <option value="zh-CN">Chinese</option>
                  <option value="en-US">English</option>
                  <option value="ja-JP">Japanese</option>
                  <option value="ko-KR">Korean</option>
                  <option value="fr-FR">French</option>
                  <option value="de-DE">German</option>
                  <option value="es-ES">Spanish</option>
                </select>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs text-zinc-400 flex justify-between">
                Max Tokens <span>2048</span>
              </label>
              <input type="range" className="w-full accent-indigo-500 bg-zinc-800 h-1.5 rounded-lg appearance-none cursor-pointer" />
            </div>
          </div>
        </div>

        <div>
          <h3 className="px-3 text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">Options</h3>
          <div className="space-y-1">
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors">
              <History size={16} /> Conversation History
            </button>
            <button 
              onClick={() => setShowApiKeyDialog(true)}
              className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors"
            >
              <Key size={16} /> API Key Management
            </button>
          </div>
        </div>
      </div>

      {showApiKeyDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">PaddleOCR API Configuration</h3>
              <button 
                onClick={handleCancelApiKey}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">API URL</label>
                <input
                  type="text"
                  value={tempApiUrl}
                  onChange={(e) => setTempApiUrl(e.target.value)}
                  placeholder="https://api.paddleocr.com/v1/ocr"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">API Key</label>
                <input
                  type="password"
                  value={tempApiKey}
                  onChange={(e) => setTempApiKey(e.target.value)}
                  placeholder="Enter your PaddleOCR API key"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelApiKey}
                  className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveApiKey}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showAsrConfigDialog && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-zinc-900 rounded-xl p-6 w-full max-w-md border border-zinc-700 shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">NVIDIA ASR Configuration</h3>
              <button 
                onClick={handleCancelAsrConfig}
                className="text-zinc-400 hover:text-white transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">API Key</label>
                <input
                  type="password"
                  value={tempAsrApiKey}
                  onChange={(e) => setTempAsrApiKey(e.target.value)}
                  placeholder="Enter your NVIDIA API key"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Server</label>
                <input
                  type="text"
                  value={tempAsrServer}
                  onChange={(e) => setTempAsrServer(e.target.value)}
                  placeholder="grpc.nvcf.nvidia.com:443"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-300 mb-2">Function ID</label>
                <input
                  type="text"
                  value={tempAsrFunctionId}
                  onChange={(e) => setTempAsrFunctionId(e.target.value)}
                  placeholder="b702f636-f60c-4a3d-a6f4-f3568c13bd7d"
                  className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              
              <div className="flex gap-3 pt-2">
                <button
                  onClick={handleCancelAsrConfig}
                  className="flex-1 px-4 py-2 bg-zinc-700 text-white rounded-lg hover:bg-zinc-600 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveAsrConfig}
                  className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-500 transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="p-4 border-t border-zinc-900">
        <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
          <p className="text-[10px] text-zinc-500 mb-2">Connection Status</p>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            {selectedModel === ModelType.PADDLEOCR ? 'PaddleOCR API Ready' : 
             selectedModel === ModelType.NVIDIA_ASR ? 'NVIDIA ASR API Ready' : 'LLM API Ready'}
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
