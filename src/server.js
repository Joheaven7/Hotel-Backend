const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
require('dotenv').config();
const app = express();


const connectDB = require('./config/database');
const cookieParser = require('cookie-parser');
const { connectRedis } = require('./config/redis');
const { initializeSocket } = require('./sockets/socketHandler');
const passport = require('./config/passport'); // Path to your file

// Import routes
const authRoutes = require('./modules/auth/auth.routes');
const userRoutes = require('./modules/users/user.routes');
const roomRoutes = require('./modules/rooms/room.routes');
const hallRoutes = require('./modules/halls/hall.routes');
const reservationRoutes = require('./modules/reservations/reservation.routes');
const paymentRoutes = require('./modules/payments/payment.routes');
const payrollRoutes = require('./modules/payroll/payroll.routes');
const maintenanceRoutes = require('./modules/maintenance/maintenance.routes');
const dashboardRoutes = require('./modules/dashboards/dashboard.routes');

const server = http.createServer(app);

const io = new socketIo.Server(server, {
  cors: {
    origin: [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'https://n8vmx2pc-3001.inc1.devtunnels.ms'
    ].filter(Boolean),
    credentials: true,
    methods: ['GET', 'POST'],
  },
  transports: ['websocket', 'polling'],
});

const corsOptions = {
  origin: function (origin, callback) {
    const allowed = [
      process.env.CLIENT_URL,
      'http://localhost:5173',
      'http://localhost:3000',
      'https://n8vmx2pc-3001.inc1.devtunnels.ms'
    ].filter(Boolean);

    // Allow requests with no origin (mobile apps, Postman, server-to-server)
    if (!origin || allowed.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error(`CORS blocked: ${origin}`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};


app.use(helmet());
app.use(compression());
app.use(cors(corsOptions));

app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(passport.initialize());



app.use((req, res, next) => {
  req.io = io;
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ message: 'Server is running' });
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/rooms', roomRoutes);
app.use('/api/halls', hallRoutes);
app.use('/api/reservations', reservationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/payroll', payrollRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/dashboards', dashboardRoutes);
app.use('/api/auditlogs', require('./modules/auditlogs/auditlog.routes'));
app.use('/api/complaints', require('./modules/complaints/complaint.routes'));
app.use('/api/notifications', require('./modules/notifications/notification.routes'));
// Public cached routes
const cacheControl = (req, res, next) => {
  res.set('Cache-Control', 'public, max-age=300'); // 5 minute cache
  next();
};

app.use('/api/room-types/public', cacheControl, require('./modules/roomtypes/roomtype.routes'));
app.use('/api/hall-types/public', cacheControl, require('./modules/halltypes/halltype.routes'));

// General routes
app.use('/api/room-types', require('./modules/roomtypes/roomtype.routes'));
app.use('/api/hall-types', require('./modules/halltypes/halltype.routes'));
app.use('/api/upload', require('./modules/upload/upload.routes'));
app.use('/api/chat', require('./modules/chat/chat.routes'));
app.use('/api/invoices', require('./modules/invoices/invoice.routes'));



app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const startServer = async () => {
  try {
    await connectDB();

    try {
      const redisClient = await Promise.race([
        connectRedis(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('Redis timeout')), 3000))
      ]);
      if (redisClient) {
        console.log('Redis connected');
      }
    } catch (err) {
      console.warn('⚠️ Redis failed or timed out, continuing without it');
    }

    initializeSocket(io);


    const { initCronJobs } = require('./services/cronService');
    initCronJobs(io);

    const PORT = process.env.PORT || 8000;

    server.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;