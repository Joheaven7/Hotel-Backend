const express = require('express');
const passport = require('passport');
const jwt = require('jsonwebtoken');
const User = require('../../models/User');
const authController = require('./auth.controller');
const authMiddleware = require('../../middlewares/auth');
const { validateRegistration, handleValidationErrors } = require('../../utils/validators');
const { createRateLimiter } = require('../../middlewares/rateLimiter');
const { logAudit } = require('../../middlewares/auditLogger');

const router = express.Router();

const authLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: 'Too many authentication attempts from this IP. Please try again in 15 minutes.'
});

const { generateAccessToken, generateRefreshToken, getCookieOptions } = authController;

// Standard Credentials routes
router.post('/register', authLimiter, validateRegistration, handleValidationErrors, authController.registerUser);
router.post('/login', authLimiter, authController.loginUser);
router.post('/refresh', authController.refreshToken);
router.post('/logout', authController.logoutUser);

// ==========================================
// 🚀 SOCIAL AUTHENTICATION ENDPOINTS
// ==========================================

// --- Google Auth ---
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'], session: false }));

router.get('/google/callback',
  passport.authenticate('google', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;

      // Generate real JWT tokens
      const accessToken = generateAccessToken(user._id, user.role);
      const refreshToken = generateRefreshToken(user._id);

      // Store refresh token on user document
      await User.findByIdAndUpdate(user._id, {
        refreshToken,
        lastLoginAt: new Date(),
      });

      // Set refresh token cookie
      res.cookie('refreshToken', refreshToken, getCookieOptions());

      // Log the OAuth login
      logAudit({
        userId: user._id,
        user,
        actionType: 'LOGIN',
        resource: '/auth/google/callback',
        details: { email: user.email, role: user.role, method: 'google' },
        req,
      });

      const userString = encodeURIComponent(JSON.stringify({
        id: user._id,
        _id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      }));

      // Redirect with real JWT token in hash fragment to protect it from logs/intercepts
      res.redirect(`${process.env.CLIENT_URL}/login#token=${accessToken}&user=${userString}`);
    } catch (error) {
      console.error('Google OAuth callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }
  }
);

// --- Facebook Auth ---
router.get('/facebook', passport.authenticate('facebook', { scope: ['email'], session: false }));

router.get('/facebook/callback',
  passport.authenticate('facebook', { session: false, failureRedirect: `${process.env.CLIENT_URL}/login?error=oauth_failed` }),
  async (req, res) => {
    try {
      const user = req.user;

      const accessToken = generateAccessToken(user._id, user.role);
      const refreshToken = generateRefreshToken(user._id);

      await User.findByIdAndUpdate(user._id, {
        refreshToken,
        lastLoginAt: new Date(),
      });

      res.cookie('refreshToken', refreshToken, getCookieOptions());

      logAudit({
        userId: user._id,
        user,
        actionType: 'LOGIN',
        resource: '/auth/facebook/callback',
        details: { email: user.email, role: user.role, method: 'facebook' },
        req,
      });

      const userString = encodeURIComponent(JSON.stringify({
        id: user._id,
        _id: user._id,
        email: user.email,
        role: user.role,
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      }));

      res.redirect(`${process.env.CLIENT_URL}/login#token=${accessToken}&user=${userString}`);
    } catch (error) {
      console.error('Facebook OAuth callback error:', error);
      res.redirect(`${process.env.CLIENT_URL}/login?error=oauth_failed`);
    }
  }
);

// Protected routes
router.get('/me', authMiddleware, authController.getCurrentUser);

module.exports = router;