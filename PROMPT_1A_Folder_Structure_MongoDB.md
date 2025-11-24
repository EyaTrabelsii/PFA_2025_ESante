# PROMPT 1A: Folder Structure & MongoDB Setup

## Objective
Create the basic microservices folder structure and setup MongoDB connection utilities. This is the foundation that all other services will build upon.

## Requirements

### 1. Create Microservices Folder Structure

Create the following folder structure in the `backend/` directory:

```
backend/
├── api-gateway/
│   ├── routes/
│   ├── middleware/
│   ├── index.js
│   ├── package.json
│   └── .env
├── services/
│   ├── auth-service/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── utils/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   ├── user-service/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   ├── rdv-service/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   ├── medical-records-service/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   ├── referral-service/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   ├── messaging-service/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   ├── notification-service/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── controllers/
│   │   ├── index.js
│   │   ├── package.json
│   │   └── .env
│   └── audit-service/
│       ├── models/
│       ├── routes/
│       ├── controllers/
│       ├── index.js
│       ├── package.json
│       └── .env
├── shared/
│   ├── utils/
│   │   ├── database.js
│   │   ├── errors.js
│   │   └── response.js
│   ├── middleware/
│   │   ├── auth.js
│   │   ├── errorHandler.js
│   │   └── validation.js
│   ├── config/
│   └── package.json
├── docker-compose.yml
├── package.json
├── .env.example
└── README.md
```

### 2. Root Package.json

Create `backend/package.json`:

```json
{
  "name": "esante-backend",
  "version": "1.0.0",
  "description": "E-Santé Healthcare Platform Backend",
  "private": true,
  "workspaces": [
    "services/*",
    "api-gateway",
    "shared"
  ],
  "scripts": {
    "install-all": "npm install && cd api-gateway && npm install && cd ../services/auth-service && npm install && cd ../user-service && npm install && cd ../rdv-service && npm install && cd ../medical-records-service && npm install && cd ../referral-service && npm install && cd ../messaging-service && npm install && cd ../notification-service && npm install && cd ../audit-service && npm install && cd ../../shared && npm install",
    "dev:auth": "cd services/auth-service && npm run dev",
    "dev:user": "cd services/user-service && npm run dev",
    "dev:rdv": "cd services/rdv-service && npm run dev",
    "dev:medical": "cd services/medical-records-service && npm run dev",
    "dev:referral": "cd services/referral-service && npm run dev",
    "dev:messaging": "cd services/messaging-service && npm run dev",
    "dev:notification": "cd services/notification-service && npm run dev",
    "dev:audit": "cd services/audit-service && npm run dev",
    "dev:gateway": "cd api-gateway && npm run dev"
  },
  "keywords": ["healthcare", "microservices", "esante"],
  "author": "",
  "license": "MIT"
}
```

### 3. Shared Package.json

Create `backend/shared/package.json`:

```json
{
  "name": "@esante/shared",
  "version": "1.0.0",
  "description": "Shared utilities for E-Santé microservices",
  "type": "module",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "mongoose": "^7.6.3",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2"
  },
  "keywords": [],
  "author": "",
  "license": "MIT"
}
```

### 4. MongoDB Connection Helper

Create `backend/shared/utils/database.js`:

```javascript
import mongoose from "mongoose";

/**
 * Connect to MongoDB with retry logic
 * @param {string} uri - MongoDB connection URI
 * @param {number} maxRetries - Maximum retry attempts (default: 5)
 */
export const connectDatabase = async (uri = process.env.MONGODB_URI, maxRetries = 5) => {
  let retries = 0;

  while (retries < maxRetries) {
    try {
      await mongoose.connect(uri, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      });
      console.log("✅ MongoDB connected successfully");
      return;
    } catch (error) {
      retries++;
      console.error(`❌ MongoDB connection attempt ${retries} failed:`, error.message);
      
      if (retries === maxRetries) {
        console.error("Max retries reached. Could not connect to MongoDB.");
        process.exit(1);
      }
      
      // Wait 5 seconds before retrying
      await new Promise((resolve) => setTimeout(resolve, 5000));
    }
  }
};

/**
 * Disconnect from MongoDB gracefully
 */
export const disconnectDatabase = async () => {
  try {
    await mongoose.connection.close();
    console.log("� MongoDB disconnected gracefully");
  } catch (error) {
    console.error("❌ Error disconnecting from MongoDB:", error.message);
  }
};

/**
 * Get database connection status
 */
export const getDatabaseStatus = () => {
  return {
    isConnected: mongoose.connection.readyState === 1,
    readyState: mongoose.connection.readyState,
    host: mongoose.connection.host,
    port: mongoose.connection.port,
    name: mongoose.connection.name,
  };
};
```

