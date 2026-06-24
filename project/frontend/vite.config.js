import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    allowedHosts: ['carload-chivalry-sinuous.ngrok-free.dev'],
    // Permite importar project/shared/* (fuente de verdad compartida con el backend).
    fs: {
      allow: ['..'],
    },
    proxy: {
      '/api': 'http://localhost:5001',
      '/central': 'http://localhost:5001',
    },
  },
})