# PROMPT 10A: Notification Service - Core + Push Notifications

## Objective
Build the core notification service with OneSignal push notifications, Kafka event consumers, and in-app notifications via Socket.IO. This establishes the notification infrastructure and real-time push delivery.

## Requirements

### 1. Database Schemas

#### Notification Model
```javascript
{
  userId: ObjectId (required, indexed),
  userType: String (enum: ['patient', 'doctor', 'admin'], required),
  
  // Notification Content
  title: String (required),
  body: String (required),
  type: String (enum: [
    'appointment_confirmed',
    'appointment_rejected',
    'appointment_reminder',
    'appointment_cancelled',
    'new_message',
    'referral_received',
    'referral_scheduled',
    'consultation_created',
    'prescription_created',
    'document_uploaded',
    'system_alert'
  ], required),
  
  // Related Resource
  relatedResource: {
    resourceType: String, // 'appointment', 'message', 'referral', etc.
    resourceId: ObjectId
  },
  
  // Delivery Channels
  channels: {
    push: {
      enabled: Boolean (default: true),
      sent: Boolean (default: false),
      sentAt: Date,
      oneSignalId: String,
      error: String
    },
    email: {
      enabled: Boolean (default: true),
      sent: Boolean (default: false),
      sentAt: Date,
      error: String
    },
    inApp: {
      enabled: Boolean (default: true),
      delivered: Boolean (default: true)
    }
  },
  
  // Status
  isRead: Boolean (default: false),
  readAt: Date,
  
  // Priority
  priority: String (enum: ['low', 'medium', 'high', 'urgent'], default: 'medium'),
  
  // Actions (deep links)
  actionUrl: String, // Frontend route
  actionData: Object, // Additional data for action
  
  // Scheduling
  scheduledFor: Date, // If notification should be sent later
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isRead: 1 });
notificationSchema.index({ type: 1, createdAt: -1 });
notificationSchema.index({ scheduledFor: 1 });
```

#### NotificationPreference Model
```javascript
{
  userId: ObjectId (required, unique, indexed),
  
  preferences: {
    appointmentConfirmed: {
      push: Boolean (default: true),
      email: Boolean (default: true),
      inApp: Boolean (default: true)
    },
    appointmentReminder: {
      push: Boolean (default: true),
      email: Boolean (default: true),
      inApp: Boolean (default: true)
    },
    appointmentCancelled: {
      push: Boolean (default: true),
      email: Boolean (default: true),
      inApp: Boolean (default: true)
    },
    newMessage: {
      push: Boolean (default: true),
      email: Boolean (default: false),
      inApp: Boolean (default: true)
    },
    referral: {
      push: Boolean (default: true),
      email: Boolean (default: true),
      inApp: Boolean (default: true)
    },
    prescription: {
      push: Boolean (default: true),
      email: Boolean (default: true),
      inApp: Boolean (default: true)
    },
    systemAlert: {
      push: Boolean (default: true),
      email: Boolean (default: true),
      inApp: Boolean (default: true)
    }
  },
  
  // Device Registration (for push)
  devices: [{
    oneSignalPlayerId: String,
    deviceType: String, // 'mobile', 'web'
    platform: String, // 'android', 'ios', 'web'
    registeredAt: Date
  }],
  
  createdAt: Date,
  updatedAt: Date
}
```

### 2. OneSignal Integration

#### Setup Configuration
```javascript
const OneSignal = require('onesignal-node');

const client = new OneSignal.Client({
  userAuthKey: process.env.ONESIGNAL_USER_AUTH_KEY,
  app: {
    appAuthKey: process.env.ONESIGNAL_REST_API_KEY,
    appId: process.env.ONESIGNAL_APP_ID
  }
});

module.exports = { oneSignalClient: client };
```

#### Environment Variables
```
ONESIGNAL_APP_ID=your_app_id
ONESIGNAL_REST_API_KEY=your_rest_api_key
ONESIGNAL_USER_AUTH_KEY=your_user_auth_key
```

