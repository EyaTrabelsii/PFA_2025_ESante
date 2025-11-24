# PROMPT 9: Service Messaging - Communication System

## Objective
Build the real-time messaging system using Socket.IO for both patient-doctor and doctor-doctor communication with message history, typing indicators, and Kafka integration.

## Requirements

### 1. Database Schemas

#### Conversation Model
```javascript
{
  participants: [ObjectId] (required, min: 2, max: 2), // Two users
  participantTypes: [{
    userId: ObjectId,
    userType: String (enum: ['patient', 'doctor'])
  }],
  
  conversationType: String (enum: ['patient_doctor', 'doctor_doctor'], required),
  
  // Last Message Info (for list view)
  lastMessage: {
    content: String,
    senderId: ObjectId,
    timestamp: Date,
    isRead: Boolean
  },
  
  // Read Status
  unreadCount: {
    userId1: Number (default: 0),
    userId2: Number (default: 0)
  },
  
  // Metadata
  isActive: Boolean (default: true),
  isArchived: Boolean (default: false),
  
  createdAt: Date,
  updatedAt: Date
}

// Compound unique index to prevent duplicate conversations
conversationSchema.index({ participants: 1 }, { unique: true });
```

#### Message Model
```javascript
{
  conversationId: ObjectId (reference to Conversation, required, indexed),
  
  senderId: ObjectId (required),
  senderType: String (enum: ['patient', 'doctor'], required),
  
  receiverId: ObjectId (required),
  receiverType: String (enum: ['patient', 'doctor'], required),
  
  // Message Content
  messageType: String (enum: ['text', 'image', 'document', 'system'], default: 'text'),
  content: String (required for text),
  
  // File attachments (if type is image/document)
  attachment: {
    fileName: String,
    fileSize: Number,
    mimeType: String,
    s3Key: String,
    s3Url: String
  },
  
  // Status
  isRead: Boolean (default: false),
  readAt: Date,
  isDelivered: Boolean (default: false),
  deliveredAt: Date,
  
  // Edited/Deleted
  isEdited: Boolean (default: false),
  editedAt: Date,
  isDeleted: Boolean (default: false),
  deletedAt: Date,
  deletedBy: ObjectId,
  
  // Metadata
  metadata: Object, // Additional data (e.g., medical context, referral link)
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
messageSchema.index({ conversationId: 1, createdAt: -1 });
messageSchema.index({ senderId: 1, createdAt: -1 });
messageSchema.index({ receiverId: 1, isRead: 1 });
```

### 2. Socket.IO Architecture

#### Server Setup
```javascript
const io = require('socket.io')(server, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true
  }
});

// Middleware: Authenticate socket connection
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
  
  // User joins their own room
  socket.join(socket.userId);
  
  // Handle events
  socket.on('send_message', handleSendMessage);
  socket.on('typing_start', handleTypingStart);
  socket.on('typing_stop', handleTypingStop);
  socket.on('mark_as_read', handleMarkAsRead);
  socket.on('disconnect', handleDisconnect);
});
```

#### Socket Events

**Client → Server:**
- `send_message`: Send new message
- `typing_start`: User started typing
- `typing_stop`: User stopped typing
- `mark_as_read`: Mark message as read
- `join_conversation`: Join specific conversation room

**Server → Client:**
- `new_message`: Receive new message
- `message_delivered`: Message delivery confirmation
- `message_read`: Message read confirmation
- `user_typing`: Other user is typing
- `user_stopped_typing`: Other user stopped typing
- `user_online`: User came online
- `user_offline`: User went offline

### 3. Core Features

#### A. Get or Create Conversation
**Endpoint:** `POST /api/v1/messages/conversations`

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "recipientId": "userId123",
  "recipientType": "doctor" // or "patient"
}
```

**Process:**
1. Authenticate user
2. Check if conversation already exists between users
3. If exists: Return existing conversation
4. If not: Create new conversation
5. Determine conversation type
6. Return conversation details

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "...",
    "conversationType": "patient_doctor",
    "recipient": {
      "id": "...",
      "name": "Dr. Sarah Smith",
      "type": "doctor",
      "profilePhoto": "...",
      "specialty": "Cardiology" // if doctor
    },
    "lastMessage": null,
    "unreadCount": 0
  }
}
```

#### B. Get User's Conversations (List)
**Endpoint:** `GET /api/v1/messages/conversations`

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?type=all (or 'patient_doctor', 'doctor_doctor')
&page=1
&limit=20
```

**Process:**
1. Authenticate user
2. Get conversations where user is participant
3. Filter by type (if specified)
4. Sort by lastMessage.timestamp (desc)
5. Populate other participant's info
6. Include unread count for user
7. Return list

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "conversationId": "...",
      "conversationType": "patient_doctor",
      "recipient": {
        "id": "...",
        "name": "Dr. Sarah Smith",
        "type": "doctor",
        "profilePhoto": "...",
        "isOnline": true
      },
      "lastMessage": {
        "content": "Thank you, Doctor",
        "timestamp": "2025-11-10T15:30:00Z",
        "senderId": "...",
        "isRead": true
      },
      "unreadCount": 0
    },
    {
      "conversationId": "...",
      "conversationType": "doctor_doctor",
      "recipient": {
        "id": "...",
        "name": "Dr. Michael Johnson",
        "type": "doctor",
        "profilePhoto": "...",
        "specialty": "Orthopedics",
        "isOnline": false
      },
      "lastMessage": {
        "content": "I have a referral question...",
        "timestamp": "2025-11-09T10:15:00Z",
        "senderId": "...",
        "isRead": false
      },
      "unreadCount": 3
    }
  ]
}
```

