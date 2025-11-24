import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import { connectDB } from '../../../shared/index.js';
import { connectProducer } from '../../../shared/kafka/producer.js';
import { initializeSocketIO } from './socket/socketHandlers.js';
import messageRoutes from './routes/messageRoutes.js';

// Load environment variables
dotenv.config();

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = new Server(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    methods: ['GET', 'POST'],
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Initialize Socket.IO handlers and get onlineUsers map
const onlineUsers = initializeSocketIO(io);

// Store io and onlineUsers in app for access in controllers
app.set('io', io);
app.set('onlineUsers', onlineUsers);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logger
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'Messaging Service',
    status: 'healthy',
    timestamp: new Date().toISOString(),
    onlineUsers: onlineUsers.size,
  });
});

// Routes
app.use('/api/v1/messages', messageRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);

  // Multer file upload errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      message: 'File size exceeds the maximum allowed limit',
    });
  }

  if (err.name === 'MulterError') {
    return res.status(400).json({
      message: `File upload error: ${err.message}`,
    });
  }

  res.status(err.status || 500).json({
    message: err.message || 'Internal server error',
  });
});

// Start server
const PORT = process.env.PORT || 3006;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');

    // Connect Kafka producer
    await connectProducer();
    console.log('✅ Kafka producer connected');

    // Start HTTP server with Socket.IO
    httpServer.listen(PORT, () => {
      console.log(`✅ Messaging Service running on port ${PORT}`);
      console.log(`✅ Socket.IO server ready`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async (signal) => {
  console.log(`\n${signal} received. Starting graceful shutdown...`);

  try {
    // Close HTTP server
    httpServer.close(() => {
      console.log('✅ HTTP server closed');
    });

    // Disconnect all Socket.IO clients
    io.close(() => {
      console.log('✅ Socket.IO server closed');
    });

    // Disconnect from MongoDB
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');

    // Disconnect Kafka producer
    const { disconnectProducer } = await import('../../shared/kafka/producer.js');
    await disconnectProducer();
    console.log('✅ Kafka producer disconnected');

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

// Listen for termination signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

// Start the server
startServer();
