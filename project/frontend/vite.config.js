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

// Inlinea en index.html el CSS del entry que Vite deja como <link rel="stylesheet">
// bloqueante. Sin CDN delante de Railway, cada uno de esos <link> es un round-trip
// serial que bloquea el render (index.css + UserAvatar.css). Inlinearlos deja el
// arranque con CERO requests de CSS bloqueantes.
//
// Solo toca los <link> que Vite pone en index.html (el CSS del grafo eager). El
// CSS de rutas lazy NO está acá: Vite lo inyecta por JS al cargar cada chunk, así
// que sigue en archivos aparte y cacheables. El CSP lo permite (style-src trae
// 'unsafe-inline'; verificado contra la config de helmet en backend/src/app.js).
// El <script> inline de tema no se toca → su hash sha256 del CSP no cambia.
function inlineEntryCss() {
  return {
    name: 'inline-entry-css',
    transformIndexHtml: {
      // 'post': después de que Vite inyectó los <link>/<script> del build.
      order: 'post',
      handler(html, ctx) {
        // ctx.bundle solo existe en build; en dev no hay CSS emitido que inlinear.
        if (!ctx.bundle) return html
        // Matchea únicamente <link rel="stylesheet" ... href="/algo.css" ...> en
        // una línea (los del entry). El <link> de fuentes en <noscript> va en
        // varias líneas y apunta a fonts.googleapis (no a /*.css), así que no cae.
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