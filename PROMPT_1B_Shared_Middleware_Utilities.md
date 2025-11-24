# PROMPT 1B: Shared Middleware & Utilities

## Objective
Create reusable middleware and utility functions that will be used across all microservices. This includes authentication, error handling, validation, and common helper functions.

## Prerequisites
✅ PROMPT 1A completed (Folder structure and MongoDB setup)

## Requirements

### 1. Authentication Middleware

Create `backend/shared/middleware/auth.js`:

```javascript
const jwt = require('jsonwebtoken');

/**
 * Verify JWT token and attach user to request
 */
const authenticateToken = (req, res, next) => {
  try {
    // Get token from header
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Access token required'
      });
    }

    // Verify token
    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        return res.status(403).json({
          success: false,
          message: 'Invalid or expired token'
        });
      }

      // Attach user info to request
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
      message: 'Authentication error',
      error: error.message
    });
  }
};

/**
 * Check if user has required role
 */
const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. Required roles: ${roles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Optional authentication - doesn't fail if no token
 */
const optionalAuth = (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
      req.user = null;
      return next();
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
      if (err) {
        req.user = null;
      } else {
        req.user = {
          id: decoded.id,
          email: decoded.email,
          role: decoded.role
        };
      }
      next();
    });
  } catch (error) {
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth
};
```

### 2. Error Handling Middleware

Create `backend/shared/middleware/errorHandler.js`:

```javascript
/**
 * Custom Error Classes
 */
class AppError extends Error {
  constructor(message, statusCode) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

class ValidationError extends AppError {
  constructor(message) {
    super(message, 400);
    this.name = 'ValidationError';
  }
}

class UnauthorizedError extends AppError {
  constructor(message = 'Unauthorized access') {
    super(message, 401);
    this.name = 'UnauthorizedError';
  }
}

class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403);
    this.name = 'ForbiddenError';
  }
}

class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404);
    this.name = 'NotFoundError';
  }
}

class ConflictError extends AppError {
  constructor(message) {
    super(message, 409);
    this.name = 'ConflictError';
  }
}

/**
 * Global Error Handler Middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = { ...err };
  error.message = err.message;
  error.statusCode = err.statusCode || 500;

  // Log error for debugging
  console.error('Error:', {
    message: error.message,
    statusCode: error.statusCode,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method
  });

  // Mongoose duplicate key error
  if (err.code === 11000) {
    const field = Object.keys(err.keyValue)[0];
    error.message = `${field} already exists`;
    error.statusCode = 409;
  }

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    const messages = Object.values(err.errors).map(e => e.message);
    error.message = messages.join(', ');
    error.statusCode = 400;
  }

  // Mongoose cast error (invalid ObjectId)
  if (err.name === 'CastError') {
    error.message = 'Invalid ID format';
    error.statusCode = 400;
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    error.message = 'Invalid token';
    error.statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    error.message = 'Token expired';
    error.statusCode = 401;
  }

  // Send error response
  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

/**
 * 404 Handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError(`Route ${req.originalUrl} not found`);
  next(error);
};

/**
 * Async Handler Wrapper (eliminates try-catch in controllers)
 */
const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

module.exports = {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  errorHandler,
  notFoundHandler,
  asyncHandler
};
```

### 3. Request Logging Middleware

Create `backend/shared/middleware/logger.js`:

```javascript
const morgan = require('morgan');

/**
 * Custom logging format
 */
const customFormat = ':method :url :status :response-time ms - :date[iso]';

/**
 * Request logger middleware
 */
const requestLogger = morgan(customFormat, {
  skip: (req, res) => {
    // Skip health check endpoints
    return req.url === '/health' || req.url === '/';
  },
  stream: {
    write: (message) => {
      console.log(message.trim());
    }
  }
});

/**
 * Request info extractor
 */
const getRequestInfo = (req) => {
  return {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip || req.connection.remoteAddress,
    userAgent: req.get('user-agent'),
    timestamp: new Date().toISOString()
  };
};

module.exports = {
  requestLogger,
  getRequestInfo
};
```

