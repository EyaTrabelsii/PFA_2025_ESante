import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { connectDB, errorHandler, requestLogger } from '../../../shared/index.js';
import userRoutes from './routes/userRoutes.js';
import { initializeConsumer } from './consumers/userConsumer.js';

const app = express();
const PORT = process.env.PORT || 3002;

// Connect to MongoDB
connectDB(process.env.MONGODB_URI);

// Initialize Kafka consumer
initializeConsumer().catch(error => {
  console.error('Failed to initialize Kafka consumer:', error);
});

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'User Service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/v1/users', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: 'Route not found'
  });
});

// Error handling
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   👥 USER SERVICE STARTED 👥          ║
║   Port: ${PORT}                       ║
║   Environment: ${process.env.NODE_ENV} ║
╚════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully...');
  process.exit(0);
});
