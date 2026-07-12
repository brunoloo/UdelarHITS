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
    proxy: {
      '/api': 'http://localhost:5001',
      '/central': 'http://localhost:5001',
      '/socket.io': {
        target: 'http://localhost:5001',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.js',
  },
})