import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: API at http://localhost:8000 (docker compose exposes it on 127.0.0.1:8000).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:8000',
      '/ws': { target: 'ws://localhost:8000', ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks: {
          echarts: ['echarts', 'echarts-for-react'],
          antd: ['antd', '@ant-design/icons'],
        },
      },
    },
  },
})
