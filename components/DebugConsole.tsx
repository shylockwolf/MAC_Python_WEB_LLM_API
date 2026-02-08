
import React, { useState } from 'react';
import { DebugLog } from '../types';
import { ChevronRight, ChevronDown, Terminal, Clock, Copy, Trash2, X } from 'lucide-react';

interface DebugConsoleProps {
  logs: DebugLog[];
  onClose: () => void;
}

const DebugConsole: React.FC<DebugConsoleProps> = ({ logs, onClose }) => {
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set([logs[0]?.id].filter(Boolean)));

  const toggleExpand = (id: string) => {
    const next = new Set(expandedLogs);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setExpandedLogs(next);
  };

  return (
    <div className="w-[450px] flex flex-col h-full bg-[#0c0c0e] border-l border-zinc-800 animate-in slide-in-from-right duration-300">
      <header className="h-16 flex items-center justify-between px-6 border-b border-zinc-800 bg-zinc-950/50">
        <div className="flex items-center gap-2 text-indigo-400">
          <Terminal size={18} />
          <h2 className="font-semibold text-sm">调试控制台</h2>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-zinc-800 rounded-md text-zinc-500 hover:text-zinc-200 transition-colors">
          <X size={18} />
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-[11px]">
        {logs.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-zinc-600 gap-4 opacity-50">
            <Terminal size={48} strokeWidth={1} />
            <p>等待 API 交互日志...</p>
          </div>
        ) : (
          logs.map((log) => (
            <div 
              key={log.id} 
              className={`border rounded-lg overflow-hidden transition-all ${
                log.type === 'request' ? 'border-blue-500/20 bg-blue-500/5' : 
                log.type === 'response' ? 'border-emerald-500/20 bg-emerald-500/5' :
                'border-zinc-800 bg-zinc-900/20'
              }`}
            >
              <button 
                onClick={() => toggleExpand(log.id)}
                className="w-full flex items-center justify-between p-3 text-left hover:bg-white/5 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase ${
                    log.type === 'request' ? 'bg-blue-500 text-white' : 
                    log.type === 'response' ? 'bg-emerald-500 text-black' :
                    'bg-zinc-700 text-white'
                  }`}>
                    {log.type}
                  </span>
                  <span className="font-medium text-zinc-300 truncate max-w-[180px]">{log.title}</span>
                </div>
                <div className="flex items-center gap-3 text-zinc-500">
                  <span className="flex items-center gap-1"><Clock size={10} /> {new Date(log.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                  {expandedLogs.has(log.id) ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                </div>
              </button>

              {expandedLogs.has(log.id) && (
                <div className="p-3 pt-0 border-t border-white/5">
                  <div className="relative group">
                    <pre className="p-3 bg-black/40 rounded-md overflow-x-auto text-zinc-400 leading-relaxed max-h-[300px]">
                      {JSON.stringify(log.payload, null, 2)}
                    </pre>
                    <button 
                      className="absolute top-2 right-2 p-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white rounded opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => navigator.clipboard.writeText(JSON.stringify(log.payload, null, 2))}
                    >
                      <Copy size={12} />
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))
        )}
      </div>

      <footer className="p-4 border-t border-zinc-800 bg-zinc-950/50 flex justify-between items-center">
        <span className="text-[10px] text-zinc-500">
          日志数量: {logs.length} / 100
        </span>
        <button className="flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-medium text-zinc-500 hover:text-red-400 transition-colors uppercase tracking-wider">
          <Trash2 size={12} /> 清理日志
        </button>
      </footer>
    </div>
  );
};

export default DebugConsole;
