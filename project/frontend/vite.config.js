import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      // Vite agrega crossorigin a sus <script type="module"> y modulepreloads;
      // los assets se sirven same-origin y ese crossorigin rompía su carga, así
      // que se quita de TODO el HTML. Excepción: el preconnect a fonts.gstatic
      // SÍ necesita crossorigin — las fuentes se descargan con CORS (anónimo) y
      // sin él el preconnect abre una conexión que el fetch de la fuente no
      // reutiliza. Los preconnect a Cloudinary/fonts.googleapis van SIN
      // crossorigin a propósito (imágenes y CSS se piden non-CORS).
      const stripped = html.replace(/\s+crossorigin/g, '')
      return stripped.replace(
        /(<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com")/,
        '$1 crossorigin'
      )
    },
  }
}

export default defineConfig({
  plugins: [react(), stripCrossorigin()],
  server: {
    port: 5173,
    allowedHosts: ['.ngrok-free.dev', '.ngrok-free.app', '.ngrok.io'],
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