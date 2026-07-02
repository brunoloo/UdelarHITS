import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { handleGoogleAuthService } from '../services/user.service.js';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  }, async (accessToken, refreshToken, profile, done) => {
    const email = profile?.emails?.[0]?.value || '(sin email)';
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