#### Send Push Notification Helper
```javascript
// services/pushNotification.service.js

async function sendPushNotification(userId, notification) {
  try {
    // Get user's OneSignal player IDs from preferences
    const preferences = await NotificationPreference.findOne({ userId });
    
    if (!preferences || !preferences.devices || preferences.devices.length === 0) {
      console.log(`No devices registered for user ${userId}`);
      return { sent: false, error: 'No devices registered' };
    }
    
    const playerIds = preferences.devices.map(d => d.oneSignalPlayerId);
    
    const notificationObj = {
      contents: {
        en: notification.body
      },
      headings: {
        en: notification.title
      },
      data: {
        type: notification.type,
        resourceType: notification.relatedResource?.resourceType,
        resourceId: notification.relatedResource?.resourceId?.toString(),
        actionUrl: notification.actionUrl
      },
      include_player_ids: playerIds,
      priority: notification.priority === 'urgent' ? 10 : 5,
      android_channel_id: notification.priority === 'urgent' ? 'urgent' : 'default',
      ios_sound: notification.priority === 'urgent' ? 'urgent.wav' : 'default'
    };
    
    const response = await oneSignalClient.createNotification(notificationObj);
    
    console.log('Push notification sent:', response.body);
    
    return {
      sent: true,
      oneSignalId: response.body.id,
      sentAt: new Date()
    };
  } catch (error) {
    console.error('Push notification error:', error);
    return {
      sent: false,
      error: error.message
    };
  }
}

module.exports = { sendPushNotification };
```

### 3. Kafka Event Consumers

#### Setup Kafka Consumer
```javascript
// kafka/notificationConsumer.js

const { Kafka } = require('kafkajs');

const kafka = new Kafka({
  clientId: 'notification-service',
  brokers: [process.env.KAFKA_BROKER || 'localhost:9092']
});

const consumer = kafka.consumer({ groupId: 'notification-service-group' });

async function startNotificationConsumer() {
  await consumer.connect();
  
  // Subscribe to all relevant topics
  await consumer.subscribe({ 
    topics: [
      'appointment.confirmed',
      'appointment.rejected',
      'appointment.cancelled',
      'appointment.reminder_scheduled',
      'message.sent',
      'referral.created',
      'referral.scheduled'
    ]
  });
  
  console.log('Notification consumer started, listening to events...');
  
  await consumer.run({
    eachMessage: async ({ topic, partition, message }) => {
      try {
        const event = JSON.parse(message.value.toString());
        console.log(`Received event: ${topic}`, event);
        
        await handleEvent(topic, event);
      } catch (error) {
        console.error(`Error processing event ${topic}:`, error);
      }
    }
  });
}

async function handleEvent(topic, event) {
  switch (topic) {
    case 'appointment.confirmed':
      await handleAppointmentConfirmed(event);
      break;
    case 'appointment.rejected':
      await handleAppointmentRejected(event);
      break;
    case 'appointment.cancelled':
      await handleAppointmentCancelled(event);
      break;
    case 'appointment.reminder_scheduled':
      await handleAppointmentReminder(event);
      break;
    case 'message.sent':
      await handleNewMessage(event);
      break;
    case 'referral.created':
      await handleReferralReceived(event);
      break;
    case 'referral.scheduled':
      await handleReferralScheduled(event);
      break;
    default:
      console.log(`No handler for topic: ${topic}`);
  }
}

module.exports = { startNotificationConsumer };
```

### 4. Event Handlers

#### Appointment Confirmed
```javascript
async function handleAppointmentConfirmed(event) {
  const { appointmentId, patientId, doctorId, appointmentDate, appointmentTime } = event;
  
  try {
    // Fetch appointment details
    const appointment = await getAppointmentById(appointmentId);
    const doctor = await getDoctorById(doctorId);
    
    // Notify Patient
    await createNotification({
      userId: patientId,
      userType: 'patient',
      title: 'Appointment Confirmed',
      body: `Your appointment with Dr. ${doctor.firstName} ${doctor.lastName} on ${new Date(appointmentDate).toLocaleDateString()} at ${appointmentTime} has been confirmed.`,
      type: 'appointment_confirmed',
      relatedResource: {
        resourceType: 'appointment',
        resourceId: appointmentId
      },
      actionUrl: `/appointments/${appointmentId}`,
      priority: 'high'
    });
    
    console.log(`Appointment confirmed notification sent to patient ${patientId}`);
  } catch (error) {
    console.error('Error handling appointment confirmed:', error);
  }
}
```

#### Appointment Rejected
```javascript
async function handleAppointmentRejected(event) {
  const { appointmentId, patientId, doctorId, rejectionReason } = event;
  
  const doctor = await getDoctorById(doctorId);
  
  await createNotification({
    userId: patientId,
    userType: 'patient',
    title: 'Appointment Request Declined',
    body: `Dr. ${doctor.firstName} ${doctor.lastName} was unable to confirm your appointment. ${rejectionReason || 'Please try another time slot.'}`,
    type: 'appointment_rejected',
    relatedResource: {
      resourceType: 'appointment',
      resourceId: appointmentId
    },
    actionUrl: `/appointments/${appointmentId}`,
    priority: 'high'
  });
}
```

