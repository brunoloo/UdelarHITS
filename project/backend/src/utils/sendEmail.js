import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

// Mismo criterio de enmascarado que passport.js (auditoría de seguridad):
// nunca volcar el email completo en los logs.
const maskEmail = (email) => {
  if (!email || typeof email !== 'string' || !email.includes('@')) return '[sin email]';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}***@${domain}`;
};

// Defensa 5: distinguir el rechazo por cuota de Resend (100/día, 3.000/mes en
// el plan free) de otros errores de envío. Resend señala los límites con
// statusCode 429 y nombres tipo rate_limit_exceeded / daily_quota_exceeded.
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
