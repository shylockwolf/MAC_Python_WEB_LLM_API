
import React from 'react';
import { ModelType } from '../types';
import { Layers, Zap, Cpu, History, Settings, ExternalLink } from 'lucide-react';

interface SidebarProps {
  selectedModel: ModelType;
  onSelectModel: (model: ModelType) => void;
  temperature: number;
  onTemperatureChange: (temp: number) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ selectedModel, onSelectModel, temperature, onTemperatureChange }) => {
  const models = [
    { type: ModelType.DEEPSEEK, icon: <Zap size={18} className="text-blue-400" />, desc: 'High speed & efficient' },
    { type: ModelType.KIMI_K25, icon: <Cpu size={18} className="text-emerald-400" />, desc: 'Complex reasoning & coding' },
  ];

  const getDisplayName = (type: ModelType) => {
    switch(type) {
      case ModelType.DEEPSEEK: return 'DeepSeek Chat';
      case ModelType.KIMI_K25: return 'Kimi K2.5';
      default: return type;
    }
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
            <button className="w-full flex items-center gap-3 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-900 rounded-lg transition-colors">
              <Settings size={16} /> Key Management
            </button>
          </div>
        </div>
      </div>

      <div className="p-4 border-t border-zinc-900">
        <div className="bg-zinc-900/50 p-3 rounded-xl border border-zinc-800">
          <p className="text-[10px] text-zinc-500 mb-2">Connection Status</p>
          <div className="flex items-center gap-2 text-xs text-zinc-300">
            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Gemini API Ready
          </div>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