### 4. Validation Helpers

Create `backend/shared/utils/validation.js`:

```javascript
/**
 * Email validation
 */
const isValidEmail = (email) => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

/**
 * Phone number validation (Moroccan format)
 */
const isValidPhone = (phone) => {
  const phoneRegex = /^(\+212|0)[567]\d{8}$/;
  return phoneRegex.test(phone);
};

/**
 * Password strength validation
 */
const isStrongPassword = (password) => {
  // At least 8 characters, 1 uppercase, 1 lowercase, 1 number
  const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
  return passwordRegex.test(password);
};

/**
 * Date validation
 */
const isValidDate = (dateString) => {
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
};

/**
 * Check if date is in the past
 */
const isPastDate = (dateString) => {
  const date = new Date(dateString);
  return date < new Date();
};

/**
 * Check if date is in the future
 */
const isFutureDate = (dateString) => {
  const date = new Date(dateString);
  return date > new Date();
};

/**
 * MongoDB ObjectId validation
 */
const isValidObjectId = (id) => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

/**
 * Sanitize input (remove HTML tags)
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  return input.replace(/<[^>]*>/g, '');
};

/**
 * Validate required fields
 */
const validateRequiredFields = (data, requiredFields) => {
  const missingFields = [];

  requiredFields.forEach(field => {
    if (!data[field] || data[field] === '') {
      missingFields.push(field);
    }
  });

  return {
    isValid: missingFields.length === 0,
    missingFields
  };
};

module.exports = {
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  isValidDate,
  isPastDate,
  isFutureDate,
  isValidObjectId,
  sanitizeInput,
  validateRequiredFields
};
```

### 5. Response Formatter

Create `backend/shared/utils/responseFormatter.js`:

```javascript
/**
 * Success response formatter
 */
const successResponse = (res, statusCode, message, data = null) => {
  const response = {
    success: true,
    message
  };

  if (data !== null) {
    response.data = data;
  }

  return res.status(statusCode).json(response);
};

/**
 * Error response formatter
 */
const errorResponse = (res, statusCode, message, errors = null) => {
  const response = {
    success: false,
    message
  };

  if (errors) {
    response.errors = errors;
  }

  return res.status(statusCode).json(response);
};

/**
 * Paginated response formatter
 */
const paginatedResponse = (res, data, page, limit, total) => {
  return res.status(200).json({
    success: true,
    data,
    pagination: {
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalItems: total,
      itemsPerPage: parseInt(limit),
      hasNextPage: page * limit < total,
      hasPrevPage: page > 1
    }
  });
};

module.exports = {
  successResponse,
  errorResponse,
  paginatedResponse
};
```

### 6. Date/Time Utilities

Create `backend/shared/utils/dateUtils.js`:

```javascript
/**
 * Format date to readable string
 */
const formatDate = (date, includeTime = false) => {
  const d = new Date(date);
  
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    ...(includeTime && {
      hour: '2-digit',
      minute: '2-digit'
    })
  };

  return d.toLocaleDateString('fr-FR', options);
};

/**
 * Add days to date
 */
const addDays = (date, days) => {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
};

/**
 * Add hours to date
 */
const addHours = (date, hours) => {
  const result = new Date(date);
  result.setHours(result.getHours() + hours);
  return result;
};

/**
 * Get difference in days
 */
const getDaysDifference = (date1, date2) => {
  const diffTime = Math.abs(new Date(date2) - new Date(date1));
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
};

/**
 * Check if date is today
 */
const isToday = (date) => {
  const today = new Date();
  const compareDate = new Date(date);
  
  return today.getDate() === compareDate.getDate() &&
         today.getMonth() === compareDate.getMonth() &&
         today.getFullYear() === compareDate.getFullYear();
};

/**
 * Get start of day
 */
const getStartOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
};

/**
 * Get end of day
 */
const getEndOfDay = (date = new Date()) => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
};

/**
 * Check if time slot overlaps
 */
const doTimeSlotsOverlap = (start1, end1, start2, end2) => {
  return start1 < end2 && start2 < end1;
};

module.exports = {
  formatDate,
  addDays,
  addHours,
  getDaysDifference,
  isToday,
  getStartOfDay,
  getEndOfDay,
  doTimeSlotsOverlap
};
```

