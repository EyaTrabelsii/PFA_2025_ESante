# PROMPT 1D: API Gateway Setup

## Objective
Create the API Gateway that serves as the central entry point for all microservices. Configure routing, authentication, rate limiting, and health monitoring.

## Prerequisites
✅ PROMPT 1A completed (Folder structure and MongoDB setup)
✅ PROMPT 1B completed (Shared middleware and utilities)
✅ PROMPT 1C completed (Kafka infrastructure)

## Requirements

### 1. API Gateway Package.json

Create `backend/api-gateway/package.json`:

```json
{
  "name": "esante-api-gateway",
  "version": "1.0.0",
  "description": "API Gateway for E-Santé microservices",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "dotenv": "^16.3.1",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "express-rate-limit": "^7.1.5",
    "http-proxy-middleware": "^2.0.6",
    "redis": "^4.6.11",
    "rate-limit-redis": "^4.2.0",
    "morgan": "^1.10.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### 2. API Gateway Environment Variables

Create `backend/api-gateway/.env`:

```env
# API Gateway Configuration
NODE_ENV=development
PORT=3000
SERVICE_NAME=api-gateway

# Service URLs
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
RDV_SERVICE_URL=http://localhost:3003
MEDICAL_SERVICE_URL=http://localhost:3004
REFERRAL_SERVICE_URL=http://localhost:3005
MESSAGING_SERVICE_URL=http://localhost:3006
NOTIFICATION_SERVICE_URL=http://localhost:3007
AUDIT_SERVICE_URL=http://localhost:3008

# JWT Secret (must match auth service)
JWT_SECRET=your_super_secret_jwt_key_change_in_production

# Redis (for rate limiting)
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# CORS
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
MOBILE_APP_SCHEME=esante://

# Logging
LOG_LEVEL=info
```

### 3. Service Configuration

Create `backend/api-gateway/src/config/services.js`:

```javascript
/**
 * Microservices Configuration
 */

const services = {
  auth: {
    url: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
    path: '/api/v1/auth',
    public: true // No authentication required
  },
  users: {
    url: process.env.USER_SERVICE_URL || 'http://localhost:3002',
    path: '/api/v1/users',
    public: false // Authentication required
  },
  appointments: {
    url: process.env.RDV_SERVICE_URL || 'http://localhost:3003',
    path: '/api/v1/appointments',
    public: false
  },
  medical: {
    url: process.env.MEDICAL_SERVICE_URL || 'http://localhost:3004',
    path: '/api/v1/medical',
    public: false
  },
  referrals: {
    url: process.env.REFERRAL_SERVICE_URL || 'http://localhost:3005',
    path: '/api/v1/referrals',
    public: false
  },
  messages: {
    url: process.env.MESSAGING_SERVICE_URL || 'http://localhost:3006',
    path: '/api/v1/messages',
    public: false
  },
  notifications: {
    url: process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3007',
    path: '/api/v1/notifications',
    public: false
  },
  audit: {
    url: process.env.AUDIT_SERVICE_URL || 'http://localhost:3008',
    path: '/api/v1/audit',
    public: false,
    adminOnly: true // Only admin can access
  }
};

module.exports = services;
```

### 4. Authentication Middleware for Gateway

Create `backend/api-gateway/src/middleware/auth.js`:

```javascript
const jwt = require('jsonwebtoken');

/**
 * Authenticate JWT token
 */
const authenticateToken = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      // Attach user to request header for downstream services
      req.headers['x-user-id'] = decoded.id;
      req.headers['x-user-email'] = decoded.email;
      req.headers['x-user-role'] = decoded.role;

      req.user = {
        id: decoded.id,
        email: decoded.email,
        role: decoded.role
      };

      next();
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: 'Authentication error'
    });
  }
};

/**
 * Check if user is admin
 */
const requireAdmin = (req, res, next) => {
  if (!req.user || req.user.role !== 'admin') {
    return res.status(403).json({
      success: false,
      message: 'Admin access required'
    });
  }
  next();
};

