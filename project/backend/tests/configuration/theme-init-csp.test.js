import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// Guarda de integridad del script anti-flash de tema.
//
// El <script> inline del <head> de frontend/index.html corre antes del primer
// paint y setea data-theme para evitar el flash. El CSP (helmet, en src/app.js)
// lo autoriza por su hash sha256 EXACTO. Si alguien edita el script y no
// recalcula el hash, el navegador bloquea el script en producción y el sitio se
// queda sin tema — en silencio. Este test falla acá, en CI, en vez de allá.
//
// No importa app.js ni toca la base: lee ambos archivos como texto.

const __dirname = dirname(fileURLToPath(import.meta.url));
const indexHtmlPath = resolve(__dirname, '../../../frontend/index.html');
const appJsPath = resolve(__dirname, '../../src/app.js');

describe('anti-flash de tema — hash CSP', () => {
  const html = readFileSync(indexHtmlPath, 'utf8');
  const appJs = readFileSync(appJsPath, 'utf8');

  it('el <head> tiene exactamente un <script> inline', () => {
    const scripts = html.match(/<script>[\s\S]*?<\/script>/g) || [];
    expect(scripts).toHaveLength(1);
  });

  it('el hash declarado en app.js coincide con el sha256 del script inline', () => {
    const script = html.match(/<script>([\s\S]*?)<\/script>/);
    expect(script).not.toBeNull();

    const computed =
      'sha256-' + createHash('sha256').update(script[1]).digest('base64');

    const declared = appJs.match(/'(sha256-[A-Za-z0-9+/=]+)'/);
    expect(declared).not.toBeNull();

    // Mensaje explícito: si falla, hay que copiar el hash calculado a app.js.
    expect(declared[1]).toBe(computed);
  });
});
