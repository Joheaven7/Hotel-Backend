const { ROLES } = require('../config/constants');

const initializeSocket = (io) => {
  // Redis adapter integration
  const { createAdapter } = require('@socket.io/redis-adapter');
  const { getRedisClient, isRedisAvailable } = require('../config/redis');

  if (isRedisAvailable()) {
    const redisClient = getRedisClient();
    if (redisClient) {
      const pubClient = redisClient.duplicate();
      const subClient = redisClient.duplicate();

      pubClient.on('error', (err) => {
        console.log('⚠️  Redis pubClient connection error:', err.message || err.code || err);
      });

      subClient.on('error', (err) => {
        console.log('⚠️  Redis subClient connection error:', err.message || err.code || err);
      });

      Promise.all([pubClient.connect(), subClient.connect()]).then(() => {
        io.adapter(createAdapter(pubClient, subClient));
        console.log('✅ Socket.io Redis adapter initialized');
      }).catch(err => {
        console.error('⚠️ Redis adapter failed:', err.message);
      });
    }
  }

  // Middleware for socket authentication
  io.use(async (socket, next) => {
    const token = socket.handshake.auth?.token;
    const roomToken = socket.handshake.auth?.roomToken || socket.handshake.query?.token || socket.handshake.query?.roomToken;

    if (roomToken) {
      try {
        const Room = require('../models/Room');
        const room = await Room.findOne({ qrToken: roomToken });
        if (room) {
          socket.isGuest = true;
          socket.roomToken = roomToken;
          socket.roomId = room._id;
          return next();
        }
      } catch (err) {}
    }

    if (!token) {
      // Allow guest socket connection for QR Menu tracking & support ticket chat
      socket.isGuest = true;
      return next();
    }

    try {
      if (!process.env.JWT_SECRET) {
        return next(new Error('JWT_SECRET environment variable is missing on server'));
      }
      const jwt = require('jsonwebtoken');
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.id;  // JWT payload stores 'id', not 'userId'
      socket.userRole = decoded.role;
      socket.userEmail = decoded.email;
      next();
    } catch (error) {
      // Fallback guest mode instead of throwing connection error
      socket.isGuest = true;
      next();
    }
  });

  io.on('connection', async (socket) => {
    if (socket.isGuest) {
      if (socket.roomToken) {
        socket.join(`room_${socket.roomToken}`);
      }

      socket.on('subscribe:room', (roomToken) => {
        if (roomToken) socket.join(`room_${roomToken}`);
      });

      socket.on('subscribe:ticket', (ticketNumber) => {
        if (ticketNumber) socket.join(`ticket_${ticketNumber}`);
      });

      socket.on('disconnect', () => {});
      return;
    }

    console.log(`User connected: ${socket.userId} (${socket.userRole})`);

    let user = null;
    try {
      const User = require('../models/User');
      user = await User.findById(socket.userId);
    } catch (err) {
      console.error('Socket user fetch error:', err.message);
    }

    // Join role-specific room for targeted updates
    socket.join(`role:${socket.userRole}`);
    
    // Join user-specific room
    socket.join(`user:${socket.userId}`);

    // Dashboard rooms (for real-time dashboard updates)
    socket.join(`dashboard:${socket.userRole}`);

    // Auto-join department room for staff users
    if (user && user.department && socket.userRole !== 'CUSTOMER') {
      socket.join(`dept:${user.department}`);
      console.log(`User ${socket.userId} auto-joined dept:${user.department}`);
    }

    // Chat room management
    socket.on('chat:join', ({ sessionId }) => {
      if (sessionId) {
        socket.join(`chat:${sessionId}`);
      }
    });

    socket.on('chat:leave', ({ sessionId }) => {
      if (sessionId) {
        socket.leave(`chat:${sessionId}`);
      }
    });

    // Manual department join (for staff viewing other departments)
    socket.on('chat:joinDept', ({ department }) => {
      if (department && socket.userRole !== 'CUSTOMER') {
        socket.join(`dept:${department}`);
      }
      if (['SUPER_ADMIN', 'ADMIN', 'ACCOUNTANT', 'MANAGER'].includes(user.role)) socket.join('staff_management');
      if (['SUPER_ADMIN', 'ADMIN', 'RESTAURANT_MANAGER', 'CHEF', 'KITCHEN_STAFF', 'ROOM_SERVICE_STAFF'].includes(user.role)) socket.join('staff_restaurant');
    });

    socket.on('chat:typing', ({ sessionId, isTyping }) => {
      if (sessionId) {
        socket.to(`chat:${sessionId}`).emit('chat:typing', {
          sessionId,
          userId: socket.userId,
          userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() : 'User',
          isTyping,
        });
      }
    });

    // Disconnect handler
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });

    // Custom events - ping/pong for connection check
    socket.on('ping', () => {
      socket.emit('pong');
    });
  });
};

// Emit event based on role
const emitToRole = (io, role, eventName, data) => {
  io.to(`role:${role}`).emit(eventName, data);
};

// Emit to dashboard subscribers of specific role
const emitToDashboard = (io, role, eventName, data) => {
  io.to(`dashboard:${role}`).emit(eventName, data);
};

// Emit to all except lower roles (hierarchy-based)
const emitToRoleHierarchy = (io, minRole, eventName, data) => {
  const { ROLE_HIERARCHY } = require('../config/constants');
  const minHierarchy = ROLE_HIERARCHY[minRole];

  Object.values(ROLES).forEach((role) => {
    if (ROLE_HIERARCHY[role] >= minHierarchy) {
      emitToRole(io, role, eventName, data);
    }
  });
};

// Emit to specific user
const emitToUser = (io, userId, eventName, data) => {
  io.to(`user:${userId}`).emit(eventName, data);
};

// Broadcast to all authenticated users
const broadcastToAll = (io, eventName, data) => {
  io.emit(eventName, data);
};

// Emit to multiple users
const emitToUsers = (io, userIds, eventName, data) => {
  userIds.forEach((userId) => {
    emitToUser(io, userId, eventName, data);
  });
};

// Emit to department room
const emitToDepartment = (io, department, eventName, data) => {
  io.to(`dept:${department}`).emit(eventName, data);
};

module.exports = {
  initializeSocket,
  emitToRole,
  emitToDashboard,
  emitToRoleHierarchy,
  emitToUser,
  emitToUsers,
  emitToDepartment,
  broadcastToAll,
};