module.exports = {
  authenticateToken,
  requireAdmin
};
```

### 5. Rate Limiting Middleware

Create `backend/api-gateway/src/middleware/rateLimiter.js`:

```javascript
const rateLimit = require('express-rate-limit');
const RedisStore = require('rate-limit-redis');
const redis = require('redis');

/**
 * Create Redis client for rate limiting
 */
const createRedisClient = () => {
  const client = redis.createClient({
    socket: {
      host: process.env.REDIS_HOST || 'localhost',
      port: process.env.REDIS_PORT || 6379
    },
    password: process.env.REDIS_PASSWORD || undefined
  });

  client.on('error', (err) => {
    console.error('❌ Redis Client Error:', err);
  });

  client.on('connect', () => {
    console.log('✅ Redis: Connected for rate limiting');
  });

  return client;
};

/**
 * General rate limiter (100 requests per 15 minutes)
 */
const generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    success: false,
    message: 'Too many requests, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  // Use Redis store for distributed rate limiting
  store: new RedisStore({
    client: createRedisClient(),
    prefix: 'rate_limit:general:'
  })
});

/**
 * Strict rate limiter for auth endpoints (5 requests per 15 minutes)
 */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: 'Too many authentication attempts, please try again later'
  },
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisStore({
    client: createRedisClient(),
    prefix: 'rate_limit:auth:'
  })
});

/**
 * File upload rate limiter (10 requests per hour)
 */
const uploadLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: {
    success: false,
    message: 'Too many file uploads, please try again later'
  },
  store: new RedisStore({
    client: createRedisClient(),
    prefix: 'rate_limit:upload:'
  })
});

module.exports = {
  generalLimiter,
  authLimiter,
  uploadLimiter
};
```

### 6. Request Logger Middleware

Create `backend/api-gateway/src/middleware/logger.js`:

```javascript
const morgan = require('morgan');

/**
 * Custom token for user info
 */
morgan.token('user', (req) => {
  return req.user ? `${req.user.id} (${req.user.role})` : 'anonymous';
});

/**
 * Custom logging format
 */
const logFormat = ':method :url :status :response-time ms - :user - :date[iso]';

/**
 * Request logger
 */
const requestLogger = morgan(logFormat, {
  skip: (req, res) => {
    // Skip health check and root endpoints
    return req.url === '/health' || req.url === '/' || req.url === '/favicon.ico';
  }
});

module.exports = requestLogger;
```

### 7. Health Check Routes

Create `backend/api-gateway/src/routes/health.js`:

```javascript
const express = require('express');
const axios = require('axios');
const services = require('../config/services');

const router = express.Router();

/**
 * Gateway health check
 */
router.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'API Gateway',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

/**
 * Check all services health
 */
router.get('/health/services', async (req, res) => {
  const servicesHealth = {};

  for (const [name, config] of Object.entries(services)) {
    try {
      const response = await axios.get(`${config.url}/health`, {
        timeout: 5000
      });
      servicesHealth[name] = {
        status: 'healthy',
        url: config.url,
        responseTime: response.headers['x-response-time'] || 'N/A'
      };
    } catch (error) {
      servicesHealth[name] = {
        status: 'unhealthy',
        url: config.url,
        error: error.message
      };
    }
  }

  const allHealthy = Object.values(servicesHealth).every(
    service => service.status === 'healthy'
  );

  res.status(allHealthy ? 200 : 503).json({
    success: allHealthy,
    services: servicesHealth,
    timestamp: new Date().toISOString()
  });
});

