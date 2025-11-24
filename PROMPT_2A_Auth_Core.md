# PROMPT 2A: Auth Service - Core Authentication (Register & Login)

## Objective
Build the core authentication functionality including user registration, login with JWT tokens, and token refresh. This is the foundation of the auth service.

## Prerequisites
✅ PROMPT 1A completed (Folder structure)
✅ PROMPT 1B completed (Shared middleware)
✅ PROMPT 1C completed (Kafka infrastructure)
✅ PROMPT 1D completed (API Gateway)

## Requirements

### 1. Service Setup

Create `backend/services/auth-service/package.json`:

```json
{
  "name": "esante-auth-service",
  "version": "1.0.0",
  "description": "Authentication service for E-Santé",
  "main": "src/server.js",
  "scripts": {
    "start": "node src/server.js",
    "dev": "nodemon src/server.js"
  },
  "dependencies": {
    "express": "^4.18.2",
    "mongoose": "^8.0.0",
    "bcryptjs": "^2.4.3",
    "jsonwebtoken": "^9.0.2",
    "dotenv": "^16.3.1",
    "joi": "^17.11.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0"
  },
  "devDependencies": {
    "nodemon": "^3.0.2"
  }
}
```

### 2. Environment Variables

Create `backend/services/auth-service/.env`:

```env
# Service Configuration
NODE_ENV=development
PORT=3001
SERVICE_NAME=auth-service

# MongoDB
MONGODB_URI=mongodb://localhost:27017/esante_auth

# JWT Configuration
JWT_SECRET=your_super_secret_jwt_key_change_in_production
JWT_EXPIRE=1d
JWT_REFRESH_SECRET=your_super_secret_refresh_key_change_in_production
JWT_REFRESH_EXPIRE=30d

# Kafka
KAFKA_BROKERS=localhost:9092
KAFKA_CLIENT_ID=auth-service

# Frontend URL
FRONTEND_URL=http://localhost:3000
```

### 3. User Model

Create `backend/services/auth-service/src/models/User.js`:

```javascript
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false // Don't return password by default
  },
  role: {
    type: String,
    enum: ['patient', 'doctor', 'admin'],
    required: [true, 'Role is required']
  },
  isEmailVerified: {
    type: Boolean,
    default: false
  },
  emailVerificationToken: String,
  emailVerificationExpires: Date,
  passwordResetToken: String,
  passwordResetExpires: Date,
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: Date,
  profileId: {
    type: mongoose.Schema.Types.ObjectId,
    refPath: 'role' // References either Patient or Doctor
  }
}, {
  timestamps: true
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  // Only hash if password is modified
  if (!this.isModified('password')) {
    return next();
  }

  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare passwords
userSchema.methods.comparePassword = async function(candidatePassword) {
  try {
    return await bcrypt.compare(candidatePassword, this.password);
  } catch (error) {
    throw error;
  }
};

// Method to generate JWT access token
userSchema.methods.generateAccessToken = function() {
  const jwt = require('jsonwebtoken');
  
  return jwt.sign(
    {
      id: this._id,
      email: this.email,
      role: this.role,
      profileId: this.profileId,
      type: 'access'
    },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRE || '1d' }
  );
};

// Method to generate JWT refresh token
userSchema.methods.generateRefreshToken = function() {
  const jwt = require('jsonwebtoken');
  
  return jwt.sign(
    {
      id: this._id,
      type: 'refresh'
    },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRE || '30d' }
  );
};

// Method to get user info without sensitive data
userSchema.methods.toJSON = function() {
  const user = this.toObject();
  delete user.password;
  delete user.emailVerificationToken;
  delete user.emailVerificationExpires;
  delete user.passwordResetToken;
  delete user.passwordResetExpires;
  return user;
};

module.exports = mongoose.model('User', userSchema);
```

### 4. Validation Schemas

Create `backend/services/auth-service/src/validators/authValidator.js`:

```javascript
const Joi = require('joi');

/**
 * Registration validation
 */
const registerSchema = Joi.object({
  email: Joi.string().email().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required'
  }),
  password: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number',
      'any.required': 'Password is required'
    }),
  role: Joi.string()
    .valid('patient', 'doctor')
    .required()
    .messages({
      'any.only': 'Role must be either patient or doctor',
      'any.required': 'Role is required'
    }),
  profileData: Joi.object().optional()
});

/**
 * Login validation
 */
const loginSchema = Joi.object({
  email: Joi.string().email().required(),
  password: Joi.string().required()
});

/**
 * Refresh token validation
 */
const refreshTokenSchema = Joi.object({
  refreshToken: Joi.string().required()
});

/**
 * Validate request data
 */
const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body, { abortEarly: false });
    
    if (error) {
      const errors = error.details.map(detail => detail.message);
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors
      });
    }
    
    next();
  };
};

module.exports = {
  validateRegister: validate(registerSchema),
  validateLogin: validate(loginSchema),
  validateRefreshToken: validate(refreshTokenSchema)
};
```

### 5. Auth Controller

Create `backend/services/auth-service/src/controllers/authController.js`:

