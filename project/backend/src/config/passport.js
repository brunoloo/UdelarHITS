import crypto from 'crypto';
import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { handleGoogleAuthService } from '../services/user.service.js';

// Para logs: no se registra la dirección completa.
const maskEmail = (email) => {
  if (!email || !email.includes('@')) return '(sin email)';
  const [user, domain] = email.split('@');
  return `${user.slice(0, 1)}***@${domain}`;
};

// Parámetro `state` de OAuth guardado en una cookie (no hay sesiones de
// servidor): evita que un tercero complete el login con su propia cuenta.
const STATE_COOKIE = 'oauth_state';
const stateCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/api/auth/google',
};

const cookieStateStore = {
  store(req, callback) {
    const state = crypto.randomBytes(16).toString('hex');
    req.res.cookie(STATE_COOKIE, state, { ...stateCookieOptions, maxAge: 10 * 60 * 1000 });
    callback(null, state);
  },
  verify(req, providedState, callback) {
    const expected = req.cookies?.[STATE_COOKIE];
    req.res.clearCookie(STATE_COOKIE, stateCookieOptions);
    const valid = typeof expected === 'string' && typeof providedState === 'string' &&
      expected.length === providedState.length &&
      crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(providedState));
    if (!valid) return callback(null, false, { code: 'INVALID_STATE', message: 'Estado de OAuth inválido' });
    return callback(null, true);
  },
};

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
    store: cookieStateStore,
  }, async (accessToken, refreshToken, profile, done) => {
    const email = maskEmail(profile?.emails?.[0]?.value);
    try {
      const user = await handleGoogleAuthService(profile);
      console.log(`[Google OAuth] Login exitoso — email=${email}, userId=${user.id}, auth_provider=${user.auth_provider}`);
      return done(null, user);
    } catch (error) {
      console.error(`[Google OAuth] Error — email=${email}, code=${error.code || 'UNKNOWN'}, message=${error.message}`);
      return done(null, false, { code: error.code || 'INTERNAL', message: error.message });
    }
  }));
}

export default passport;
