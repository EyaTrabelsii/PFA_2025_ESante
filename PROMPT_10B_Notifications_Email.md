# PROMPT 10B: Notification Service - Email Notifications + Advanced Features

## Objective
Extend the notification service with Nodemailer email delivery, comprehensive HTML email templates for all notification types, quiet hours support, and additional event handlers.

## Prerequisites
- PROMPT_10A must be completed (Core notification infrastructure, push notifications, Kafka consumers)

## Requirements

### 1. Nodemailer Setup

#### Configuration
```javascript
// services/email.service.js

const nodemailer = require('nodemailer');

// Create transporter
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASSWORD // App password if using Gmail
  }
});

// Verify connection
transporter.verify((error, success) => {
  if (error) {
    console.error('Email transporter error:', error);
  } else {
    console.log('Email server is ready to send messages');
  }
});

module.exports = { transporter };
```

#### Environment Variables
```
EMAIL_USER=your-email@gmail.com
EMAIL_PASSWORD=your_app_password
EMAIL_FROM="E-Santé <noreply@esante.com>"
FRONTEND_URL=http://localhost:3000
```

### 2. Send Email Function

```javascript
// services/email.service.js

async function sendEmailNotification(userId, notification) {
  try {
    // Get user details
    const user = await getUserById(userId);
    
    if (!user.email) {
      console.log(`No email address for user ${userId}`);
      return { sent: false, error: 'No email address' };
    }
    
    // Generate email template
    const emailTemplate = await generateEmailTemplate(notification);
    
    // Send email
    const info = await transporter.sendMail({
      from: process.env.EMAIL_FROM,
      to: user.email,
      subject: notification.title,
      html: emailTemplate
    });
    
    console.log('Email sent:', info.messageId);
    
    return { 
      sent: true, 
      sentAt: new Date(),
      messageId: info.messageId
    };
  } catch (error) {
    console.error('Email sending error:', error);
    return { 
      sent: false, 
      error: error.message 
    };
  }
}

module.exports = { sendEmailNotification };
```

### 3. HTML Email Templates

#### Base Email Template
```javascript
// templates/email/base.template.js

function getBaseTemplate(content) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      font-family: Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .email-container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .email-header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .email-header h1 {
      margin: 0;
      font-size: 24px;
    }
    .email-body {
      padding: 30px 20px;
    }
    .email-body h2 {
      color: #667eea;
      font-size: 20px;
      margin-top: 0;
    }
    .info-box {
      background-color: #f8f9fa;
      border-left: 4px solid #667eea;
      padding: 15px;
      margin: 20px 0;
    }
    .info-box strong {
      color: #667eea;
    }
    .button {
      display: inline-block;
      background-color: #667eea;
      color: white;
      padding: 12px 30px;
      text-decoration: none;
      border-radius: 5px;
      margin: 20px 0;
      font-weight: bold;
    }
    .button:hover {
      background-color: #5568d3;
    }
    .email-footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #666;
    }
    .divider {
      height: 1px;
      background-color: #e0e0e0;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="email-container">
    <div class="email-header">
      <h1>🏥 E-Santé Healthcare</h1>
    </div>
    ${content}
    <div class="email-footer">
      <p>© 2025 E-Santé. All rights reserved.</p>
      <p>This is an automated notification. Please do not reply to this email.</p>
      <p><a href="${process.env.FRONTEND_URL}/settings/notifications" style="color: #667eea;">Manage notification preferences</a></p>
    </div>
  </div>
</body>
</html>
  `;
}

module.exports = { getBaseTemplate };
```

#### Template: Appointment Confirmed
```javascript
// templates/email/appointmentConfirmed.template.js

function getAppointmentConfirmedTemplate(data) {
  const { patientName, doctorName, appointmentDate, appointmentTime, clinicName, clinicAddress, actionUrl } = data;
  
  const content = `
    <div class="email-body">
      <h2>✅ Appointment Confirmed</h2>
      <p>Dear ${patientName},</p>
      <p>Your appointment has been successfully confirmed!</p>
      
      <div class="info-box">
        <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
        <p><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Time:</strong> ${appointmentTime}</p>
        <p><strong>Clinic:</strong> ${clinicName}</p>
        <p><strong>Address:</strong> ${clinicAddress}</p>
      </div>
      
      <p><strong>Important Reminders:</strong></p>
      <ul>
        <li>Please arrive 10 minutes early</li>
        <li>Bring your insurance card and ID</li>
        <li>Bring any relevant medical records</li>
      </ul>
      
      <center>
        <a href="${actionUrl}" class="button">View Appointment Details</a>
      </center>
      
      <div class="divider"></div>
      <p style="font-size: 14px; color: #666;">Need to cancel or reschedule? Please do so at least 24 hours in advance.</p>
    </div>
  `;
  
  return getBaseTemplate(content);
}

