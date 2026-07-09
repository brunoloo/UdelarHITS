import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['carload-chivalry-sinuous.ngrok-free.dev'],
    proxy: {
      '/api': 'https://udelarhits-production.up.railway.app',
      '/central': 'https://udelarhits-production.up.railway.app',
      '/socket.io': {
        target: 'https://udelarhits-production.up.railway.app',
        ws: true,
      },
    },
  },
})