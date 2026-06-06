const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const User = require('../../models/User');
const { logAudit } = require('../../middlewares/auditLogger');
const { encryptEmail } = require('../../utils/encryption');
const { sendEmail } = require('../../services/emailService');

const getCookie = (req, name) => {
  const cookieHeader = req.headers.cookie;
  if (!cookieHeader) return null;
  const cookies = cookieHeader.split(';').reduce((acc, cookie) => {
    const [key, ...val] = cookie.trim().split('=');
    acc[key] = val.join('=');
    return acc;
  }, {});
  return cookies[name] || null;
};

const generateAccessToken = (userId, role) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET environment variable is missing');
  }
  return jwt.sign({ id: userId, role }, process.env.JWT_SECRET, {
    expiresIn: '15m',
  });
};

const generateRefreshToken = (userId) => {
  const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET or JWT_SECRET environment variable is missing');
  }
  return jwt.sign(
    { id: userId },
    secret,
    { expiresIn: '7d' }
  );
};

const getCookieOptions = () => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  maxAge: 7 * 24 * 60 * 60 * 1000,
});

exports.generateAccessToken = generateAccessToken;
exports.generateRefreshToken = generateRefreshToken;
exports.getCookieOptions = getCookieOptions;

// Format user object consistently for all auth responses
const formatUser = (user) => ({
  id: user._id,
  _id: user._id,
  firstName: user.firstName || '',
  lastName: user.lastName || '',
  name: user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  email: user.email,
  phone: user.phone || '',
  role: user.role,
  isActive: user.isActive,
  department: user.department || '',
  createdAt: user.createdAt,
});

exports.registerUser = async (req, res) => {
  try {
    const { firstName, lastName, name, email, password, phone } = req.body;

    // Support both { firstName, lastName } and legacy { name }
    const resolvedFirstName = firstName || (name ? name.split(' ')[0] : '');
    const resolvedLastName = lastName || (name ? name.split(' ').slice(1).join(' ') : '');

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    if (!resolvedFirstName) {
      return res.status(400).json({ message: 'First name is required' });
    }

    const existingUser = await User.findOne({ email: encryptEmail(email) });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already registered' });
    }

    const user = new User({
      firstName: resolvedFirstName,
      lastName: resolvedLastName,
      name: `${resolvedFirstName} ${resolvedLastName}`.trim(),
      email,
      password,
      phone: phone || '',
      role: 'CUSTOMER',
      isActive: true,
    });

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    await user.save();

    res.cookie('refreshToken', refreshToken, getCookieOptions());

    res.status(201).json({
      message: 'User registered successfully',
      token: accessToken,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ message: 'Registration failed. Please try again.' });
  }
};

exports.loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: encryptEmail(email) }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    if (!user.isActive) {
      return res.status(401).json({ message: 'Your account has been deactivated. Please contact support.' });
    }

    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const accessToken = generateAccessToken(user._id, user.role);
    const refreshToken = generateRefreshToken(user._id);

    user.refreshToken = refreshToken;
    user.lastLoginAt = new Date();
    await user.save();

    res.cookie('refreshToken', refreshToken, getCookieOptions());

    // Log login event
    logAudit({
      userId: user._id,
      user,
      actionType: 'LOGIN',
      resource: '/auth/login',
      details: { email: user.email, role: user.role },
      req,
    });

    res.json({
      message: 'Login successful',
      token: accessToken,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Login failed. Please try again.' });
  }
};

exports.refreshToken = async (req, res) => {
  try {
    const rToken = getCookie(req, 'refreshToken') || req.body.refreshToken;
    if (!rToken) {
      return res.status(401).json({ message: 'Refresh token not found' });
    }

    const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
    if (!secret) {
      return res.status(500).json({ message: 'JWT verification secret is missing' });
    }

    let decoded;
    try {
      decoded = jwt.verify(rToken, secret);
    } catch (err) {
      return res.status(401).json({ message: 'Invalid refresh token' });
    }

    const userId = decoded.id || decoded._id;
    const user = await User.findById(userId).select('+refreshToken');

    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'User not found or inactive' });
    }

    if (user.refreshToken !== rToken) {
      return res.status(401).json({ message: 'Refresh token reuse detected' });
    }

    const newAccessToken = generateAccessToken(user._id, user.role);
    const newRefreshToken = generateRefreshToken(user._id);

    user.refreshToken = newRefreshToken;
    await user.save();

    res.cookie('refreshToken', newRefreshToken, getCookieOptions());

    res.json({
      token: newAccessToken,
      user: formatUser(user),
    });
  } catch (error) {
    console.error('Refresh token error:', error);
    res.status(401).json({ message: 'Token refresh failed' });
  }
};

exports.logoutUser = async (req, res) => {
  try {
    const rToken = getCookie(req, 'refreshToken');
    if (rToken) {
      const secret = process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET;
      let decoded = null;
      if (secret) {
        try {
          decoded = jwt.verify(rToken, secret);
        } catch (err) {
          decoded = null;
        }
      }

      if (decoded) {
        await User.findByIdAndUpdate(decoded.id || decoded._id, { refreshToken: null });
      }
    }

    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    // Always clear cookie even on error
    res.clearCookie('refreshToken');
    res.json({ message: 'Logged out' });
  }
};

exports.getCurrentUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(formatUser(user));
  } catch (error) {
    res.status(500).json({ message: 'Failed to fetch user' });
  }
};

exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      return res.status(400).json({ message: 'Email is required' });
    }

    const encryptedEmail = encryptEmail(email);
    const user = await User.findOne({ email: encryptedEmail });
    
    if (!user) {
      // Return 200 anyway to prevent user enumeration
      return res.status(200).json({ message: 'If a user with that email exists, a reset link has been sent.' });
    }

    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');
    
    user.resetPasswordToken = hashedToken;
    user.resetPasswordExpires = Date.now() + 3600000; // 1 hour
    await user.save();

    const resetUrl = `${process.env.CLIENT_URL || 'http://localhost:3000'}/reset-password?token=${resetToken}`;

    const mailSent = await sendEmail(user.email, 'passwordReset', {
      name: user.name || 'User',
      resetUrl,
    });

    if (!mailSent) {
      user.resetPasswordToken = undefined;
      user.resetPasswordExpires = undefined;
      await user.save();
      return res.status(500).json({ message: 'Error sending password reset email' });
    }

    res.status(200).json({ message: 'Password reset link sent to your email.' });
  } catch (error) {
    console.error('Forgot password error:', error);
    res.status(500).json({ message: 'An internal error occurred. Please try again.' });
  }
};

exports.resetPassword = async (req, res) => {
  try {
    const { token, password } = req.body;
    if (!token || !password) {
      return res.status(400).json({ message: 'Token and password are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpires: { $gt: Date.now() },
    }).select('+resetPasswordToken +resetPasswordExpires');

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired reset token' });
    }

    user.password = password;
    user.resetPasswordToken = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.status(200).json({ message: 'Password reset successful. You can now log in.' });
  } catch (error) {
    console.error('Reset password error:', error);
    res.status(500).json({ message: 'An internal error occurred. Please try again.' });
  }
};