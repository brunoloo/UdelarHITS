import { Buffer } from 'node:buffer'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

function stripCrossorigin() {
  return {
    name: 'strip-crossorigin',
    transformIndexHtml(html) {
      // Los assets se sirven desde el mismo origen y el crossorigin que agrega Vite rompía su carga.
      // El preconnect a fonts.gstatic sí lo necesita: las fuentes se piden con CORS.
      const stripped = html.replace(/\s+crossorigin/g, '')
      return stripped.replace(
        /(<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com")/,
        '$1 crossorigin'
      )
    },
  }
}

// Inserta en index.html el CSS de entrada para evitar pedidos bloqueantes en el arranque.
// El CSS de las rutas lazy sigue en archivos aparte.
function inlineEntryCss() {
  return {
    name: 'inline-entry-css',
    transformIndexHtml: {
      // Después de que Vite inyectó los <link> y <script> del build.
      order: 'post',
      handler(html, ctx) {
        // ctx.bundle solo existe en build.
        if (!ctx.bundle) return html
        // Solo los <link> de una línea que apuntan a un .css local; el de fuentes no coincide.
        return html.replace(
          /<link rel="stylesheet"[^>\n]*\shref="\/([^"]+\.css)"[^>\n]*>\s*/g,
          (tag, fileName) => {
            const asset = ctx.bundle[fileName]
            if (!asset || asset.type !== 'asset') return tag
            const css = typeof asset.source === 'string'
              ? asset.source
              : Buffer.from(asset.source).toString('utf8')
            return `<style>${css}</style>`
          }
        )
      },
    },
  }
}

export default defineConfig({
  plugins: [react(), stripCrossorigin(), inlineEntryCss()],
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