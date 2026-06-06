// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User'); // Update with your actual User model path
const { encryptEmail } = require('../utils/encryption');

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackURL: "/api/auth/google/callback",
    proxy: true
  },
    async (accessToken, refreshToken, profile, done) => {
      try {
        // Check if user already exists by their email or Google ID
        let user = await User.findOne({
          $or: [
            { email: encryptEmail(profile.emails[0].value) },
            { googleId: profile.id }
          ]
        });

        if (!user) {
          // Create user if they don't exist
          user = await User.create({
            firstName: profile.name.givenName,
            lastName: profile.name.familyName,
            email: profile.emails[0].value,
            googleId: profile.id,
            role: 'CUSTOMER',
            isEmailVerified: true,
            isActive: true,
          });
        } else if (!user.googleId) {
          // Link Google ID to existing user
          user.googleId = profile.id;
          user.isEmailVerified = true;
          await user.save();
        }
        return done(null, user);
      } catch (err) {
        return done(err, null);
      }
    }
  ));
} else {
  console.warn('⚠️ Google OAuth credentials missing. Google login will be disabled.');
}


module.exports = passport;