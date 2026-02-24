import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  root: 'src/client',
  resolve: {
    alias: {
      '@/server': path.resolve(__dirname, 'src/server'),
      '@/client': path.resolve(__dirname, 'src/client'),
      '@/shared': path.resolve(__dirname, 'src/shared'),
    },
  },
  server: {
    host: true,
    port: 5173,
    
    proxy: {
      '/api/sse': {
        target: 'http://localhost:3333',
        changeOrigin: true,
        // SSE: disable proxy response buffering so events stream through immediately
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['cache-control'] = 'no-cache'
            proxyRes.headers['x-accel-buffering'] = 'no'
          })
        },
      },
      '/api': {
        target: 'http://localhost:3333',
        changeOrigin: true,
      },
    },
  },
  build: {
    outDir: path.resolve(__dirname, 'dist/client'),
    emptyOutDir: true,
  },
})
