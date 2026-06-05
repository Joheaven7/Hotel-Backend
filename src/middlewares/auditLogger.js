const AuditLog = require('../models/AuditLog');

// Middleware — attach to routes automatically
const auditLogger = (actionType) => {
  return async (req, res, next) => {
    res.on('finish', async () => {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        try {
          const userId = req.user?._id;
          if (!userId) return;

          // Capture user details at time of action
          const userName = `${req.user?.firstName || ''} ${req.user?.lastName || ''}`.trim() || 'Unknown';
          const userEmail = req.user?.email || '';
          const userRole = req.user?.role || '';

          const resource  = req.baseUrl || req.originalUrl;
          const targetId  = req.params?.id || req.params?.userId || req.params?.reservationId || null;

          const sanitizedBody = { ...req.body };
          if (sanitizedBody.password) sanitizedBody.password = '***';
          if (sanitizedBody.refreshToken) sanitizedBody.refreshToken = '***';
          if (sanitizedBody.email) sanitizedBody.email = sanitizedBody.email;

          const details = {
            method: req.method,
            params: req.params,
            query: req.query,
            requestPayload: sanitizedBody,
          };

          const beforeState = req.auditContext?.beforeState || null;
          const afterState = req.auditContext?.afterState || null;

          const ipAddress = req.ip || req.headers['x-forwarded-for'] || req.socket?.remoteAddress;
          const userAgent = req.headers['user-agent'] || '';

          await AuditLog.create({ 
            userId, 
            userName, 
            userEmail, 
            userRole,
            actionType, 
            resource, 
            targetId, 
            details, 
            beforeState,
            afterState,
            ipAddress, 
            userAgent 
          });
        } catch (error) {
          console.error('Audit Log Error:', error.message);
        }
      }
    });
    next();
  };
};

// Manual helper — call directly from controllers (e.g. on login)
const logAudit = async ({ userId, user, actionType, resource, targetId = null, details = {}, req = null, beforeState = null, afterState = null }) => {
  try {
    // Use provided user object or extract from request
    const userName = user?.firstName 
      ? `${user.firstName || ''} ${user.lastName || ''}`.trim() 
      : req?.user?.firstName
        ? `${req.user.firstName || ''} ${req.user.lastName || ''}`.trim()
        : 'Unknown';
    const userEmail = user?.email || req?.user?.email || '';
    const userRole = user?.role || req?.user?.role || '';

    const ipAddress = req ? (req.ip || req.headers?.['x-forwarded-for'] || req.socket?.remoteAddress) : null;
    const userAgent = req ? (req.headers?.['user-agent'] || '') : '';
    
    await AuditLog.create({ 
      userId, 
      userName, 
      userEmail, 
      userRole,
      actionType, 
      resource, 
      targetId, 
      details, 
      beforeState,
      afterState,
      ipAddress, 
      userAgent 
    });
  } catch (error) {
    console.error('logAudit Error:', error.message);
  }
};

module.exports = { auditLogger, logAudit };