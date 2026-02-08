
export enum ModelType {
  DEEPSEEK = 'deepseek-chat',
  KIMI_K25 = 'kimi-k2.5',
}

export interface Message {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  files?: FileInfo[];
}

export interface FileInfo {
  name: string;
  size: number;
  type: string;
  url?: string;
  data?: string; // Base64 encoded data for Gemini API
}

export interface DebugLog {
  id: string;
  timestamp: number;
  type: 'request' | 'response' | 'error' | 'info';
  model: ModelType;
  title: string;
  payload: any;
}
