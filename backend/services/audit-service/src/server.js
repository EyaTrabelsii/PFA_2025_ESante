import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import cors from 'cors';
import helmet from 'helmet';
import auditRoutes from './routes/auditRoutes.js';
import { initializeSocket, emitCriticalEvent, emitSecurityAlert } from './socket/socket.js';
import { startAuditConsumer, disconnectConsumer } from './kafka/auditConsumer.js';
import AuditLog from './models/AuditLog.js';

const app = express();
const httpServer = createServer(app);

// Initialize Socket.IO
const io = initializeSocket(httpServer);

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

// API Routes
app.use('/api/v1/audit', auditRoutes);

// Health check endpoint
app.get('/health', async (req, res) => {
  try {
    const [
      totalLogs,
      criticalEvents,
      securityEvents,
      requiresReview
    ] = await Promise.all([
      AuditLog.countDocuments(),
      AuditLog.countDocuments({ severity: 'critical' }),
      AuditLog.countDocuments({ isSecurityRelevant: true }),
      AuditLog.countDocuments({ requiresReview: true }),
    ]);

    res.json({
      success: true,
      message: 'Audit Service is healthy',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        mongodb: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        statistics: {
          totalLogs,
          criticalEvents,
          securityEvents,
          requiresReview,
        },
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

    // Set up change stream for real-time monitoring (requires replica set)
    try {
      const changeStream = AuditLog.watch();
      
      changeStream.on('change', async (change) => {
        if (change.operationType === 'insert') {
          const auditLog = change.fullDocument;
          
          // Emit critical events to admin dashboard
          if (auditLog.severity === 'critical') {
            emitCriticalEvent(auditLog);
          }
          
          // Emit security alerts
          if (auditLog.isSecurityRelevant && (auditLog.severity === 'warning' || auditLog.severity === 'critical')) {
            emitSecurityAlert(auditLog);
          }
        }
      });

      // Handle change stream errors
      changeStream.on('error', (error) => {
        console.log('⚠️  Change stream error:', error.message);
        console.log('⚠️  Running without real-time monitoring - audit logs will still be saved');
      });

      console.log('✅ MongoDB change stream initialized for real-time monitoring');
    } catch (changeStreamError) {
      console.log('⚠️  Change streams not available (requires MongoDB replica set)');
      console.log('⚠️  Running without real-time monitoring - audit logs will still be saved');
    }
  } catch (error) {
    console.error('❌ MongoDB connection error:', error);
    process.exit(1);
  }
};

// Start server
const PORT = process.env.PORT || 3008;

const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB(process.env.MONGODB_URI);

    // Start Kafka consumer
    await startAuditConsumer();

    // Start HTTP server
    httpServer.listen(PORT, () => {
      console.log(`✅ Audit Service running on port ${PORT}`);
      console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log(`📊 Real-time monitoring enabled via Socket.IO`);
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