#### Appointment Cancelled
```javascript
async function handleAppointmentCancelled(event) {
  const { appointmentId, patientId, doctorId, cancelledBy, cancellationReason } = event;
  
  const doctor = await getDoctorById(doctorId);
  
  // Notify the other party (if patient cancelled, notify doctor; if doctor cancelled, notify patient)
  const recipientId = cancelledBy === 'patient' ? doctorId : patientId;
  const recipientType = cancelledBy === 'patient' ? 'doctor' : 'patient';
  
  const cancellerName = cancelledBy === 'patient' ? 'Patient' : `Dr. ${doctor.firstName} ${doctor.lastName}`;
  
  await createNotification({
    userId: recipientId,
    userType: recipientType,
    title: 'Appointment Cancelled',
    body: `${cancellerName} cancelled the appointment. ${cancellationReason || ''}`,
    type: 'appointment_cancelled',
    relatedResource: {
      resourceType: 'appointment',
      resourceId: appointmentId
    },
    actionUrl: `/appointments`,
    priority: 'high'
  });
}
```

#### Appointment Reminder (24 hours before)
```javascript
async function handleAppointmentReminder(event) {
  const { appointmentId, patientId, doctorId, appointmentDate, appointmentTime } = event;
  
  const doctor = await getDoctorById(doctorId);
  const appointment = await getAppointmentById(appointmentId);
  
  // Create scheduled notification (to be sent 24 hours before)
  const reminderTime = new Date(appointmentDate);
  reminderTime.setHours(reminderTime.getHours() - 24);
  
  await createNotification({
    userId: patientId,
    userType: 'patient',
    title: 'Appointment Reminder',
    body: `Reminder: You have an appointment with Dr. ${doctor.firstName} ${doctor.lastName} tomorrow at ${appointmentTime}.`,
    type: 'appointment_reminder',
    relatedResource: {
      resourceType: 'appointment',
      resourceId: appointmentId
    },
    scheduledFor: reminderTime,
    actionUrl: `/appointments/${appointmentId}`,
    priority: 'high'
  });
  
  console.log(`Appointment reminder scheduled for ${reminderTime}`);
}
```

#### New Message (Only if User Offline)
```javascript
async function handleNewMessage(event) {
  const { messageId, conversationId, senderId, receiverId, receiverType, content } = event;
  
  try {
    // Check if receiver is online (via Socket.IO or Redis)
    const isOnline = await isUserOnline(receiverId);
    
    if (!isOnline) {
      const sender = await getUserById(senderId);
      
      await createNotification({
        userId: receiverId,
        userType: receiverType,
        title: `New message from ${sender.firstName} ${sender.lastName}`,
        body: content.substring(0, 100), // First 100 chars
        type: 'new_message',
        relatedResource: {
          resourceType: 'message',
          resourceId: messageId
        },
        actionUrl: `/messages/${conversationId}`,
        priority: 'medium'
      });
    }
  } catch (error) {
    console.error('Error handling new message notification:', error);
  }
}
```

#### Referral Received
```javascript
async function handleReferralReceived(event) {
  const { referralId, targetDoctorId, referringDoctorId, patientId, urgency } = event;
  
  const referringDoctor = await getDoctorById(referringDoctorId);
  const patient = await getPatientById(patientId);
  
  await createNotification({
    userId: targetDoctorId,
    userType: 'doctor',
    title: 'New Referral Received',
    body: `Dr. ${referringDoctor.firstName} ${referringDoctor.lastName} referred patient ${patient.firstName} ${patient.lastName} to you.`,
    type: 'referral_received',
    relatedResource: {
      resourceType: 'referral',
      resourceId: referralId
    },
    actionUrl: `/referrals/${referralId}`,
    priority: urgency === 'urgent' ? 'urgent' : 'high'
  });
}
```

#### Referral Scheduled
```javascript
async function handleReferralScheduled(event) {
  const { referralId, patientId, targetDoctorId, appointmentDate } = event;
  
  const doctor = await getDoctorById(targetDoctorId);
  
  await createNotification({
    userId: patientId,
    userType: 'patient',
    title: 'Referral Appointment Scheduled',
    body: `Your referral appointment with Dr. ${doctor.firstName} ${doctor.lastName} has been scheduled for ${new Date(appointmentDate).toLocaleDateString()}.`,
    type: 'referral_scheduled',
    relatedResource: {
      resourceType: 'referral',
      resourceId: referralId
    },
    actionUrl: `/referrals/${referralId}`,
    priority: 'high'
  });
}
```

