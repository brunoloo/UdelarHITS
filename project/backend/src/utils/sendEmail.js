import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Para logs: no se registra la dirección completa.
const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '[sin email]';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}***@${domain}`;
};

// El proveedor señala los límites de cuota con 429 o con nombres de error de rate limit.
const isResendQuotaError = (error) =>
  error?.statusCode === 429 ||
  /quota|rate.?limit|daily|monthly/i.test(`${error?.name || ''} ${error?.message || ''}`);

export const sendEmail = async ({ to, subject, html }) => {
  if (process.env.NODE_ENV === 'test') return { id: 'test' };

  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM,
    replyTo: 'udelarhits@gmail.com',
    to,
    subject,
    html,
  });

  if (error) {
    console.error(`Error enviando email a ${maskEmail(to)}:`, error.name || error.message);
    if (isResendQuotaError(error)) {
      const err = new Error('El servicio de correo está temporalmente saturado');
      err.code = 'EMAIL_QUOTA';
      throw err;
    }
    const err = new Error('Error al enviar el email');
    err.code = 'EMAIL_SEND_FAILED';
    throw err;
  }

  return data;
};