#### C. Get Conversation Messages (History)
**Endpoint:** `GET /api/v1/messages/conversations/:conversationId/messages`

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?page=1
&limit=50
&before=messageId (for pagination)
```

**Process:**
1. Authenticate user
2. Verify user is participant in conversation
3. Get messages for conversation
4. Sort by createdAt (desc for pagination, then reverse)
5. Paginate (load older messages)
6. Mark messages as delivered (if not already)
7. Return messages

**Response:**
```json
{
  "success": true,
  "data": {
    "conversationId": "...",
    "messages": [
      {
        "id": "...",
        "senderId": "...",
        "senderName": "Dr. Sarah Smith",
        "senderType": "doctor",
        "messageType": "text",
        "content": "Hello, how are you feeling today?",
        "isRead": true,
        "readAt": "2025-11-10T14:05:00Z",
        "createdAt": "2025-11-10T14:00:00Z",
        "isEdited": false
      },
      {
        "id": "...",
        "senderId": "...",
        "senderName": "John Doe",
        "senderType": "patient",
        "messageType": "text",
        "content": "Much better, thank you",
        "isRead": true,
        "readAt": "2025-11-10T14:10:00Z",
        "createdAt": "2025-11-10T14:05:00Z"
      }
    ],
    "pagination": {
      "hasMore": true,
      "nextPage": 2
    }
  }
}
```

#### D. Send Message (via Socket.IO)
**Socket Event:** `send_message`

**Payload:**
```javascript
{
  conversationId: "conversationId123",
  receiverId: "userId456",
  messageType: "text",
  content: "Hello, I have a question about my medication"
}
```

**Process:**
1. Validate socket is authenticated
2. Verify user is participant in conversation
3. Validate message content
4. Create message in database:
   - senderId: socket.userId
   - receiverId: from payload
   - isDelivered: false
   - isRead: false
5. Update conversation lastMessage
6. Publish Kafka event: `message.sent`
7. Emit to sender (confirmation):
   ```javascript
   socket.emit('message_sent', {
     tempId: payload.tempId, // Client-side temp ID
     messageId: savedMessage._id,
     timestamp: savedMessage.createdAt
   });
   ```
8. Emit to receiver (if online):
   ```javascript
   io.to(receiverId).emit('new_message', {
     messageId: savedMessage._id,
     conversationId: conversationId,
     senderId: senderId,
     senderName: "...",
     messageType: "text",
     content: "...",
     timestamp: savedMessage.createdAt
   });
   ```
9. If receiver online: Update isDelivered = true
10. If receiver offline: Send push notification
11. Increment unread count for receiver

#### E. Mark Messages as Read
**Socket Event:** `mark_as_read`

**Payload:**
```javascript
{
  conversationId: "conversationId123",
  messageIds: ["msgId1", "msgId2", "msgId3"]
}
```

**Process:**
1. Authenticate socket user
2. Verify user is participant
3. Update messages:
   - isRead: true
   - readAt: now
4. Reset unread count for user in conversation
5. Emit to sender:
   ```javascript
   io.to(senderId).emit('messages_read', {
     conversationId: conversationId,
     messageIds: messageIds,
     readBy: userId,
     readAt: now
   });
   ```

**Alternative REST Endpoint:**
```
PUT /api/v1/messages/conversations/:conversationId/mark-read
```

#### F. Typing Indicators
**Socket Events:** `typing_start` / `typing_stop`

**Payload:**
```javascript
{
  conversationId: "conversationId123",
  receiverId: "userId456"
}
```

**Process:**
1. Validate socket user
2. Emit to receiver only:
   ```javascript
   io.to(receiverId).emit('user_typing', {
     conversationId: conversationId,
     userId: socket.userId,
     userName: "Dr. Sarah Smith"
   });
   ```
3. For `typing_stop`: Emit `user_stopped_typing`

**Client Implementation:**
- Debounce: Stop typing after 3 seconds of inactivity

#### G. Send Message with Attachment
**Endpoint:** `POST /api/v1/messages/conversations/:conversationId/send-file`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request:**
```
file: File (image or document)
receiverId: String
messageType: "image" or "document"
caption: String (optional)
```

**Process:**
1. Authenticate user
2. Verify user is participant
3. Validate file (type, size max 10MB)
4. Upload to S3:
   ```
   messages/{conversationId}/{timestamp}_{filename}
   ```
5. Create message with attachment info
6. Emit via Socket.IO to receiver
7. Update conversation lastMessage
8. Return message details

#### H. Delete Message
**Endpoint:** `DELETE /api/v1/messages/:messageId`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user
2. Find message and verify sender
3. Soft delete: Set isDeleted = true
4. Update content to "Message deleted"
5. Emit via Socket.IO to receiver
6. Return success

**Business Rule:**
- Can only delete own messages
- Cannot delete after 24 hours (optional)

#### I. Get Unread Count
**Endpoint:** `GET /api/v1/messages/unread-count`

**Headers:**
```
Authorization: Bearer {token}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalUnread": 15,
    "byConversation": [
      {
        "conversationId": "...",
        "recipientName": "Dr. Sarah Smith",
        "unreadCount": 5
      }
    ]
  }
}
```

#### J. Search Messages
**Endpoint:** `GET /api/v1/messages/search`

**Headers:**
```
Authorization: Bearer {token}
```

**Query Parameters:**
```
?query=medication
&conversationId=specificConversation (optional)
```

**Process:**
1. Authenticate user
2. Search in messages where user is participant
3. Text search in content
4. Filter by conversation (if specified)
5. Return matching messages with context

### 4. Online Status Management

#### User Connects:
```javascript
socket.on('connection', (socket) => {
  // Mark user as online
  onlineUsers.set(socket.userId, socket.id);
  
  // Broadcast to contacts
  const contacts = await getContactsForUser(socket.userId);
  contacts.forEach(contactId => {
    io.to(contactId).emit('user_online', {
      userId: socket.userId,
      userName: "..."
    });
  });
});
```

#### User Disconnects:
```javascript
socket.on('disconnect', () => {
  onlineUsers.delete(socket.userId);
  
  // Broadcast offline status
  contacts.forEach(contactId => {
    io.to(contactId).emit('user_offline', {
      userId: socket.userId
    });
  });
});
```

#### Check if User is Online:
**Endpoint:** `GET /api/v1/messages/users/:userId/online-status`

### 5. Doctor-to-Doctor Features

#### Professional Context Messages
When doctors communicate about patients:
```javascript
{
  conversationId: "...",
  messageType: "text",
  content: "Regarding patient John Doe...",
  metadata: {
    patientId: "...",
    referralId: "..." // If discussing referral
  }
}
```

#### Quick Actions:
- Link to patient's medical records
- Share documents
- Create referral from conversation

### 6. Kafka Events Published

```javascript
// message.sent
{
  eventType: 'message.sent',
  messageId: '...',
  conversationId: '...',
  senderId: '...',
  receiverId: '...',
  messageType: 'text',
  timestamp: Date.now()
}