```javascript
const User = require('../models/User');
const { kafkaProducer, TOPICS, createEvent } = require('../../../../shared');

/**
 * Register new user
 * POST /api/v1/auth/register
 */
exports.register = async (req, res, next) => {
  try {
    const { email, password, role, profileData } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Create user
    const user = await User.create({
      email,
      password,
      role,
      isEmailVerified: false // Will be verified via email
    });

    // Generate email verification token (we'll handle this in PROMPT_2B)
    // For now, we'll set it to verified for testing
    // TODO: Generate verification token and send email

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.AUTH.USER_REGISTERED,
      createEvent('auth.user.registered', {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        profileData // Will be used by User Service to create profile
      })
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification.',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          isEmailVerified: user.isEmailVerified
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Login user
 * POST /api/v1/auth/login
 */
exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Check if email is verified
    if (!user.isEmailVerified) {
      return res.status(403).json({
        success: false,
        message: 'Please verify your email before logging in'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Your account has been deactivated. Please contact support.'
      });
    }

    // Compare password
    const isPasswordMatch = await user.comparePassword(password);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate tokens
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.AUTH.USER_LOGIN,
      createEvent('auth.user.login', {
        userId: user._id.toString(),
        email: user.email,
        role: user.role
      })
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          email: user.email,
          role: user.role,
          profileId: user.profileId,
          isEmailVerified: user.isEmailVerified,
          lastLogin: user.lastLogin
        },
        accessToken,
        refreshToken
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Refresh access token
 * POST /api/v1/auth/refresh-token
 */
exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;
    const jwt = require('jsonwebtoken');

    // Verify refresh token
    const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET);

    if (decoded.type !== 'refresh') {
      return res.status(401).json({
        success: false,
        message: 'Invalid token type'
      });
    }

    // Find user
    const user = await User.findById(decoded.id);
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'User not found or inactive'
      });
    }

    // Generate new access token
    const newAccessToken = user.generateAccessToken();

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.AUTH.TOKEN_REFRESHED,
      createEvent('auth.token.refreshed', {
        userId: user._id.toString()
      })
    );

    res.status(200).json({
      success: true,
      message: 'Token refreshed successfully',
      data: {
        accessToken: newAccessToken
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired refresh token'
      });
    }
    next(error);
  }
};

/**
 * Get current user info
 * GET /api/v1/auth/me
 */
exports.getCurrentUser = async (req, res, next) => {
  try {
    // req.user is set by authentication middleware
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      data: {
        user
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Logout user
 * POST /api/v1/auth/logout
 */
exports.logout = async (req, res, next) => {
  try {
    // Optional: Add token to blacklist (Redis)
    // For now, just publish event
    
    await kafkaProducer.sendEvent(
      TOPICS.AUTH.USER_LOGOUT,
      createEvent('auth.user.logout', {
        userId: req.user.id
      })
    );

    res.status(200).json({
      success: true,
      message: 'Logout successful'
    });
  } catch (error) {
    next(error);
  }
};
```

### 6. Auth Routes

Create `backend/services/auth-service/src/routes/authRoutes.js`:

```javascript
const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const { validateRegister, validateLogin, validateRefreshToken } = require('../validators/authValidator');
const { authenticateToken } = require('../../../../shared');

// Public routes
router.post('/register', validateRegister, authController.register);
router.post('/login', validateLogin, authController.login);
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);

// Protected routes
router.get('/me', authenticateToken, authController.getCurrentUser);
router.post('/logout', authenticateToken, authController.logout);

module.exports = router;
```

### 7. Main Server File

Create `backend/services/auth-service/src/server.js`:

```javascript
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { connectDB, errorHandler, notFoundHandler, requestLogger } = require('../../../shared');
const authRoutes = require('./routes/authRoutes');

const app = express();
const PORT = process.env.PORT || 3001;

// Connect to MongoDB
connectDB(process.env.MONGODB_URI);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(requestLogger);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    service: 'Auth Service',
    status: 'healthy',
    timestamp: new Date().toISOString()
  });
});

// Routes
app.use('/api/v1/auth', authRoutes);

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(PORT, () => {
  console.log(`
╔════════════════════════════════════════╗
║   🔐 AUTH SERVICE STARTED 🔐          ║
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
```

## Testing Checklist

After completing this prompt, test:

- [ ] Can start auth service: `cd services/auth-service && npm install && npm run dev`
- [ ] Service accessible at http://localhost:3001
- [ ] Health check works: `GET http://localhost:3001/health`
- [ ] Register new patient with valid data
- [ ] Register new doctor with valid data
- [ ] Registration rejects duplicate email
- [ ] Registration validates password strength
- [ ] Login works with correct credentials
- [ ] Login fails with incorrect password
- [ ] Login fails for unverified email (currently auto-verified for testing)
- [ ] Refresh token works and generates new access token
- [ ] Get current user info with valid token
- [ ] Logout publishes Kafka event
- [ ] Kafka events are published for registration and login

## Deliverables

1. ✅ Auth service folder structure
2. ✅ User model with password hashing
3. ✅ Registration endpoint with validation
4. ✅ Login endpoint with JWT token generation
5. ✅ Refresh token endpoint
6. ✅ Get current user endpoint
7. ✅ Logout endpoint
8. ✅ Input validation with Joi
9. ✅ Kafka event publishers for user events
10. ✅ Error handling

## Time Estimate
⏱️ **2-3 hours**

## Notes

- Email verification is temporarily bypassed for testing (will be implemented in PROMPT_2B)
- Password reset functionality will be in PROMPT_2B
- For now, users are automatically verified on registration for testing purposes
- Token blacklisting (Redis) is optional and can be added later

---

**Next:** Proceed to PROMPT_2B (Email Verification & Password Management)
