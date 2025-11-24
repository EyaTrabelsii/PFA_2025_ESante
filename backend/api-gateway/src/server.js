import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { createProxyMiddleware } from 'http-proxy-middleware';
import services from './config/services.js';
import { authenticateToken, requireAdmin } from './middleware/auth.js';
import { generalLimiter, authLimiter } from './middleware/rateLimiter.js';
import requestLogger from './middleware/logger.js';
import healthRoutes from './routes/health.js';

const app = express();
const PORT = process.env.PORT || 3000;

// ==================== Security & Middleware ====================

// Helmet for security headers
app.use(helmet());

// CORS configuration
app.use(cors({
  origin: [
    process.env.FRONTEND_URL || 'http://localhost:3000',
    process.env.ADMIN_URL || 'http://localhost:3001',
    process.env.MOBILE_APP_SCHEME || 'esante://'
  ],
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use(requestLogger);

// General rate limiting
app.use(generalLimiter);

// ==================== Health Routes ====================

app.use(healthRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    success: true,
    message: 'E-Santé API Gateway',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

// ==================== Service Proxies ====================

/**
 * Setup proxy for each microservice
 */
Object.entries(services).forEach(([name, config]) => {
  const middleware = [];

  // Apply auth limiter for auth service
  if (name === 'auth') {
    middleware.push(authLimiter);
  }

  // Apply authentication if service is not public
  if (!config.public) {
    middleware.push(authenticateToken);
  }

  // Apply admin-only restriction
  if (config.adminOnly) {
    middleware.push(requireAdmin);
  }

  // Create proxy middleware
  const proxyMiddleware = createProxyMiddleware({
    target: config.url,
    changeOrigin: true,
    pathRewrite: {
      [`^${config.path}`]: ''
    },
    onProxyReq: (proxyReq, req, res) => {
      // Forward user info to downstream services
      if (req.user) {
        proxyReq.setHeader('x-user-id', req.user.id);
        proxyReq.setHeader('x-user-email', req.user.email);
        proxyReq.setHeader('x-user-role', req.user.role);
      }
      console.log(`📡 Proxying ${req.method} ${req.url} → ${config.url}`);
    },
    onProxyRes: (proxyRes, req, res) => {
      console.log(`✅ Response from ${name}: ${proxyRes.statusCode}`);
    },
    onError: (err, req, res) => {
      console.error(`❌ Proxy error for ${name}:`, err.message);
      res.status(503).json({
        message: `Service ${name} temporarily unavailable`,
        error: process.env.NODE_ENV === 'development' ? err.message : undefined
      });
    }
  });

  middleware.push(proxyMiddleware);

  app.use(config.path, ...middleware);
  console.log(`✅ Registered route: ${config.path} → ${config.url}`);
});

// ==================== Error Handling ====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Gateway Error:', err);

  res.status(err.statusCode || 500).json({
    message: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ==================== Start Server ====================

app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════════════╗
║                                                          ║
║          🏥 E-SANTÉ API GATEWAY STARTED 🏥              ║
║                                                          ║
║  Port:        ${PORT}                                    ║
║  Environment: ${process.env.NODE_ENV}                   ║
║  Health:      http://localhost:${PORT}/health           ║
║  Services:    http://localhost:${PORT}/health/services  ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
  `);

  console.log('\n📋 Registered Services:\n');
  Object.entries(services).forEach(([name, config]) => {
    console.log(`   ${name.padEnd(15)} → ${config.path.padEnd(30)} → ${config.url}`);
  });
  console.log('\n');
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('👋 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('👋 SIGINT received, shutting down gracefully...');
  process.exit(0);
});
