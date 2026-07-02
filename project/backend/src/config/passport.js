import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { handleGoogleAuthService } from '../services/user.service.js';

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET && process.env.GOOGLE_CALLBACK_URL) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: process.env.GOOGLE_CALLBACK_URL,
  }, async (accessToken, refreshToken, profile, done) => {
    try {
      const user = await handleGoogleAuthService(profile);
      return done(null, user);
    } catch (error) {
      if (error.code === 'EMAIL_TAKEN_LOCAL') {
        return done(null, false, { code: error.code, message: error.message });
      }
      return done(error);
    }
  }));
}

export default passport;
