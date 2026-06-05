const { ROLE_HIERARCHY } = require('../config/constants');

const roleCheck = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        message: `Access denied. Required roles: ${allowedRoles.join(', ')}`,
      });
    }

    next();
  };
};

const hierarchyCheck = (minRole) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ message: 'Unauthorized' });
    }

    const userHierarchy = ROLE_HIERARCHY[req.user.role];
    const minHierarchy = ROLE_HIERARCHY[minRole];

    if (userHierarchy < minHierarchy) {
      return res.status(403).json({
        message: `Access denied. Minimum role required: ${minRole}`,
      });
    }

    next();
  };
};

module.exports = { roleCheck, hierarchyCheck };