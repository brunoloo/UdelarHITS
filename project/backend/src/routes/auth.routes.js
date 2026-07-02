import { Router } from 'express';
import { registerUser, verifyEmail, resendCode, loginUser, logoutUser, googleAuthCallback, createUserByAdmin, forgotPassword, verifyResetToken, resetPassword } from '../controllers/user.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';
import passport from '../config/passport.js';

const router = Router();

// Auth pública
router.post('/register', registerUser);              // Paso 1: envía el código al email
router.post('/verify-email', verifyEmail);           // Paso 2: confirma el código y crea la cuenta
router.post('/resend-code', resendCode);             // Reenvía el código a un registro pendiente
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);

// Login con Google (OAuth 2.0)
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback', (req, res, next) => {
  passport.authenticate('google', { session: false }, (err, user, info) => {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

    if (err) {
      console.error('[Google OAuth] Error inesperado en callback:', err.message);
      return res.redirect(`${frontendUrl}/login?error=google_error`);
    }

    if (!user) {
      const code = info?.code || 'UNKNOWN';
      console.error(`[Google OAuth] Autenticación fallida — code=${code}, message=${info?.message}`);
      if (code === 'EMAIL_TAKEN_LOCAL') {
        return res.redirect(`${frontendUrl}/login?error=email_taken`);
      }
      return res.redirect(`${frontendUrl}/login?error=google_error`);
    }

    req.user = user;
    return googleAuthCallback(req, res);
  })(req, res, next);
});

// Recuperación de contraseña (pública)
router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);


// Crear usuario por admin
router.post('/admin/register', protect, isAdmin, createUserByAdmin);

export default router;