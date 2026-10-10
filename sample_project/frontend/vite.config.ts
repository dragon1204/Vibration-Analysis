import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import express from 'express'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    {
      name: 'serve-models-from-external-dir',
      configureServer(server) {
        server.middlewares.use('/models', express.static('D:/Yootek/DEV/DATN/model3D/building'));
      }
    }
  ],
  server: {
    host: true,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