### 5. Custom Error Classes

Create `backend/shared/utils/errors.js`:

```javascript
/**
 * Base Application Error
 */
export class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * 400 Bad Request
 */
export class BadRequestError extends AppError {
  constructor(message = "Bad request") {
    super(message, 400);
  }
}

/**
 * 401 Unauthorized
 */
export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

/**
 * 403 Forbidden
 */
export class ForbiddenError extends AppError {
  constructor(message = "Forbidden") {
    super(message, 403);
  }
}

/**
 * 404 Not Found
 */
export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(message, 404);
  }
}

/**
 * 409 Conflict
 */
export class ConflictError extends AppError {
  constructor(message = "Conflict") {
    super(message, 409);
  }
}

/**
 * 422 Validation Error
 */
export class ValidationError extends AppError {
  constructor(message = "Validation failed", errors = []) {
    super(message, 422);
    this.errors = errors;
  }
}
```

### 6. Response Formatter

Create `backend/shared/utils/response.js`:

```javascript
/**
 * Send success response
 * @param {object} res - Express response object
 * @param {any} data - Response data
 * @param {string} message - Success message
 * @param {number} statusCode - HTTP status code (default: 200)
 */
export const sendSuccess = (res, data = null, message = "Success", statusCode = 200) => {
  const response = {
    success: true,
    message,
  };

  if (data !== null) {
    response.data = data;
  }

  res.status(statusCode).json(response);
};

/**
 * Send error response
 * @param {object} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default: 500)
 * @param {array} errors - Validation errors
 */
export const sendError = (res, message = "Error", statusCode = 500, errors = null) => {
  const response = {
    success: false,
    message,
  };

  if (errors) {
    response.errors = errors;
  }

  res.status(statusCode).json(response);
};
```

### 7. Environment Variables Template

Create `backend/.env.example`:

```env
# ==============================================
# E-SANTÉ BACKEND - ENVIRONMENT VARIABLES
# ==============================================

# -------------------- Server --------------------
NODE_ENV=development
PORT=3000

# -------------------- MongoDB --------------------
MONGODB_URI=mongodb://localhost:27017/esante
MONGODB_TEST_URI=mongodb://localhost:27017/esante_test

# -------------------- JWT Authentication --------------------
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_in_production
JWT_REFRESH_EXPIRE=30d

# -------------------- Email (Nodemailer) --------------------
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=noreply@esante.com

# -------------------- AWS S3 --------------------
AWS_ACCESS_KEY_ID=your_aws_access_key_id
AWS_SECRET_ACCESS_KEY=your_aws_secret_access_key
AWS_REGION=us-east-1
AWS_S3_BUCKET=esante-medical-documents

# -------------------- OneSignal --------------------
ONESIGNAL_APP_ID=your_onesignal_app_id
ONESIGNAL_REST_API_KEY=your_onesignal_rest_api_key

# -------------------- Kafka --------------------
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=esante-backend

# -------------------- Google Maps API --------------------
GOOGLE_MAPS_API_KEY=your_google_maps_api_key

# -------------------- Redis --------------------
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# -------------------- Frontend URLs --------------------
FRONTEND_URL=http://localhost:3000
ADMIN_URL=http://localhost:3001
MOBILE_APP_SCHEME=esante://

# -------------------- Service Ports --------------------
AUTH_SERVICE_PORT=3001
USER_SERVICE_PORT=3002
RDV_SERVICE_PORT=3003
MEDICAL_SERVICE_PORT=3004
REFERRAL_SERVICE_PORT=3005
MESSAGING_SERVICE_PORT=3006
NOTIFICATION_SERVICE_PORT=3007
AUDIT_SERVICE_PORT=3008
API_GATEWAY_PORT=3000

# -------------------- Service URLs (for Gateway) --------------------
AUTH_SERVICE_URL=http://localhost:3001
USER_SERVICE_URL=http://localhost:3002
RDV_SERVICE_URL=http://localhost:3003
MEDICAL_SERVICE_URL=http://localhost:3004
REFERRAL_SERVICE_URL=http://localhost:3005
MESSAGING_SERVICE_URL=http://localhost:3006
NOTIFICATION_SERVICE_URL=http://localhost:3007
AUDIT_SERVICE_URL=http://localhost:3008

# -------------------- Rate Limiting --------------------
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100

# -------------------- Logging --------------------
LOG_LEVEL=info
```

