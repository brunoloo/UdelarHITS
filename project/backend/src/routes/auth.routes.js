import { Router } from 'express';
import { registerUser, verifyEmail, resendCode, loginUser, logoutUser, googleAuthCallback, setupNickname, createUserByAdmin, forgotPassword, verifyResetToken, resetPassword } from '../controllers/user.controller.js';
import { protect, isAdmin } from '../middlewares/auth.middleware.js';
import passport from '../config/passport.js';

const router = Router();

router.post('/register', registerUser);
router.post('/verify-email', verifyEmail);
router.post('/resend-code', resendCode);
router.post('/login', loginUser);
router.post('/logout', protect, logoutUser);

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

router.post('/setup-nickname', protect, setupNickname);

router.post('/forgot-password', forgotPassword);
router.post('/verify-reset-token', verifyResetToken);
router.post('/reset-password', resetPassword);


router.post('/admin/register', protect, isAdmin, createUserByAdmin);

export default router;