### 5. Core Notification Function

#### Create and Send Notification
```javascript
// services/notification.service.js

async function createNotification(notificationData) {
  try {
    // Get user preferences
    const preferences = await getNotificationPreferences(notificationData.userId);
    
    // Get type-specific preferences
    const typePrefs = getPreferencesForType(preferences, notificationData.type);
    
    // Create notification in database
    const notification = await Notification.create(notificationData);
    
    const results = {};
    
    // Send Push Notification (if enabled in preferences)
    if (typePrefs.push && notificationData.channels.push.enabled) {
      const pushResult = await sendPushNotification(
        notificationData.userId, 
        notification
      );
      notification.channels.push = { ...notification.channels.push, ...pushResult };
    }
    
    // Email will be handled in PROMPT_10B
    
    // Save notification with delivery status
    await notification.save();
    
    // Emit in-app notification via Socket.IO (if user online)
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

function getPreferencesForType(preferences, type) {
  const typeMap = {
    'appointment_confirmed': preferences.preferences.appointmentConfirmed,
    'appointment_rejected': preferences.preferences.appointmentConfirmed,
    'appointment_reminder': preferences.preferences.appointmentReminder,
    'appointment_cancelled': preferences.preferences.appointmentCancelled,
    'new_message': preferences.preferences.newMessage,
    'referral_received': preferences.preferences.referral,
    'referral_scheduled': preferences.preferences.referral,
    'system_alert': preferences.preferences.systemAlert
  };
  
  return typeMap[type] || { push: true, email: true, inApp: true };
}

async function getNotificationPreferences(userId) {
  let preferences = await NotificationPreference.findOne({ userId });
  
  if (!preferences) {
    // Create default preferences
    preferences = await NotificationPreference.create({ userId });
  }
  
  return preferences;
}

module.exports = { createNotification };
```

### 6. REST API Endpoints

#### A. Get User Notifications
**Endpoint:** `GET /api/v1/notifications`

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?isRead=false
&type=appointment_confirmed
&page=1
&limit=20
```

**Process:**
1. Authenticate user
2. Get notifications for user
3. Filter by isRead, type (if provided)
4. Sort by createdAt (desc)
5. Paginate results
6. Return list with unread count

**Response:**
```json
{
  "success": true,
  "data": {
    "notifications": [
      {
        "id": "...",
        "title": "Appointment Confirmed",
        "body": "Your appointment with Dr. Sarah Smith...",
        "type": "appointment_confirmed",
        "isRead": false,
        "priority": "high",
        "actionUrl": "/appointments/123",
        "createdAt": "2025-11-10T14:00:00Z"
      }
    ],
    "unreadCount": 5,
    "pagination": {
      "currentPage": 1,
      "totalPages": 2,
      "totalNotifications": 25
    }
  }
}
```

#### B. Mark Notification as Read
**Endpoint:** `PUT /api/v1/notifications/:notificationId/read`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user
2. Find notification and verify ownership
3. Update isRead = true, readAt = now
4. Return success

#### C. Mark All as Read
**Endpoint:** `PUT /api/v1/notifications/mark-all-read`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user
2. Update all unread notifications for user
3. Set isRead = true
4. Return count of marked notifications

#### D. Get Unread Count
**Endpoint:** `GET /api/v1/notifications/unread-count`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "unreadCount": 5
  }
}
```

#### E. Get Notification Preferences
**Endpoint:** `GET /api/v1/notifications/preferences`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user
2. Get or create preferences
3. Return preferences object

**Response:**
```json
{
  "success": true,
  "data": {
    "preferences": {
      "appointmentConfirmed": {
        "push": true,
        "email": true,
        "inApp": true
      },
      "newMessage": {
        "push": true,
        "email": false,
        "inApp": true
      }
    },
    "devices": [
      {
        "oneSignalPlayerId": "player_123",
        "deviceType": "mobile",
        "platform": "android",
        "registeredAt": "2025-11-01T10:00:00Z"
      }
    ]
  }
}
```

#### F. Update Notification Preferences
**Endpoint:** `PUT /api/v1/notifications/preferences`

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "preferences": {
    "appointmentConfirmed": {
      "push": true,
      "email": true,
      "inApp": true
    },
    "newMessage": {
      "push": true,
      "email": false,
      "inApp": true
    }
  }
}
```

**Process:**
1. Authenticate user
2. Validate preferences structure
3. Update preferences
4. Return updated preferences

#### G. Register Device for Push Notifications
**Endpoint:** `POST /api/v1/notifications/register-device`

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "oneSignalPlayerId": "player_id_from_onesignal",
  "deviceType": "mobile",
  "platform": "android"
}
```

