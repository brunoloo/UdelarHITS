import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['carload-chivalry-sinuous.ngrok-free.dev'],
    proxy: {
      '/api': 'http://localhost:5001',
      '/central': 'http://localhost:5001',
    },
  },
})