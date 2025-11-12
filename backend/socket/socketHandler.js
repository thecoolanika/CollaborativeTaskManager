const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { Server } = require('socket.io');
const { createAdapter } = require('@socket.io/redis-adapter');
const { createClient } = require('redis');

let io;

const initializeSocket = async (server) => {
  // Create Socket.IO server with Redis adapter for horizontal scaling
  io = new Server(server, {
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Redis adapter for scaling across multiple servers
  try {
    const redisUrl = process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`;
    const pubClient = createClient({ url: redisUrl });
    const subClient = pubClient.duplicate();

    await Promise.all([pubClient.connect(), subClient.connect()]);

    io.adapter(createAdapter(pubClient, subClient));
    console.log('Socket.IO Redis adapter connected');
  } catch (error) {
    console.error('Redis adapter error (continuing without it):', error.message);
  }

  // Authentication middleware for Socket.IO
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];
      
      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id).select('-password');
      
      if (!user) {
        return next(new Error('Authentication error: User not found'));
      }

      socket.userId = user._id.toString();
      socket.user = {
        id: user._id,
        email: user.email,
        name: user.name,
      };
      
      next();
    } catch (error) {
      next(new Error('Authentication error: Invalid token'));
    }
  });

  // Connection handling
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.user.email} (${socket.id})`);

    // Join user to their personal room
    socket.join(`user:${socket.userId}`);

    // Join task rooms for real-time updates
    socket.on('join_task', (taskId) => {
      socket.join(`task:${taskId}`);
      console.log(`User ${socket.user.email} joined task: ${taskId}`);
    });

    socket.on('leave_task', (taskId) => {
      socket.leave(`task:${taskId}`);
      console.log(`User ${socket.user.email} left task: ${taskId}`);
    });

    // Handle task updates via WebSocket (optional)
    socket.on('task_update', async (data) => {
      // Emit to all users in the task room
      io.to(`task:${data.taskId}`).emit('task_updated', data);
    });

    // Handle typing indicators (optional)
    socket.on('typing_start', (taskId) => {
      socket.to(`task:${taskId}`).emit('user_typing', {
        userId: socket.userId,
        userName: socket.user.name,
      });
    });

    socket.on('typing_stop', (taskId) => {
      socket.to(`task:${taskId}`).emit('user_stopped_typing', {
        userId: socket.userId,
      });
    });

    // Disconnect handling
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.user?.email} (${socket.id})`);
    });

    // Error handling
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  return io;
};

const getIO = () => {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
};

module.exports = { initializeSocket, getIO };