// message.delivered
{
  eventType: 'message.delivered',
  messageId: '...',
  deliveredAt: Date.now()
}

// message.read
{
  eventType: 'message.read',
  messageId: '...',
  readBy: '...',
  readAt: Date.now()
}
```

### 7. Push Notifications Integration

When user is offline:
```javascript
// Trigger push notification via OneSignal
if (!isUserOnline(receiverId)) {
  await sendPushNotification(receiverId, {
    title: senderName,
    message: content,
    data: {
      conversationId: conversationId,
      type: 'new_message'
    }
  });
}
```

### 8. Security & Validation
- Authenticate all socket connections
- Verify user is participant before sending
- Rate limiting on messages (prevent spam)
- Content moderation (optional)
- Cannot message users you haven't interacted with (patient can only message their doctors)

### 9. Message Retention Policy
- Keep all messages for compliance
- Soft delete only
- Archive old conversations (optional)

## API Endpoints Summary
```
POST   /api/v1/messages/conversations
GET    /api/v1/messages/conversations
GET    /api/v1/messages/conversations/:conversationId/messages
PUT    /api/v1/messages/conversations/:conversationId/mark-read
POST   /api/v1/messages/conversations/:conversationId/send-file
DELETE /api/v1/messages/:messageId
GET    /api/v1/messages/unread-count
GET    /api/v1/messages/search
GET    /api/v1/messages/users/:userId/online-status
```

## Socket.IO Events
```
Client → Server:
- send_message
- typing_start
- typing_stop
- mark_as_read
- join_conversation

Server → Client:
- new_message
- message_sent
- message_delivered
- messages_read
- user_typing
- user_stopped_typing
- user_online
- user_offline
```

## Deliverables
1. ✅ Conversation and Message models
2. ✅ Socket.IO server setup
3. ✅ Real-time messaging
4. ✅ Message history
5. ✅ Typing indicators
6. ✅ Read receipts
7. ✅ Online status
8. ✅ File attachments
9. ✅ Unread count
10. ✅ Search messages
11. ✅ Doctor-doctor communication
12. ✅ Push notifications integration
13. ✅ Kafka event publishers

## Testing Checklist
- [ ] Send message in real-time
- [ ] Receive message when online
- [ ] Offline user gets push notification
- [ ] Message history loads correctly
- [ ] Typing indicator works
- [ ] Read receipts work
- [ ] Unread count updates
- [ ] Online/offline status accurate
- [ ] File attachments work
- [ ] Doctor-doctor messaging
- [ ] Search messages works
- [ ] Message deletion works

---

**Next Step:** After this prompt is complete, proceed to PROMPT_10A (Notifications - Push Notifications)
