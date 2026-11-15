// Solo se admiten proveedores conocidos, para bloquear correos temporales.
export const ALLOWED_EMAIL_DOMAINS = [
  'gmail.com', 'googlemail.com',
  'hotmail.com', 'hotmail.es', 'hotmail.com.ar',
  'outlook.com', 'outlook.es', 'outlook.com.ar',
  'live.com', 'live.com.ar', 'live.com.mx', 'msn.com',
  'proton.me', 'protonmail.com', 'pm.me',
  'yahoo.com', 'yahoo.es', 'yahoo.com.ar', 'yahoo.com.mx', 'ymail.com',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com', 'gmx.com', 'zoho.com', 'tutanota.com',
  'adinet.com.uy', 'vera.com.uy', 'montevideo.com.uy',
  'udelar.edu.uy', 'fing.edu.uy', 'correo.ucu.edu.uy',
];

const allowedSet = new Set(ALLOWED_EMAIL_DOMAINS);

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
