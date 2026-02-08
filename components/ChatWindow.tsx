
import React, { useState, useRef, useEffect } from 'react';
import { Message, FileInfo, ModelType } from '../types';
import { Send, Paperclip, X, FileText, ImageIcon, User, Bot, CornerDownLeft } from 'lucide-react';

interface ChatWindowProps {
  messages: Message[];
  onSend: (content: string, files: FileInfo[]) => void;
  selectedModel: ModelType;
}

const ChatWindow: React.FC<ChatWindowProps> = ({ messages, onSend, selectedModel }) => {
  const [input, setInput] = useState('');
  const [attachedFiles, setAttachedFiles] = useState<FileInfo[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const getModelDisplayName = () => {
    switch(selectedModel) {
      case ModelType.DEEPSEEK: return 'DeepSeek';
      case ModelType.KIMI_K25: return 'Kimi K2.5';
      default: return 'LLM';
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = () => {
    if (input.trim() || attachedFiles.length > 0) {
      onSend(input, attachedFiles);
      setInput('');
      setAttachedFiles([]);
    }
  };

  /**
   * Fix: Explicitly type 'f' as 'File' to resolve 'Property does not exist on type unknown' errors (lines 36-38).
   * Also added asynchronous logic to read file data as base64 for use with Gemini API.
   */
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      const fileList = Array.from(files);
      const newFiles: FileInfo[] = await Promise.all(
        fileList.map(async (f: File) => {
          // Explicitly defining File type for 'f' fixes the TS errors on f.name, f.size, f.type
          const fileInfo: FileInfo = {
            name: f.name,
            size: f.size,
            type: f.type,
          };

          // Read file content as base64 to allow Gemini multi-modal processing
          try {
            const base64 = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                const result = reader.result as string;
                if (typeof result === 'string') {
                  resolve(result.split(',')[1]); // Remove the data URI scheme prefix
                } else {
                  reject(new Error("Failed to read file as string"));
                }
              };
              reader.onerror = reject;
              reader.readAsDataURL(f);
            });
            fileInfo.data = base64;
          } catch (err) {
            console.error('Error reading file for Gemini:', err);
          }

          return fileInfo;
        })
      );
      setAttachedFiles(prev => [...prev, ...newFiles]);
    }
  };

  const removeFile = (index: number) => {
    setAttachedFiles(prev => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-zinc-950 overflow-hidden">
      {/* Messages Area */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 md:p-8 space-y-8"
      >
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={`flex gap-4 max-w-4xl mx-auto ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}
          >
            <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${
              msg.role === 'user' ? 'bg-indigo-600' : 'bg-zinc-800'
            }`}>
              {msg.role === 'user' ? <User size={18} /> : <Bot size={18} />}
            </div>
            
            <div className={`flex flex-col gap-2 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}>
              <div className={`px-4 py-3 rounded-2xl text-sm leading-relaxed max-w-xl ${
                msg.role === 'user' 
                  ? 'bg-indigo-600/10 text-indigo-100 border border-indigo-500/20 rounded-tr-none' 
                  : 'bg-zinc-900 text-zinc-300 border border-zinc-800 rounded-tl-none'
              }`}>
                {msg.content}
                
                {msg.files && msg.files.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {msg.files.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 bg-black/20 px-2 py-1 rounded text-[10px] border border-white/5">
                        <FileText size={12} /> {f.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <span className="text-[10px] text-zinc-600">
                {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Input Area */}
      <div className="p-4 border-t border-zinc-900 bg-zinc-950">
        <div className="max-w-4xl mx-auto relative">
          {attachedFiles.length > 0 && (
            <div className="absolute bottom-full mb-3 left-0 right-0 flex flex-wrap gap-2 p-3 bg-zinc-900 border border-zinc-800 rounded-xl">
              {attachedFiles.map((file, idx) => (
                <div key={idx} className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 rounded-lg text-xs border border-zinc-700">
                  <FileText size={14} className="text-zinc-400" />
                  <span className="max-w-[150px] truncate">{file.name}</span>
                  <button onClick={() => removeFile(idx)} className="text-zinc-500 hover:text-white transition-colors">
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="relative group flex items-center gap-3 bg-zinc-900 border border-zinc-800 focus-within:border-indigo-500/50 focus-within:ring-4 focus-within:ring-indigo-500/10 transition-all rounded-2xl p-2 px-4 shadow-xl">
            <button 
              onClick={() => fileInputRef.current?.click()}
              className="text-zinc-500 hover:text-zinc-300 p-2 rounded-lg hover:bg-zinc-800 transition-colors"
            >
              <Paperclip size={20} />
            </button>
            <input 
              type="file" 
              multiple 
              className="hidden" 
              ref={fileInputRef} 
              onChange={handleFileChange}
            />
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`向 ${getModelDisplayName()} 提问...`}
              rows={1}
              className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-3 resize-none max-h-48 scrollbar-none"
            />

            <button
              onClick={handleSend}
              disabled={!input.trim() && attachedFiles.length === 0}
              className={`p-2.5 rounded-xl transition-all flex items-center justify-center ${
                input.trim() || attachedFiles.length > 0
                  ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-600/20 hover:scale-105 active:scale-95'
                  : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
              }`}
            >
              <Send size={18} />
            </button>
          </div>
          <div className="mt-2 flex justify-between items-center px-2">
            <div className="flex items-center gap-4 text-[10px] text-zinc-600">
               <span className="flex items-center gap-1"><CornerDownLeft size={10} /> 发送</span>
               <span className="flex items-center gap-1">Shift + Enter 换行</span>
            </div>
            <span className="text-[10px] text-zinc-600">
              Gemini API Optimized
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ChatWindow;
