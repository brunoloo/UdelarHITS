import crypto from 'crypto';
import net from 'net';

// El proxy del borde agrega EDGE_SECRET en este header a todo pedido que reenvía.
const HEADER_SECRETO = 'x-edge-auth';
const HEADER_IP = 'cf-connecting-ip';

// Recortado: un espacio o salto de línea pegado al cargar la variable dejaría todo en 403.
const secreto = () => process.env.EDGE_SECRET?.trim() || '';

function secretoValido(headers) {
  const esperado = secreto();
  const recibido = headers[HEADER_SECRETO];
  if (!esperado || typeof recibido !== 'string') return false;
  const a = Buffer.from(recibido);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Con EDGE_ENFORCE=true se rechaza lo que llegue sin pasar por el borde.
// Sin esa variable se deja pasar todo, para poder activar el proxy sin cortar el sitio.
export function permitidoPorBorde(headers) {
  if (process.env.EDGE_ENFORCE !== 'true' || !secreto()) return true;
  return secretoValido(headers);
}

export default function edgeMiddleware(req, res, next) {
  if (!secreto()) return next();

  if (secretoValido(req.headers)) {
    // El borde pisa este header, así que solo se le cree si trae el secreto.
    // Sin esto, todos los usuarios compartirían la IP del proxy en los rate limits.
    const ip = req.headers[HEADER_IP];
    if (typeof ip === 'string' && net.isIP(ip)) {
      Object.defineProperty(req, 'ip', { value: ip, configurable: true, enumerable: true });
    }
    return next();
  }

  // El healthcheck de la plataforma entra por la red interna, sin el header.
  if (req.path === '/health' || permitidoPorBorde(req.headers)) return next();

  return res.status(403).json({ ok: false, message: 'Solicitud no permitida' });
}
