import { readFileSync } from 'fs';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

// El CSP autoriza el script inline de index.html por su hash exacto: si el script cambia y
// el hash no, el navegador lo bloquea. Lee ambos archivos como texto, sin importar la app.

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
