# PROMPT 2B: Auth Service - Email Verification & Password Management

## Objective
Add email verification with Nodemailer, password reset functionality, and password change features to the authentication service.

## Prerequisites
✅ PROMPT 2A completed (Core authentication with register/login)

## Requirements

### 1. Install Additional Dependencies

Update `backend/services/auth-service/package.json` to add:

```json
{
  "dependencies": {
    "nodemailer": "^6.9.7",
    "crypto": "^1.0.1"
  }
}
```

Run: `npm install` in the auth-service directory.

### 2. Update Environment Variables

Add to `backend/services/auth-service/.env`:

```env
# Email Configuration (Nodemailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=noreply@esante.com

# URLs
FRONTEND_URL=http://localhost:3000
```

### 3. Email Service

Create `backend/services/auth-service/src/services/emailService.js`:

```javascript
const nodemailer = require('nodemailer');

/**
 * Create email transporter
 */
const createTransporter = () => {
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT),
    secure: process.env.SMTP_SECURE === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS
    }
  });
};

/**
 * Send verification email
 */
exports.sendVerificationEmail = async (email, token) => {
  const transporter = createTransporter();
  
  const verificationUrl = `${process.env.FRONTEND_URL}/verify-email?token=${token}`;
  
  const mailOptions = {
    from: `"E-Santé" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Verify Your Email - E-Santé',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 30px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🏥 Welcome to E-Santé!</h1>
          </div>
          <div class="content">
            <h2>Verify Your Email Address</h2>
            <p>Thank you for registering with E-Santé. To complete your registration, please verify your email address by clicking the button below:</p>
            <div style="text-align: center;">
              <a href="${verificationUrl}" class="button">Verify Email</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #4CAF50;">${verificationUrl}</p>
            <p><strong>This link will expire in 24 hours.</strong></p>
            <p>If you didn't create an account with E-Santé, please ignore this email.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 E-Santé. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Verification email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending verification email:', error);
    throw error;
  }
};

/**
 * Send password reset email
 */
