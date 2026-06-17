import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    console.error('Error enviando email:', error);
    throw new Error('Error al enviar el email');
  }

  return data;
};