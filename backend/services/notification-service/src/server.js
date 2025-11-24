import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import notificationRoutes from './routes/notificationRoutes.js';
import { initializeSocket } from './socket/socket.js';
import { setSocketIO } from './services/notificationService.js';
import { startNotificationConsumer, disconnectConsumer } from './kafka/notificationConsumer.js';
import { startScheduledNotificationJob } from './jobs/scheduledNotificationJob.js';
import Notification from './models/Notification.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(httpServer);
setSocketIO(io);

// Middleware
app.use(helmet());
app.use(
  cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  })
);
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/v1/notifications', notificationRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const unreadCount = await Notification.countDocuments({ isRead: false });
    res.json({
      success: true,
      message: 'Notification Service is healthy',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        unreadNotifications: unreadCount,
      },
    });
  } catch (error) {
    res.status(503).json({
      success: false,
      message: 'Service unhealthy',
      error: error.message,
    });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// MongoDB connection
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 3007;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB(process.env.MONGODB_URI);

    // Start Kafka consumer
    await startNotificationConsumer();

    // Start scheduled notification job
    startScheduledNotificationJob();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`✅ Notification Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
    });
  } catch (error) {
    console.error('❌ Error starting server:', error);
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

    // Disconnect Kafka consumer
    await disconnectConsumer();

    // Close Socket.IO connections
    io.close(() => {
      console.log('✅ Socket.IO connections closed');
    });

    // Close MongoDB connection
    await mongoose.connection.close();
    console.log('✅ MongoDB connection closed');

    console.log('✅ Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during graceful shutdown:', error);
    process.exit(1);
  }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Start the server
startServer();