exports.sendPasswordResetEmail = async (email, token) => {
  const transporter = createTransporter();
  
  const resetUrl = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;
  
  const mailOptions = {
    from: `"E-Santé" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Reset Your Password - E-Santé',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #f44336; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .button { display: inline-block; padding: 12px 30px; background-color: #f44336; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🔐 Password Reset Request</h1>
          </div>
          <div class="content">
            <h2>Reset Your Password</h2>
            <p>We received a request to reset your password. Click the button below to choose a new password:</p>
            <div style="text-align: center;">
              <a href="${resetUrl}" class="button">Reset Password</a>
            </div>
            <p>Or copy and paste this link into your browser:</p>
            <p style="word-break: break-all; color: #f44336;">${resetUrl}</p>
            <p><strong>This link will expire in 1 hour.</strong></p>
            <p>If you didn't request a password reset, please ignore this email or contact support if you have concerns.</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 E-Santé. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password reset email sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending password reset email:', error);
    throw error;
  }
};

/**
 * Send password changed confirmation email
 */
exports.sendPasswordChangedEmail = async (email) => {
  const transporter = createTransporter();
  
  const mailOptions = {
    from: `"E-Santé" <${process.env.EMAIL_FROM}>`,
    to: email,
    subject: 'Password Changed Successfully - E-Santé',
    html: `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background-color: #2196F3; color: white; padding: 20px; text-align: center; }
          .content { padding: 20px; background-color: #f9f9f9; }
          .footer { text-align: center; padding: 20px; color: #777; font-size: 12px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Password Changed</h1>
          </div>
          <div class="content">
            <h2>Your Password Has Been Changed</h2>
            <p>This email confirms that your password was successfully changed.</p>
            <p>If you did not make this change, please contact our support team immediately.</p>
            <p><strong>Time:</strong> ${new Date().toLocaleString()}</p>
          </div>
          <div class="footer">
            <p>&copy; 2025 E-Santé. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `
  };

  try {
    await transporter.sendMail(mailOptions);
    console.log(`✅ Password changed confirmation sent to ${email}`);
  } catch (error) {
    console.error('❌ Error sending password changed email:', error);
    // Don't throw error - this is just a notification
  }
};
```

### 4. Update User Model

Update `backend/services/auth-service/src/models/User.js` to add token generation methods:

```javascript
// Add these methods to the User model

/**
 * Generate email verification token
 */
userSchema.methods.generateEmailVerificationToken = function() {
  const crypto = require('crypto');
  const jwt = require('jsonwebtoken');
  
  // Generate token that expires in 24 hours
  const token = jwt.sign(
    {
      id: this._id,
      purpose: 'email-verification'
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );
  
  // Save token and expiry
  this.emailVerificationToken = token;
  this.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
  
  return token;
};

/**
 * Generate password reset token
 */
userSchema.methods.generatePasswordResetToken = function() {
  const crypto = require('crypto');
  
  // Generate random token
  const resetToken = crypto.randomBytes(32).toString('hex');
  
  // Hash token and save
  this.passwordResetToken = crypto
    .createHash('sha256')
    .update(resetToken)
    .digest('hex');
  
  this.passwordResetExpires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
  
  return resetToken; // Return unhashed token to send via email
};
```

### 5. Update Auth Controller

Update `backend/services/auth-service/src/controllers/authController.js`:

#### Update the register function:

```javascript
const emailService = require('../services/emailService');

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
      isEmailVerified: false
    });

    // Generate email verification token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send verification email
    try {
      await emailService.sendVerificationEmail(email, verificationToken);
    } catch (emailError) {
      console.error('Failed to send verification email:', emailError);
      // Don't fail registration if email fails
    }

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.AUTH.USER_REGISTERED,
      createEvent('auth.user.registered', {
        userId: user._id.toString(),
        email: user.email,
        role: user.role,
        profileData
      })
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful. Please check your email for verification link.',
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
```

#### Add new controller functions:

```javascript
/**
 * Verify email
 * GET /api/v1/auth/verify-email/:token
 */
exports.verifyEmail = async (req, res, next) => {
  try {
    const { token } = req.params;
    const jwt = require('jsonwebtoken');

    // Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (decoded.purpose !== 'email-verification') {
      return res.status(400).json({
        success: false,
        message: 'Invalid verification token'
      });
    }

    // Find user
    const user = await User.findById(decoded.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Check if token has expired
    if (user.emailVerificationExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: 'Verification token has expired. Please request a new one.'
      });
    }

    // Verify email
    user.isEmailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.AUTH.USER_VERIFIED,
      createEvent('auth.user.verified', {
        userId: user._id.toString(),
        email: user.email
      })
    );

    res.status(200).json({
      success: true,
      message: 'Email verified successfully. You can now log in.'
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired verification token'
      });
    }
    next(error);
  }
};

/**
 * Forgot password - send reset email
 * POST /api/v1/auth/forgot-password
 */
exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    // Don't reveal if user exists or not (security)
    if (!user) {
      return res.status(200).json({
        success: true,
        message: 'If that email exists, a password reset link has been sent.'
      });
    }

    // Generate reset token
    const resetToken = user.generatePasswordResetToken();
    await user.save();

    // Send reset email
    try {
      await emailService.sendPasswordResetEmail(email, resetToken);
    } catch (emailError) {
      user.passwordResetToken = undefined;
      user.passwordResetExpires = undefined;
      await user.save();

      return res.status(500).json({
        success: false,
        message: 'Error sending password reset email. Please try again.'
      });
    }

    res.status(200).json({
      success: true,
      message: 'If that email exists, a password reset link has been sent.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Reset password with token
 * POST /api/v1/auth/reset-password/:token
 */
exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { newPassword } = req.body;
    const crypto = require('crypto');

    // Hash the token from URL
    const hashedToken = crypto
      .createHash('sha256')
      .update(token)
      .digest('hex');

    // Find user with valid token
    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or expired password reset token'
      });
    }

    // Set new password
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();

    // Send confirmation email
    await emailService.sendPasswordChangedEmail(user.email);

    // Publish Kafka event
    await kafkaProducer.sendEvent(
      TOPICS.AUTH.PASSWORD_RESET,
      createEvent('auth.password.reset', {
        userId: user._id.toString(),
        email: user.email
      })
    );

    res.status(200).json({
      success: true,
      message: 'Password reset successful. You can now log in with your new password.'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Change password (authenticated user)
 * POST /api/v1/auth/change-password
 */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // Get user with password
    const user = await User.findById(req.user.id).select('+password');

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    // Verify current password
    const isPasswordMatch = await user.comparePassword(currentPassword);
    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Set new password
    user.password = newPassword;
    await user.save();

    // Send confirmation email
    await emailService.sendPasswordChangedEmail(user.email);

    res.status(200).json({
      success: true,
      message: 'Password changed successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * Resend verification email
 * POST /api/v1/auth/resend-verification
 */
exports.resendVerification = async (req, res, next) => {
  try {
    const { email } = req.body;

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user.isEmailVerified) {
      return res.status(400).json({
        success: false,
        message: 'Email already verified'
      });
    }

    // Generate new token
    const verificationToken = user.generateEmailVerificationToken();
    await user.save();

    // Send email
    await emailService.sendVerificationEmail(email, verificationToken);

    res.status(200).json({
      success: true,
      message: 'Verification email sent successfully'
    });
  } catch (error) {
    next(error);
  }
};
```

### 6. Add Validation Schemas

Update `backend/services/auth-service/src/validators/authValidator.js`:

```javascript
/**
 * Forgot password validation
 */
const forgotPasswordSchema = Joi.object({
  email: Joi.string().email().required()
});

/**
 * Reset password validation
 */
const resetPasswordSchema = Joi.object({
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .messages({
      'string.min': 'Password must be at least 8 characters',
      'string.pattern.base': 'Password must contain at least one uppercase letter, one lowercase letter, and one number'
    })
});

/**
 * Change password validation
 */
const changePasswordSchema = Joi.object({
  currentPassword: Joi.string().required(),
  newPassword: Joi.string()
    .min(8)
    .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .required()
    .invalid(Joi.ref('currentPassword'))
    .messages({
      'any.invalid': 'New password must be different from current password'
    })
});

module.exports = {
  validateRegister: validate(registerSchema),
  validateLogin: validate(loginSchema),
  validateRefreshToken: validate(refreshTokenSchema),
  validateForgotPassword: validate(forgotPasswordSchema),
  validateResetPassword: validate(resetPasswordSchema),
  validateChangePassword: validate(changePasswordSchema)
};
```

### 7. Update Routes

Update `backend/services/auth-service/src/routes/authRoutes.js`:

```javascript
const {
  validateRegister,
  validateLogin,
  validateRefreshToken,
  validateForgotPassword,
  validateResetPassword,
  validateChangePassword
} = require('../validators/authValidator');

// Public routes
router.post('/register', validateRegister, authController.register);
router.get('/verify-email/:token', authController.verifyEmail);
router.post('/resend-verification', authController.resendVerification);
router.post('/login', validateLogin, authController.login);
router.post('/refresh-token', validateRefreshToken, authController.refreshToken);
router.post('/forgot-password', validateForgotPassword, authController.forgotPassword);
router.post('/reset-password/:token', validateResetPassword, authController.resetPassword);

// Protected routes
router.get('/me', authenticateToken, authController.getCurrentUser);
router.post('/change-password', authenticateToken, validateChangePassword, authController.changePassword);
router.post('/logout', authenticateToken, authController.logout);
```

## Testing Checklist

After completing this prompt, test:

- [ ] Register user receives verification email
- [ ] Verification link works and verifies email
- [ ] Verified user can log in
- [ ] Unverified user cannot log in
- [ ] Resend verification email works
- [ ] Forgot password sends reset email
- [ ] Password reset link works with valid token
- [ ] Password reset fails with expired token
- [ ] Change password works when authenticated
- [ ] Change password fails with wrong current password
- [ ] Password changed confirmation email is sent
- [ ] All Kafka events are published correctly

## Gmail Setup Instructions

To use Gmail for sending emails:

1. Enable 2-Factor Authentication on your Gmail account
2. Generate an App Password:
   - Go to Google Account → Security → 2-Step Verification
   - Scroll to "App passwords"
   - Generate a new app password for "Mail"
   - Use this password in `SMTP_PASS` environment variable

## Deliverables

1. ✅ Email service with Nodemailer
2. ✅ Email verification flow with token
3. ✅ Resend verification email
4. ✅ Forgot password functionality
5. ✅ Password reset with token
6. ✅ Change password for authenticated users
7. ✅ Beautiful HTML email templates
8. ✅ Token generation methods in User model
9. ✅ Validation for all password operations
10. ✅ Kafka events for verification and password reset

## Time Estimate
⏱️ **2-3 hours**

---

**Next:** Proceed to PROMPT_3 (User Service - Patient & Doctor Profiles)
