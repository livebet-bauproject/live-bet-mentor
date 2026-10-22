import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    target: 'es2020',
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-firebase': ['firebase/app', 'firebase/database']
        }
      }
    },
    chunkSizeWarningLimit: 1200
  },
  server: {
    host: '0.0.0.0', // Allow access from other devices on network
    watch: {
      ignored: ['**/server/**', '**/public/**', '**/*.json', '**/*.log', '**/bin/**']
    },
    proxy: {
      '/api-sofascore': {
        target: 'https://api.sofascore.com',
        changeOrigin: true,
        secure: false,
        rewrite: (path) => path.replace(/^\/api-sofascore/, ''),
        headers: {
          'Host': 'api.sofascore.com',
          'User-Agent': 'SofaScore/24.11.1 (Android/13; Mobile; en_US)',
          'x-requested-with': 'com.sofascore.results',
          'Accept': '*/*',
          'Accept-Language': 'en-US,en;q=0.9',
          'Connection': 'keep-alive'
        }
      },
      '/api-redscores': {
        target: 'https://redscores.com',
        changeOrigin: true,
        secure: false,
        followRedirects: true,
        rewrite: (path) => path.replace(/^\/api-redscores/, ''),
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
          'Accept': 'application/json, text/plain, */*',
          'X-Requested-With': 'XMLHttpRequest',
          'Referer': 'https://redscores.com/',
          'Origin': 'https://redscores.com',
          'Accept-Language': 'en-US,en;q=0.9'
        }
      },
      '/api/consensus': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false
      },
      '/api/sofascore': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
        secure: false
      }
    }
  }
})
