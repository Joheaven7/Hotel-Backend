// config/passport.js
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const FacebookStrategy = require('passport-facebook').Strategy;
const User = require('../models/User'); // Update with your actual User model path

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
          { email: profile.emails[0].value },
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

// Optional Facebook Strategy config if you choose to support it
passport.use(new FacebookStrategy({
  clientID: process.env.FACEBOOK_APP_ID,
  clientSecret: process.env.FACEBOOK_APP_SECRET,
  callbackURL: "/api/auth/facebook/callback",
  profileFields: ['id', 'emails', 'name']
},
  async (accessToken, refreshToken, profile, done) => {
    try {
      let email = profile.emails && profile.emails[0] ? profile.emails[0].value : `${profile.id}@facebook.com`;
      let user = await User.findOne({
        $or: [
          { email: email },
          { facebookId: profile.id }
        ]
      });
      
      if (!user) {
        user = await User.create({
          firstName: profile.name.givenName || 'Facebook',
          lastName: profile.name.familyName || 'User',
          email: email,
          facebookId: profile.id,
          role: 'CUSTOMER',
          isEmailVerified: true,
          isActive: true
        });
      } else if (!user.facebookId) {
        // Link Facebook ID to existing user
        user.facebookId = profile.id;
        user.isEmailVerified = true;
        await user.save();
      }
      return done(null, user);
    } catch (err) {
      return done(err, null);
    }
  }
));

module.exports = passport;