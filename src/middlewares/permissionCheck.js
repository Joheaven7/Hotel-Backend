const { DEFAULT_ROLE_PERMISSIONS } = require('../config/constants');

const requirePermission = (...requiredPermissions) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    // SUPER_ADMIN always has full access
    if (req.user.role === 'SUPER_ADMIN') {
      return next();
    }

    // Use user's individual permissions; fall back to role defaults from constants
    const userPermissions = req.user.permissions && req.user.permissions.length > 0
      ? req.user.permissions
      : DEFAULT_ROLE_PERMISSIONS[req.user.role] || [];

    // Wildcard grants everything
    if (userPermissions.includes('*')) {
      return next();
    }

    const hasAll = requiredPermissions.every((perm) => userPermissions.includes(perm));

    if (!hasAll) {
      return res.status(403).json({
        message: `Access denied. Insufficient permissions. Required: ${requiredPermissions.join(', ')}`,
      });
    }

    next();
  };
};

module.exports = { requirePermission };