module.exports = router;
```

### 8. Main Gateway Server

Create `backend/api-gateway/src/server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { createProxyMiddleware } = require('http-proxy-middleware');
const services = require('./config/services');
const { authenticateToken, requireAdmin } = require('./middleware/auth');
const { generalLimiter, authLimiter } = require('./middleware/rateLimiter');
const requestLogger = require('./middleware/logger');
const healthRoutes = require('./routes/health');

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
        success: false,
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
    success: false,
    message: `Route ${req.originalUrl} not found`
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('❌ Gateway Error:', err);

  res.status(err.statusCode || 500).json({
    success: false,
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
```

### 9. Complete Docker Compose

Create `backend/docker-compose.yml`:

```yaml
version: '3.8'

services:
  # MongoDB
  mongodb:
    image: mongo:6
    container_name: esante-mongodb
    restart: unless-stopped
    ports:
      - "27017:27017"
    environment:
      MONGO_INITDB_ROOT_USERNAME: admin
      MONGO_INITDB_ROOT_PASSWORD: password
    volumes:
      - mongodb_data:/data/db
    networks:
      - esante-network

  # Redis
  redis:
    image: redis:7-alpine
    container_name: esante-redis
    restart: unless-stopped
    ports:
      - "6379:6379"
    networks:
      - esante-network

  # Zookeeper
  zookeeper:
    image: confluentinc/cp-zookeeper:latest
    container_name: esante-zookeeper
    environment:
      ZOOKEEPER_CLIENT_PORT: 2181
      ZOOKEEPER_TICK_TIME: 2000
    ports:
      - "2181:2181"
    networks:
      - esante-network

  # Kafka
  kafka:
    image: confluentinc/cp-kafka:latest
    container_name: esante-kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
    networks:
      - esante-network

  # Kafka UI
  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: esante-kafka-ui
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: esante
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9092
    networks:
      - esante-network

volumes:
  mongodb_data:

networks:
  esante-network:
    driver: bridge
```

### 10. Start Script

Create `backend/start-dev.sh`:

```bash
#!/bin/bash

echo "🚀 Starting E-Santé Backend Services..."

# Start Docker services
echo "📦 Starting Docker containers..."
docker-compose up -d

# Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 10

# Start API Gateway
echo "🌐 Starting API Gateway..."
cd api-gateway && npm run dev &

# Start microservices
echo "🔐 Starting Auth Service..."
cd services/auth-service && npm run dev &

echo "👤 Starting User Service..."
cd services/user-service && npm run dev &

echo "📅 Starting Appointment Service..."
cd services/rdv-service && npm run dev &

echo "🏥 Starting Medical Records Service..."
cd services/medical-records-service && npm run dev &

echo "🔄 Starting Referral Service..."
cd services/referral-service && npm run dev &

echo "💬 Starting Messaging Service..."
cd services/messaging-service && npm run dev &

echo "🔔 Starting Notification Service..."
cd services/notification-service && npm run dev &

echo "📊 Starting Audit Service..."
cd services/audit-service && npm run dev &

echo "✅ All services started!"
echo "🌐 API Gateway: http://localhost:3000"
echo "📊 Kafka UI: http://localhost:8080"
```

## Testing Checklist

After completing this prompt, verify:

- [ ] `backend/api-gateway/package.json` exists
- [ ] `backend/api-gateway/src/server.js` exists and configured
- [ ] `backend/api-gateway/src/config/services.js` defines all 8 services
- [ ] `backend/api-gateway/src/middleware/auth.js` exists
- [ ] `backend/api-gateway/src/middleware/rateLimiter.js` exists with Redis
- [ ] `backend/api-gateway/src/middleware/logger.js` exists
- [ ] `backend/api-gateway/src/routes/health.js` exists
- [ ] `backend/api-gateway/.env` exists
- [ ] `backend/docker-compose.yml` includes all infrastructure services
- [ ] Can start gateway with: `cd api-gateway && npm install && npm run dev`
- [ ] Can access gateway at http://localhost:3000
- [ ] Health check works at http://localhost:3000/health
- [ ] Can start all infrastructure with: `docker-compose up -d`

## Deliverables

1. ✅ API Gateway Express server with proxy middleware
2. ✅ Service configuration for all 8 microservices
3. ✅ Authentication middleware (JWT verification)
4. ✅ Rate limiting with Redis (general, auth, upload)
5. ✅ Request logging with Morgan
6. ✅ Health check endpoints (gateway + services)
7. ✅ Complete Docker Compose (MongoDB, Redis, Kafka)
8. ✅ CORS and security configuration
9. ✅ Error handling and 404 handler
10. ✅ Start scripts for development

## Time Estimate
⏱️ **2-3 hours**

---

**🎉 INFRASTRUCTURE COMPLETE!**

**Next Steps:** 
1. All infrastructure is now in place
2. Proceed to PROMPT_2A (Auth Service - Core Authentication)

