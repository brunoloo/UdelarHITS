// Allowlist de dominios de correo conocidos. Solo se permite registrarse con
// un email cuyo dominio esté en esta lista: bloquea servicios de correo
// temporal/desechable (que nunca están acá) y exige proveedores reales.
// Ampliá la lista si necesitás soportar más dominios institucionales.
export const ALLOWED_EMAIL_DOMAINS = [
  // Google
  'gmail.com', 'googlemail.com',
  // Microsoft
  'hotmail.com', 'hotmail.es', 'hotmail.com.ar',
  'outlook.com', 'outlook.es', 'outlook.com.ar',
  'live.com', 'live.com.ar', 'live.com.mx', 'msn.com',
  // Proton
  'proton.me', 'protonmail.com', 'pm.me',
  // Yahoo
  'yahoo.com', 'yahoo.es', 'yahoo.com.ar', 'yahoo.com.mx', 'ymail.com',
  // Apple
  'icloud.com', 'me.com', 'mac.com',
  // Otros conocidos
  'aol.com', 'gmx.com', 'zoho.com', 'tutanota.com',
  // Uruguay (proveedores e instituciones comunes)
  'adinet.com.uy', 'vera.com.uy', 'montevideo.com.uy',
  'udelar.edu.uy', 'fing.edu.uy', 'correo.ucu.edu.uy',
];

const allowedSet = new Set(ALLOWED_EMAIL_DOMAINS);

// Devuelve el dominio (en minúsculas) de un email, o null si no tiene formato.
export const getEmailDomain = (email) => {
  if (typeof email !== 'string') return null;
  const at = email.lastIndexOf('@');
  if (at === -1) return null;
  const domain = email.slice(at + 1).trim().toLowerCase();
  return domain || null;
};

export const isAllowedEmailDomain = (email) => {
  const domain = getEmailDomain(email);
  return !!domain && allowedSet.has(domain);
};