module.exports = { getAppointmentConfirmedTemplate };
```

#### Template: Appointment Reminder
```javascript
// templates/email/appointmentReminder.template.js

function getAppointmentReminderTemplate(data) {
  const { patientName, doctorName, appointmentDate, appointmentTime, clinicAddress, actionUrl } = data;
  
  const content = `
    <div class="email-body">
      <h2>⏰ Appointment Reminder</h2>
      <p>Dear ${patientName},</p>
      <p>This is a friendly reminder about your upcoming appointment:</p>
      
      <div class="info-box">
        <p><strong>Doctor:</strong> Dr. ${doctorName}</p>
        <p><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Time:</strong> ${appointmentTime}</p>
        <p><strong>Location:</strong> ${clinicAddress}</p>
      </div>
      
      <p>We look forward to seeing you!</p>
      
      <center>
        <a href="${actionUrl}" class="button">View Appointment</a>
      </center>
    </div>
  `;
  
  return getBaseTemplate(content);
}

module.exports = { getAppointmentReminderTemplate };
```

#### Template: Appointment Cancelled
```javascript
function getAppointmentCancelledTemplate(data) {
  const { patientName, doctorName, appointmentDate, cancellationReason, actionUrl } = data;
  
  const content = `
    <div class="email-body">
      <h2>❌ Appointment Cancelled</h2>
      <p>Dear ${patientName},</p>
      <p>Your appointment with Dr. ${doctorName} scheduled for ${new Date(appointmentDate).toLocaleDateString()} has been cancelled.</p>
      
      ${cancellationReason ? `<p><strong>Reason:</strong> ${cancellationReason}</p>` : ''}
      
      <p>If you would like to reschedule, please book a new appointment at your convenience.</p>
      
      <center>
        <a href="${actionUrl}" class="button">Book New Appointment</a>
      </center>
    </div>
  `;
  
  return getBaseTemplate(content);
}
```

#### Template: New Message
```javascript
function getNewMessageTemplate(data) {
  const { recipientName, senderName, messagePreview, actionUrl } = data;
  
  const content = `
    <div class="email-body">
      <h2>💬 New Message</h2>
      <p>Dear ${recipientName},</p>
      <p>You have received a new message from <strong>${senderName}</strong>:</p>
      
      <div class="info-box">
        <p style="font-style: italic;">"${messagePreview}..."</p>
      </div>
      
      <center>
        <a href="${actionUrl}" class="button">View Message</a>
      </center>
    </div>
  `;
  
  return getBaseTemplate(content);
}
```

#### Template: Referral Received (Doctor)
```javascript
function getReferralReceivedTemplate(data) {
  const { doctorName, referringDoctorName, patientName, specialty, urgency, reason, actionUrl } = data;
  
  const urgencyColor = urgency === 'urgent' ? '#f44336' : '#ff9800';
  
  const content = `
    <div class="email-body">
      <h2>📋 New Referral Received</h2>
      <p>Dear Dr. ${doctorName},</p>
      <p>You have received a new referral from Dr. ${referringDoctorName}.</p>
      
      <div class="info-box">
        <p><strong>Patient:</strong> ${patientName}</p>
        <p><strong>Specialty:</strong> ${specialty}</p>
        <p><strong>Urgency:</strong> <span style="color: ${urgencyColor}; font-weight: bold;">${urgency.toUpperCase()}</span></p>
        <p><strong>Reason:</strong> ${reason}</p>
      </div>
      
      <p>Please review the referral and schedule an appointment with the patient.</p>
      
      <center>
        <a href="${actionUrl}" class="button">View Referral Details</a>
      </center>
    </div>
  `;
  
  return getBaseTemplate(content);
}
```

#### Template: Referral Scheduled (Patient)
```javascript
function getReferralScheduledTemplate(data) {
  const { patientName, doctorName, specialty, appointmentDate, appointmentTime, actionUrl } = data;
  
  const content = `
    <div class="email-body">
      <h2>📅 Referral Appointment Scheduled</h2>
      <p>Dear ${patientName},</p>
      <p>Your referral appointment with the specialist has been scheduled.</p>
      
      <div class="info-box">
        <p><strong>Specialist:</strong> Dr. ${doctorName}</p>
        <p><strong>Specialty:</strong> ${specialty}</p>
        <p><strong>Date:</strong> ${new Date(appointmentDate).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
        <p><strong>Time:</strong> ${appointmentTime}</p>
      </div>
      
      <center>
        <a href="${actionUrl}" class="button">View Details</a>
      </center>
    </div>
  `;
  
  return getBaseTemplate(content);
}
```

#### Template: Prescription Created
```javascript
function getPrescriptionCreatedTemplate(data) {
  const { patientName, doctorName, medicationCount, actionUrl } = data;
  
  const content = `
    <div class="email-body">
      <h2>💊 New Prescription</h2>
      <p>Dear ${patientName},</p>
      <p>Dr. ${doctorName} has created a new prescription for you with ${medicationCount} medication(s).</p>
      
      <p>Please review your prescription and follow the instructions carefully.</p>
      
      <center>
        <a href="${actionUrl}" class="button">View Prescription</a>
      </center>
      
      <div class="divider"></div>
      <p style="font-size: 14px; color: #666;"><strong>Important:</strong> Take medications as prescribed. Contact your doctor if you experience any side effects.</p>
    </div>
  `;
  
  return getBaseTemplate(content);
}
```

#### Template: Document Uploaded
```javascript
function getDocumentUploadedTemplate(data) {
  const { patientName, uploaderName, documentTitle, documentType, actionUrl } = data;
  
  const content = `
    <div class="email-body">
      <h2>📄 New Medical Document</h2>
      <p>Dear ${patientName},</p>
      <p>${uploaderName} has uploaded a new medical document to your records:</p>
      
      <div class="info-box">
        <p><strong>Document:</strong> ${documentTitle}</p>
        <p><strong>Type:</strong> ${documentType}</p>
      </div>
      
      <center>
        <a href="${actionUrl}" class="button">View Document</a>
      </center>
    </div>
  `;
  
  return getBaseTemplate(content);
}
```

#### Template: Consultation Created
```javascript
function getConsultationCreatedTemplate(data) {
  const { patientName, doctorName, consultationDate, diagnosis, actionUrl } = data;
  
  const content = `
    <div class="email-body">
      <h2>📝 Consultation Record</h2>
      <p>Dear ${patientName},</p>
      <p>Dr. ${doctorName} has completed your consultation and added the details to your medical records.</p>
      
      <div class="info-box">
        <p><strong>Date:</strong> ${new Date(consultationDate).toLocaleDateString()}</p>
        ${diagnosis ? `<p><strong>Diagnosis:</strong> ${diagnosis}</p>` : ''}
      </div>
      
      <p>You can view the complete consultation notes in your medical records.</p>
      
      <center>
        <a href="${actionUrl}" class="button">View Consultation</a>
      </center>
    </div>
  `;
  
  return getBaseTemplate(content);
}
```

### 4. Template Generator Function

```javascript
// templates/email/index.js

