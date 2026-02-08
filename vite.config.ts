import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, '.', '');
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
        proxy: {
          '/api/deepseek': {
            target: 'https://api.deepseek.com',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/api\/deepseek/, '')
          },
          '/api/kimi': {
            target: 'https://integrate.api.nvidia.com',
            changeOrigin: true,
            secure: true,
            rewrite: (path) => path.replace(/^\/api\/kimi/, '')
          }
        }
      },
      plugins: [react()],
      define: {
        'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
        'process.env.DEEPSEEK_API_KEY': JSON.stringify(env.DEEPSEEK_API_KEY),
        'process.env.KIMI_API_KEY': JSON.stringify(env.KIMI_API_KEY)
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
