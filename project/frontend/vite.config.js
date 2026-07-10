import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      return html.replace(/\s+crossorigin/g, '')
    },
  }
}

export default defineConfig({
  plugins: [react(), stripCrossorigin()],
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