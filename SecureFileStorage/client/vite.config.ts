import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:5001', changeOrigin: true },
      '/health': { target: 'http://localhost:5001', changeOrigin: true },
    },
  },
  build: {
    // Vercel / preview: dist. Pour embarquer dans l'API : npm run build:api
    outDir: 'dist',
    emptyOutDir: true,
  },
})
