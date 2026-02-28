import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: '/kinbot/',
  server: {
    port: 5174,
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      output: {
        manualChunks(id) {
          // React core + DOM in a stable, long-cached chunk
          if (id.includes('node_modules/react-dom') || id.includes('node_modules/react/')) {
            return 'vendor-react'
          }
          // Lucide icons (used everywhere)
          if (id.includes('node_modules/lucide-react')) {
            return 'vendor-icons'
          }
          // Lobehub provider icons (large SVGs, rarely change)
          if (id.includes('node_modules/@lobehub/icons')) {
            return 'vendor-provider-icons'
          }
        },
      },
    },
  },
})