**Process:**
1. Authenticate user
2. Get or create notification preferences
3. Check if device already registered
4. Add device to preferences.devices array
5. Return success

**Response:**
```json
{
  "success": true,
  "message": "Device registered successfully",
  "data": {
    "oneSignalPlayerId": "player_id_from_onesignal",
    "registeredAt": "2025-11-10T14:00:00Z"
  }
}
```

#### H. Unregister Device
**Endpoint:** `DELETE /api/v1/notifications/devices/:playerId`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user
2. Remove device from preferences.devices
3. Return success

### 7. Background Job: Process Scheduled Notifications

**Scheduled Task:** Runs every minute

```javascript
// jobs/processScheduledNotifications.js

const cron = require('node-cron');

function startScheduledNotificationJob() {
  // Runs every minute
  cron.schedule('* * * * *', async () => {
    try {
      await processScheduledNotifications();
    } catch (error) {
      console.error('Error in scheduled notification job:', error);
    }
  });
  
  console.log('Scheduled notification job started');
}

async function processScheduledNotifications() {
  const now = new Date();
  
  // Find notifications scheduled for now or earlier that haven't been sent
  const scheduled = await Notification.find({
    scheduledFor: { $lte: now },
    'channels.push.sent': false
  });
  
  console.log(`Processing ${scheduled.length} scheduled notifications`);
  
  for (const notification of scheduled) {
    // Send push notification
    const pushResult = await sendPushNotification(notification.userId, notification);
    
    notification.channels.push = {
      ...notification.channels.push,
      ...pushResult
    };
    
    await notification.save();
  }
}

module.exports = { startScheduledNotificationJob };
```

### 8. Socket.IO Integration for In-App Notifications

**Server Setup:**
```javascript
// socket.js

const socketIO = require('socket.io');
const jwt = require('jsonwebtoken');

let io;

function initializeSocket(server) {
  io = socketIO(server, {
    cors: {
      origin: process.env.FRONTEND_URL,
      credentials: true
    }
  });
  
  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      socket.userId = decoded.userId;
      socket.userRole = decoded.role;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });
  
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.userId}`);
    
    // User joins their own room (for targeted notifications)
    socket.join(socket.userId);
    
    socket.on('disconnect', () => {
      console.log(`User disconnected: ${socket.userId}`);
    });
  });
  
  return io;
}

function getIO() {
  if (!io) {
    throw new Error('Socket.IO not initialized');
  }
  return io;
}

module.exports = { initializeSocket, getIO };
```

## API Endpoints Summary
```
GET    /api/v1/notifications
GET    /api/v1/notifications/unread-count
PUT    /api/v1/notifications/:notificationId/read
PUT    /api/v1/notifications/mark-all-read
GET    /api/v1/notifications/preferences
PUT    /api/v1/notifications/preferences
POST   /api/v1/notifications/register-device
DELETE /api/v1/notifications/devices/:playerId
```

## Deliverables
1. ✅ Notification and NotificationPreference models
2. ✅ OneSignal integration and configuration
3. ✅ Push notification delivery system
4. ✅ Kafka event consumers (7 topics)
5. ✅ Event handlers for appointments, messages, referrals
6. ✅ REST API endpoints (8 endpoints)
7. ✅ Device registration and management
8. ✅ User preference management
9. ✅ Background job for scheduled notifications
10. ✅ Socket.IO in-app notifications
11. ✅ Multi-channel delivery logic (push + in-app)

## Testing Checklist
- [ ] OneSignal setup works
- [ ] Device registration successful
- [ ] Push notification sent and received
- [ ] Kafka events trigger notifications
- [ ] Appointment confirmed notification works
- [ ] Appointment reminder scheduled correctly
- [ ] Message notification (offline user only)
- [ ] Referral notification to doctor
- [ ] User preferences respected
- [ ] In-app notification via Socket.IO
- [ ] Unread count accurate
- [ ] Mark as read works
- [ ] Scheduled notifications processed

## Notes
- Email notifications will be implemented in PROMPT_10B
- Focus on getting push notifications working first
- Test with real OneSignal account
- Ensure Kafka consumers are running
- Background job should run continuously

---

**Time Estimate:** 3-4 hours

**Dependencies:** 
- Kafka infrastructure (PROMPT_1C)
- Socket.IO from messaging (PROMPT_9)
- User/Doctor/Patient models (PROMPT_2A, PROMPT_3)

**Next Step:** After this prompt is complete, proceed to PROMPT_10B (Email Notifications + Advanced Features)
