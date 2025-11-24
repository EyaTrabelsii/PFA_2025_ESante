import nodemailer from 'nodemailer';
import axios from 'axios';
import { generateEmailTemplate } from '../templates/email/index.js';

// Create transporter
const transporter = nodemailer.createTransport({
  service: process.env.EMAIL_SERVICE || 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD
  }
});

// Verify connection on startup
transporter.verify((error, success) => {
  if (error) {
    console.error('❌ Email transporter error:', error.message);
    console.log('   Email notifications will be disabled. Please check EMAIL_USER and EMAIL_PASSWORD in .env');
  } else {
    console.log('✅ Email server is ready to send messages');
  }
});

/**
 * Send email notification
 * @param {String} userId - User ID to send email to
 * @param {Object} notification - Notification object with title, body, type, etc.
 * @returns {Object} - { sent: Boolean, sentAt: Date, messageId: String, error: String }
 */
export async function sendEmailNotification(userId, notification) {
  try {
    // Get user details
    const user = await getUserById(userId);
    
    if (!user || !user.email) {
      console.log(`⚠️  No email address for user ${userId}`);
      return { sent: false, error: 'No email address' };
    }
    
    // Generate HTML email template
    const emailTemplate = await generateEmailTemplate(notification, user);
    
    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"E-Santé" <noreply@esante.com>',
      to: user.email,
      subject: notification.title,
      html: emailTemplate
    });
    
    console.log(`📧 Email sent to ${user.email}: ${info.messageId}`);
    
    return { 
      sent: true, 
      sentAt: new Date(),
      messageId: info.messageId
    };
  } catch (error) {
    console.error('❌ Email sending error:', error.message);
    return { 
      sent: false, 
      error: error.message 
    };
  }
}

/**
 * Get user by ID from User Service
 * @param {String} userId - User ID
 * @returns {Object} - User object with email
 */
async function getUserById(userId) {
  try {
    const response = await axios.get(
      `${process.env.USER_SERVICE_URL}/api/v1/users/profile/${userId}`,
      {
        timeout: 5000
      }
    );
    
    return response.data.data;
  } catch (error) {
    console.error(`Error fetching user ${userId}:`, error.message);
    return null;
  }
}

/**
 * Check if current time is within quiet hours
 * @param {Object} preferences - User notification preferences
 * @returns {Boolean} - True if in quiet hours
 */
export function isQuietHours(preferences) {
  if (!preferences?.quietHours?.enabled) {
    return false;
  }
  
  const now = new Date();
  const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
  
  const { startTime, endTime } = preferences.quietHours;
  
  // Handle cases like 22:00 to 08:00 (crosses midnight)
  if (startTime > endTime) {
    return currentTime >= startTime || currentTime <= endTime;
  }
  
  return currentTime >= startTime && currentTime <= endTime;
}

/**
 * Send test email (for debugging)
 */
export async function sendTestEmail(toEmail, subject = 'Test Email', body = 'This is a test email from E-Santé.') {
  try {
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM || '"E-Santé" <noreply@esante.com>',
      to: toEmail,
      subject: subject,
      html: `
        <html>
          <body style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>Test Email</h2>
            <p>${body}</p>
            <p>If you received this, email notifications are working correctly!</p>
          </body>
        </html>
      `
    });
    
    console.log('Test email sent:', info.messageId);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    console.error('Test email error:', error);
    return { success: false, error: error.message };
  }
}

export default {
  sendEmailNotification,
  isQuietHours,
  sendTestEmail
};