const { getBaseTemplate } = require('./base.template');
const { getAppointmentConfirmedTemplate } = require('./appointmentConfirmed.template');
const { getAppointmentReminderTemplate } = require('./appointmentReminder.template');
const { getAppointmentCancelledTemplate } = require('./appointmentCancelled.template');
const { getNewMessageTemplate } = require('./newMessage.template');
const { getReferralReceivedTemplate } = require('./referralReceived.template');
const { getReferralScheduledTemplate } = require('./referralScheduled.template');
const { getPrescriptionCreatedTemplate } = require('./prescriptionCreated.template');
const { getDocumentUploadedTemplate } = require('./documentUploaded.template');
const { getConsultationCreatedTemplate } = require('./consultationCreated.template');

async function generateEmailTemplate(notification) {
  const data = await prepareTemplateData(notification);
  
  switch (notification.type) {
    case 'appointment_confirmed':
      return getAppointmentConfirmedTemplate(data);
    case 'appointment_reminder':
      return getAppointmentReminderTemplate(data);
    case 'appointment_cancelled':
      return getAppointmentCancelledTemplate(data);
    case 'new_message':
      return getNewMessageTemplate(data);
    case 'referral_received':
      return getReferralReceivedTemplate(data);
    case 'referral_scheduled':
      return getReferralScheduledTemplate(data);
    case 'prescription_created':
      return getPrescriptionCreatedTemplate(data);
    case 'document_uploaded':
      return getDocumentUploadedTemplate(data);
    case 'consultation_created':
      return getConsultationCreatedTemplate(data);
    default:
      // Generic template
      return getBaseTemplate(`
        <div class="email-body">
          <h2>${notification.title}</h2>
          <p>${notification.body}</p>
          ${notification.actionUrl ? `<center><a href="${notification.actionUrl}" class="button">View Details</a></center>` : ''}
        </div>
      `);
  }
}

