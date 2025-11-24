import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import {
  connectDB,
  errorHandler,
  requestLogger,
  kafkaProducer
} from '../../../shared/index.js';
import appointmentRoutes from './routes/appointmentRoutes.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;

// ============================
// MIDDLEWARE
// ============================
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// ============================
// ROUTES
// ============================
app.get('/health', (req, res) => {
  res.status(200).json({
    service: 'RDV Service',
    status: 'UP',
    timestamp: new Date().toISOString()
  });
});

app.use('/api/v1/appointments', appointmentRoutes);

// ============================
// ERROR HANDLING
// ============================
app.use(errorHandler);

// ============================
// SERVER INITIALIZATION
// ============================
const startServer = async () => {
  try {
    // Connect to MongoDB
    await connectDB(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected successfully');

    // Initialize Kafka Producer
    await kafkaProducer.connect();
    console.log('✅ Kafka Producer connected successfully');

    // Start Express server
    app.listen(PORT, () => {
      console.log(`✅ RDV Service running on port ${PORT}`);
    });
  } catch (error) {
    console.error('❌ Failed to start RDV Service:', error);
    process.exit(1);
  }
};

// Graceful shutdown
const gracefulShutdown = async () => {
  console.log('\n🛑 Shutting down RDV Service...');
  try {
    await kafkaProducer.disconnect();
    console.log('✅ Kafka Producer disconnected');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
};

process.on('SIGINT', gracefulShutdown);
process.on('SIGTERM', gracefulShutdown);

startServer();