### 8. Basic README

Create `backend/README.md`:

```markdown
# E-Santé Backend - Microservices Architecture

Professional healthcare platform backend with microservices architecture.

## 🏗️ Architecture

The backend is split into 8 independent microservices:

1. **Auth Service** (Port 3001) - Authentication & Authorization
2. **User Service** (Port 3002) - Patient & Doctor Management
3. **RDV Service** (Port 3003) - Appointment Scheduling
4. **Medical Records Service** (Port 3004) - Consultations, Prescriptions, Documents
5. **Referral Service** (Port 3005) - Doctor-to-Doctor Referrals
6. **Messaging Service** (Port 3006) - Real-time Communication
7. **Notification Service** (Port 3007) - Multi-channel Notifications
8. **Audit Service** (Port 3008) - Activity Logging

All services communicate through:
- **API Gateway** (Port 3000) - Central entry point
- **Apache Kafka** - Event-driven messaging
- **MongoDB** - Database per service pattern

## 🚀 Getting Started

### Prerequisites

- Node.js v18+
- MongoDB v6+
- Apache Kafka (optional for local dev)
- Redis (for rate limiting)

### Installation

1. Clone the repository
2. Copy `.env.example` to `.env` and configure
3. Install dependencies:

```bash
npm run install-all
```

### Running Services

Each service can be run independently:

```bash
# Run Auth Service
npm run dev:auth

# Run User Service
npm run dev:user

# Run API Gateway
npm run dev:gateway
```

### Database Setup

MongoDB will auto-create databases on first connection. No manual setup needed.

## 📁 Project Structure

```
backend/
├── api-gateway/          # API Gateway (Port 3000)
├── services/             # Microservices
│   ├── auth-service/     # Authentication
│   ├── user-service/     # User Management
│   ├── rdv-service/      # Appointments
│   ├── medical-records-service/  # Medical Data
│   ├── referral-service/ # Referrals
│   ├── messaging-service/# Messaging
│   ├── notification-service/  # Notifications
│   └── audit-service/    # Audit Logs
├── shared/               # Shared utilities
└── docker-compose.yml    # Container orchestration
```

## 🔧 Technology Stack

- **Runtime**: Node.js + Express.js
- **Database**: MongoDB + Mongoose
- **Message Broker**: Apache Kafka
- **Cache**: Redis
- **Storage**: AWS S3
- **Real-time**: Socket.IO
- **Notifications**: OneSignal + Nodemailer

## 📝 Next Steps

After completing this setup:
1. Proceed to PROMPT 1B (Shared Middleware)
2. Then PROMPT 1C (Kafka Infrastructure)
3. Then PROMPT 1D (API Gateway)
4. Finally start with PROMPT 2 (Auth Service)
```

## Testing Checklist

After completing this prompt, verify:

- [ ] All folders created correctly
- [ ] `backend/package.json` exists with workspaces
- [ ] `backend/shared/package.json` exists with "type": "module"
- [ ] `backend/shared/utils/database.js` exists (MongoDB connection)
- [ ] `backend/shared/utils/errors.js` exists (custom error classes)
- [ ] `backend/shared/utils/response.js` exists (response formatter)
- [ ] `.env.example` exists with all required variables
- [ ] `README.md` exists with setup instructions
- [ ] Can run `npm install` in shared folder without errors

## Deliverables

1. ✅ Complete folder structure (8 services + gateway + shared)
2. ✅ Root package.json with workspace configuration
3. ✅ Shared package.json with mongoose dependency (ES6 modules)
4. ✅ MongoDB connection helper with retry logic (`utils/database.js`)
5. ✅ Custom error classes for consistent error handling (`utils/errors.js`)
6. ✅ Response formatter for consistent API responses (`utils/response.js`)
7. ✅ Environment variables template (.env.example)
8. ✅ Basic README with project overview

## Time Estimate
⏱️ **1-2 hours**

---

**Next:** Proceed to PROMPT 1B (Shared Middleware & Utilities)