async function prepareTemplateData(notification) {
  // Fetch related data based on notification type
  const data = {
    actionUrl: `${process.env.FRONTEND_URL}${notification.actionUrl}`
  };
  
  // Fetch user details
  const user = await getUserById(notification.userId);
  data.patientName = `${user.firstName} ${user.lastName}`;
  
  // Fetch resource-specific data
  if (notification.relatedResource) {
    const { resourceType, resourceId } = notification.relatedResource;
    
    switch (resourceType) {
      case 'appointment':
        const appointment = await getAppointmentById(resourceId);
        const doctor = await getDoctorById(appointment.doctorId);
        data.doctorName = `${doctor.firstName} ${doctor.lastName}`;
        data.appointmentDate = appointment.appointmentDate;
        data.appointmentTime = appointment.time;
        data.clinicName = doctor.clinicName;
        data.clinicAddress = doctor.clinicAddress;
        break;
        
      case 'referral':
        const referral = await getReferralById(resourceId);
        const referring = await getDoctorById(referral.referringDoctorId);
        const target = await getDoctorById(referral.targetDoctorId);
        data.referringDoctorName = `${referring.firstName} ${referring.lastName}`;
        data.doctorName = `${target.firstName} ${target.lastName}`;
        data.specialty = referral.specialty;
        data.urgency = referral.urgency;
        data.reason = referral.reason;
        break;
        
      // Add other resource types...
    }
  }
  
  return data;
}

module.exports = { generateEmailTemplate };
```

### 5. Additional Event Handlers

Add event handlers for remaining notification types:

#### Consultation Created
```javascript
async function handleConsultationCreated(event) {
  const { consultationId, patientId, doctorId } = event;
  
  const doctor = await getDoctorById(doctorId);
  const consultation = await getConsultationById(consultationId);
  
  await createNotification({
    userId: patientId,
    userType: 'patient',
    title: 'Consultation Record Created',
    body: `Dr. ${doctor.firstName} ${doctor.lastName} has added your consultation notes to your medical records.`,
    type: 'consultation_created',
    relatedResource: {
      resourceType: 'consultation',
      resourceId: consultationId
    },
    actionUrl: `/consultations/${consultationId}`,
    priority: 'medium'
  });
}
```

#### Prescription Created
```javascript
async function handlePrescriptionCreated(event) {
  const { prescriptionId, patientId, doctorId, medicationCount } = event;
  
  const doctor = await getDoctorById(doctorId);
  
  await createNotification({
    userId: patientId,
    userType: 'patient',
    title: 'New Prescription',
    body: `Dr. ${doctor.firstName} ${doctor.lastName} has prescribed ${medicationCount} medication(s) for you.`,
    type: 'prescription_created',
    relatedResource: {
      resourceType: 'prescription',
      resourceId: prescriptionId
    },
    actionUrl: `/prescriptions/${prescriptionId}`,
    priority: 'high'
  });
}
```

#### Document Uploaded
```javascript
async function handleDocumentUploaded(event) {
  const { documentId, patientId, uploadedBy, uploaderType, documentTitle, documentType } = event;
  
  const uploader = await getUserById(uploadedBy);
  
  await createNotification({
    userId: patientId,
    userType: 'patient',
    title: 'New Document Uploaded',
    body: `${uploader.firstName} ${uploader.lastName} uploaded: ${documentTitle}`,
    type: 'document_uploaded',
    relatedResource: {
      resourceType: 'document',
      resourceId: documentId
    },
    actionUrl: `/documents/${documentId}`,
    priority: 'medium'
  });
}
```

### 6. Update Kafka Consumer

Add new topics to consumer (in PROMPT_10A's consumer file):

```javascript
await consumer.subscribe({ 
  topics: [
    // ... existing topics from 10A
    'consultation.created',
    'prescription.created',
    'document.uploaded'
  ]
});

