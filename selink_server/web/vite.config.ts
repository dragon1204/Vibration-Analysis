import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev: API at http://localhost:8000 (docker compose exposes it on 127.0.0.1:8000).
declare const process: { env: Record<string, string | undefined> }
// Dev only: point the proxy at another API, e.g. API_TARGET=http://server npm run dev
const apiTarget = process.env.API_TARGET || 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': apiTarget,
      '/ws': { target: apiTarget.replace(/^http/, 'ws'), ws: true },
    },
  },
  build: {
    chunkSizeWarningLimit: 2500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('/echarts/') || id.includes('/echarts-for-react/')) return 'echarts'
          if (id.includes('/antd/') || id.includes('/@ant-design/icons/')) return 'antd'
        },
      },
    },
  },
})