### 7. Update Shared Package.json

Update `backend/shared/package.json` to include new dependencies:

```json
{
  "name": "@esante/shared",
  "version": "1.0.0",
  "description": "Shared utilities for E-Santé microservices",
  "main": "index.js",
  "scripts": {
    "test": "echo \"Error: no test specified\" && exit 1"
  },
  "dependencies": {
    "mongoose": "^8.0.0",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0"
  },
  "keywords": [],
  "author": "",
  "license": "MIT"
}
```

### 8. Create Shared Index File

Create `backend/shared/index.js`:

```javascript
// Database
const { connectDB, disconnectDB, getDBStatus, mongoose } = require('./config/database');

// Middleware
const { authenticateToken, authorizeRoles, optionalAuth } = require('./middleware/auth');
const {
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  errorHandler,
  notFoundHandler,
  asyncHandler
} = require('./middleware/errorHandler');
const { requestLogger, getRequestInfo } = require('./middleware/logger');

// Utilities
const {
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  isValidDate,
  isPastDate,
  isFutureDate,
  isValidObjectId,
  sanitizeInput,
  validateRequiredFields
} = require('./utils/validation');
const {
  successResponse,
  errorResponse,
  paginatedResponse
} = require('./utils/responseFormatter');
const {
  formatDate,
  addDays,
  addHours,
  getDaysDifference,
  isToday,
  getStartOfDay,
  getEndOfDay,
  doTimeSlotsOverlap
} = require('./utils/dateUtils');

module.exports = {
  // Database
  connectDB,
  disconnectDB,
  getDBStatus,
  mongoose,

  // Middleware
  authenticateToken,
  authorizeRoles,
  optionalAuth,
  AppError,
  ValidationError,
  UnauthorizedError,
  ForbiddenError,
  NotFoundError,
  ConflictError,
  errorHandler,
  notFoundHandler,
  asyncHandler,
  requestLogger,
  getRequestInfo,

  // Utilities
  isValidEmail,
  isValidPhone,
  isStrongPassword,
  isValidDate,
  isPastDate,
  isFutureDate,
  isValidObjectId,
  sanitizeInput,
  validateRequiredFields,
  successResponse,
  errorResponse,
  paginatedResponse,
  formatDate,
  addDays,
  addHours,
  getDaysDifference,
  isToday,
  getStartOfDay,
  getEndOfDay,
  doTimeSlotsOverlap
};
```

## Testing Checklist

After completing this prompt, verify:

- [ ] `backend/shared/middleware/auth.js` exists with JWT authentication
- [ ] `backend/shared/middleware/errorHandler.js` exists with error classes
- [ ] `backend/shared/middleware/logger.js` exists with morgan setup
- [ ] `backend/shared/utils/validation.js` exists with validation helpers
- [ ] `backend/shared/utils/responseFormatter.js` exists
- [ ] `backend/shared/utils/dateUtils.js` exists
- [ ] `backend/shared/index.js` exports all utilities
- [ ] `backend/shared/package.json` updated with jwt and morgan
- [ ] Can run `npm install` in shared folder without errors

## Deliverables

1. ✅ Authentication middleware (JWT verification, role authorization)
2. ✅ Error handling middleware with custom error classes
3. ✅ Request logging middleware
4. ✅ Validation utilities (email, phone, password, dates)
5. ✅ Response formatter utilities
6. ✅ Date/time utilities
7. ✅ Shared index.js with all exports
8. ✅ Updated package.json

## Time Estimate
⏱️ **2-3 hours**

---

**Next:** Proceed to PROMPT 1C (Kafka Infrastructure)