// Add to handleEvent function:
case 'consultation.created':
  await handleConsultationCreated(event);
  break;
case 'prescription.created':
  await handlePrescriptionCreated(event);
  break;
case 'document.uploaded':
  await handleDocumentUploaded(event);
  break;
```

### 7. Update createNotification Function

Integrate email sending into the core notification function (update from PROMPT_10A):

```javascript
async function createNotification(notificationData) {
  try {
    const preferences = await getNotificationPreferences(notificationData.userId);
    const typePrefs = getPreferencesForType(preferences, notificationData.type);
    
    // Check quiet hours
    if (isQuietHours(preferences)) {
      notificationData.channels.push.enabled = false; // Disable push during quiet hours
    }
    
    const notification = await Notification.create(notificationData);
    
    // Send Push Notification (from PROMPT_10A)
    if (typePrefs.push && notificationData.channels.push.enabled) {
      const pushResult = await sendPushNotification(notificationData.userId, notification);
      notification.channels.push = { ...notification.channels.push, ...pushResult };
    }
    
    // Send Email (NEW in PROMPT_10B)
    if (typePrefs.email && notificationData.channels.email.enabled) {
      const emailResult = await sendEmailNotification(notificationData.userId, notification);
      notification.channels.email = { ...notification.channels.email, ...emailResult };
    }
    
    await notification.save();
    
    // In-app notification via Socket.IO (from PROMPT_10A)
    if (typePrefs.inApp) {
      const io = require('../socket').getIO();
      io.to(notificationData.userId.toString()).emit('new_notification', {
        notificationId: notification._id,
        title: notification.title,
        body: notification.body,
        type: notification.type,
        actionUrl: notification.actionUrl,
        priority: notification.priority,
        createdAt: notification.createdAt
      });
    }
    
    return notification;
  } catch (error) {
    console.error('Error creating notification:', error);
    throw error;
  }
}
```

### 8. Quiet Hours Implementation

```javascript
function isQuietHours(preferences) {
  if (!preferences.quietHours || !preferences.quietHours.enabled) {
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
```

### 9. Update Preferences Endpoint

Add quiet hours to preferences update (extends PROMPT_10A):

```javascript
// In PUT /api/v1/notifications/preferences endpoint

const { preferences, quietHours } = req.body;

const updated = await NotificationPreference.findOneAndUpdate(
  { userId: req.user.userId },
  {
    preferences: preferences,
    quietHours: quietHours
  },
  { new: true, upsert: true }
);
```

## Deliverables
1. ✅ Nodemailer setup and configuration
2. ✅ Base email template with branding
3. ✅ 9+ HTML email templates (all notification types)
4. ✅ Template generator function
5. ✅ Email sending service
6. ✅ Additional event handlers (consultation, prescription, document)
7. ✅ Quiet hours implementation
8. ✅ Updated Kafka consumer with new topics
9. ✅ Integration of email delivery into core notification flow
10. ✅ Email delivery status tracking

## Testing Checklist
- [ ] Nodemailer connection works
- [ ] All email templates render correctly
- [ ] Appointment confirmed email sent
- [ ] Appointment reminder email sent
- [ ] Referral email to doctor
- [ ] Prescription email to patient
- [ ] Document uploaded email
- [ ] Quiet hours respected (no push, email still sent)
- [ ] User preferences control email delivery
- [ ] Email delivery failures logged
- [ ] All templates have correct links

## Notes
- Test emails with real Gmail account
- Verify all templates render well on mobile
- Ensure action URLs point to correct frontend routes
- Email delivery may be slower than push notifications (acceptable)
- Failed email delivery should not break notification creation

---

**Time Estimate:** 2-3 hours

**Dependencies:** 
- PROMPT_10A must be completed first
- All email templates need frontend routes to be defined

**Next Step:** After this prompt is complete, proceed to PROMPT_11 (Service Audit)
