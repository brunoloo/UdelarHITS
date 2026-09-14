import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MAINTENANCE_HTML_CANDIDATES = [
  path.join(__dirname, '..', '..', '..', 'frontend', 'dist', 'mantenimiento.html'),
  path.join(__dirname, '..', '..', '..', 'frontend', 'public', 'mantenimiento.html'),
  path.join(process.cwd(), 'frontend', 'dist', 'mantenimiento.html'),
  path.join(process.cwd(), 'frontend', 'public', 'mantenimiento.html'),
];

let maintenanceHtml = null;

if (process.env.MAINTENANCE_MODE === 'true') {
  const htmlPath = MAINTENANCE_HTML_CANDIDATES.find((p) => fs.existsSync(p));
  if (htmlPath) {
    maintenanceHtml = fs.readFileSync(htmlPath, 'utf-8');
    console.log(`[maintenance] Modo mantenimiento ACTIVO. HTML cargado desde: ${htmlPath}`);
  } else {
    maintenanceHtml = '<!DOCTYPE html><html lang="es"><body><h1>Sitio en mantenimiento</h1><p>Volvemos pronto.</p></body></html>';
    console.warn('[maintenance] Modo mantenimiento ACTIVO pero no se encontró mantenimiento.html — usando fallback inline');
  }
}

export default function maintenanceMiddleware(req, res, next) {
  if (!maintenanceHtml) return next();

  if (req.path === '/health') {
    return res.status(200).json({ ok: true, maintenance: true });
  }

  res.status(503)
    .set('Content-Type', 'text/html; charset=utf-8')
    .set('Retry-After', '3600')
    .send(maintenanceHtml);
}
