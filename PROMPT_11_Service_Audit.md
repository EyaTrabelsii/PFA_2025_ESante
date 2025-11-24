# PROMPT 11: Service Audit - Activity Logging System

## Objective
Build a comprehensive audit logging system that tracks all critical actions in the application for security, compliance, and admin oversight.

## Requirements

### 1. Database Schema

#### AuditLog Model
```javascript
{
  // Action Details
  action: String (required, indexed), // 'user.login', 'consultation.viewed', 'document.uploaded'
  actionCategory: String (enum: [
    'authentication',
    'user_management',
    'appointment',
    'consultation',
    'prescription',
    'document',
    'referral',
    'message',
    'system'
  ], required, indexed),
  
  // Actor (Who performed the action)
  performedBy: ObjectId (required, indexed),
  performedByType: String (enum: ['patient', 'doctor', 'admin', 'system'], required),
  performedByName: String,
  performedByEmail: String,
  
  // Target (What was affected)
  resourceType: String (indexed), // 'consultation', 'appointment', 'document', 'user'
  resourceId: ObjectId (indexed),
  resourceName: String,
  
  // Patient Context (for medical records)
  patientId: ObjectId (indexed), // If action involves patient data
  patientName: String,
  
  // Action Details
  description: String (required),
  severity: String (enum: ['info', 'warning', 'critical'], default: 'info', indexed),
  
  // Request Metadata
  ipAddress: String (indexed),
  userAgent: String,
  requestMethod: String, // GET, POST, PUT, DELETE
  requestUrl: String,
  
  // Data Changes (for update/delete actions)
  changes: Object, // What changed
  previousData: Object, // Data before change (if applicable)
  newData: Object, // Data after change
  
  // Status
  status: String (enum: ['success', 'failed', 'blocked'], default: 'success', indexed),
  errorMessage: String, // If failed
  
  // Compliance Flags
  isSecurityRelevant: Boolean (default: false, indexed), // Login attempts, access violations
  isComplianceRelevant: Boolean (default: false, indexed), // HIPAA/GDPR relevant
  requiresReview: Boolean (default: false, indexed), // Flagged for admin review
  
  // Metadata
  metadata: Object, // Additional context
  
  timestamp: Date (required, default: now, indexed),
  createdAt: Date
}

// Compound Indexes
auditLogSchema.index({ performedBy: 1, timestamp: -1 });
auditLogSchema.index({ patientId: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1, timestamp: -1 });
auditLogSchema.index({ actionCategory: 1, timestamp: -1 });
auditLogSchema.index({ severity: 1, timestamp: -1 });

// TTL Index (Optional: Auto-delete old logs after X days for non-critical logs)
// auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });
```

### 2. Audit Logging Helper Functions

#### Create Audit Log
```javascript
async function createAuditLog({
  action,
  actionCategory,
  performedBy,
  performedByType,
  resourceType = null,
  resourceId = null,
  patientId = null,
  description,
  severity = 'info',
  ipAddress = null,
  userAgent = null,
  requestMethod = null,
  requestUrl = null,
  changes = null,
  previousData = null,
  newData = null,
  status = 'success',
  errorMessage = null,
  metadata = {}
}) {
  try {
    // Get actor details
    const actor = await getUserById(performedBy);
    
    // Get patient details if applicable
    let patientName = null;
    if (patientId) {
      const patient = await getPatientById(patientId);
      patientName = patient ? `${patient.firstName} ${patient.lastName}` : null;
    }
    
    // Determine compliance flags
    const isSecurityRelevant = ['authentication', 'user_management'].includes(actionCategory);
    const isComplianceRelevant = ['consultation', 'prescription', 'document'].includes(actionCategory);
    
    const auditLog = await AuditLog.create({
      action,
      actionCategory,
      performedBy,
      performedByType,
      performedByName: actor ? `${actor.firstName} ${actor.lastName}` : 'System',
      performedByEmail: actor?.email,
      resourceType,
      resourceId,
      patientId,
      patientName,
      description,
      severity,
      ipAddress,
      userAgent,
      requestMethod,
      requestUrl,
      changes,
      previousData,
      newData,
      status,
      errorMessage,
      isSecurityRelevant,
      isComplianceRelevant,
      metadata,
      timestamp: new Date()
    });
    
    // Publish to Kafka for real-time monitoring
    await publishKafkaEvent('audit.log_created', {
      auditLogId: auditLog._id,
      action,
      severity,
      performedBy,
      timestamp: auditLog.timestamp
    });
    
    // Send alert if critical
    if (severity === 'critical') {
      await sendAdminAlert(auditLog);
    }
    
    return auditLog;
  } catch (error) {
    console.error('Audit log creation failed:', error);
    // Don't throw error - audit failure shouldn't break app
  }
}
```

#### Express Middleware for Auto-Logging
```javascript
function auditMiddleware(req, res, next) {
  // Store original res.json
  const originalJson = res.json;
  
  // Override res.json to capture response
  res.json = function(data) {
    // Log after response
    if (req.user && req.auditAction) {
      const status = res.statusCode >= 200 && res.statusCode < 300 ? 'success' : 'failed';
      
      createAuditLog({
        action: req.auditAction.action,
        actionCategory: req.auditAction.category,
        performedBy: req.user.userId,
        performedByType: req.user.role,
        resourceType: req.auditAction.resourceType,
        resourceId: req.auditAction.resourceId,
        patientId: req.auditAction.patientId,
        description: req.auditAction.description,
        severity: status === 'failed' ? 'warning' : 'info',
        ipAddress: req.ip,
        userAgent: req.get('user-agent'),
        requestMethod: req.method,
        requestUrl: req.originalUrl,
        status,
        errorMessage: status === 'failed' ? data.error : null
      });
    }
    
    return originalJson.call(this, data);
  };
  
  next();
}
```

### 3. Kafka Event Consumers for Audit

#### Listen to All Service Events
```javascript
const consumer = kafka.consumer({ groupId: 'audit-service' });

await consumer.subscribe({
  topics: [
    'user.*',
    'appointment.*',
    'consultation.*',
    'prescription.*',
    'document.*',
    'referral.*',
    'message.*'
  ]
});

await consumer.run({
  eachMessage: async ({ topic, message }) => {
    const event = JSON.parse(message.value.toString());
    await logEventToAudit(topic, event);
  }
});
```

#### Event to Audit Log Mapping
```javascript
async function logEventToAudit(eventType, eventData) {
  const auditMappings = {
    'user.registered': {
      action: 'user.registered',
      actionCategory: 'user_management',
      description: 'New user registered',
      severity: 'info'
    },
    'user.verified': {
      action: 'user.email_verified',
      actionCategory: 'authentication',
      description: 'User email verified',
      severity: 'info'
    },
    'user.logged_in': {
      action: 'user.login',
      actionCategory: 'authentication',
      description: 'User logged in',
      severity: 'info',
      isSecurityRelevant: true
    },
    'consultation.accessed': {
      action: 'consultation.viewed',
      actionCategory: 'consultation',
      description: 'Medical consultation accessed',
      severity: 'info',
      isComplianceRelevant: true
    },
    'document.uploaded': {
      action: 'document.uploaded',
      actionCategory: 'document',
      description: 'Medical document uploaded',
      severity: 'info',
      isComplianceRelevant: true
    },
    'prescription.created': {
      action: 'prescription.created',
      actionCategory: 'prescription',
      description: 'Prescription created',
      severity: 'info',
      isComplianceRelevant: true
    }
    // ... more mappings
  };
  
  const mapping = auditMappings[eventType];
  if (mapping) {
    await createAuditLog({
      ...mapping,
      performedBy: eventData.userId || eventData.doctorId,
      performedByType: eventData.userType || 'doctor',
      resourceType: eventData.resourceType,
      resourceId: eventData.resourceId,
      patientId: eventData.patientId,
      metadata: eventData
    });
  }
}
```

### 4. Specific Audit Scenarios

#### A. Track Medical Record Access
```javascript
// When doctor views patient medical records
await createAuditLog({
  action: 'medical_records.accessed',
  actionCategory: 'consultation',
  performedBy: doctorId,
  performedByType: 'doctor',
  resourceType: 'patient_timeline',
  patientId: patientId,
  description: `Doctor accessed patient medical timeline`,
  severity: 'info',
  isComplianceRelevant: true,
  metadata: {
    viewType: 'full_timeline',
    recordCount: records.length
  }
});
```

#### B. Track Document Access
```javascript
// When document is downloaded
await createAuditLog({
  action: 'document.downloaded',
  actionCategory: 'document',
  performedBy: userId,
  performedByType: userType,
  resourceType: 'medical_document',
  resourceId: documentId,
  patientId: patientId,
  description: `Medical document downloaded: ${documentTitle}`,
  severity: 'info',
  isComplianceRelevant: true,
  metadata: {
    documentType: 'lab_result',
    fileName: 'cardiac_test.pdf'
  }
});
```

#### C. Track Failed Login Attempts
```javascript
await createAuditLog({
  action: 'auth.login_failed',
  actionCategory: 'authentication',
  performedBy: null,
  performedByType: 'system',
  description: `Failed login attempt for email: ${email}`,
  severity: 'warning',
  isSecurityRelevant: true,
  requiresReview: true,
  status: 'failed',
  errorMessage: 'Invalid credentials',
  ipAddress: req.ip,
  metadata: {
    email: email,
    attemptCount: failedAttempts
  }
});
```

#### D. Track Data Modifications
```javascript
// When prescription is updated
await createAuditLog({
  action: 'prescription.updated',
  actionCategory: 'prescription',
  performedBy: doctorId,
  performedByType: 'doctor',
  resourceType: 'prescription',
  resourceId: prescriptionId,
  patientId: patientId,
  description: 'Prescription medications updated',
  severity: 'info',
  isComplianceRelevant: true,
  changes: {
    medications: true
  },
  previousData: {
    medications: oldMedications
  },
  newData: {
    medications: newMedications
  }
});
```

#### E. Track Suspicious Activity
```javascript
// Multiple failed login attempts
if (failedAttempts >= 5) {
  await createAuditLog({
    action: 'security.multiple_failed_logins',
    actionCategory: 'authentication',
    performedBy: null,
    performedByType: 'system',
    description: `Multiple failed login attempts detected for email: ${email}`,
    severity: 'critical',
    isSecurityRelevant: true,
    requiresReview: true,
    ipAddress: req.ip,
    metadata: {
      email,
      attemptCount: failedAttempts,
      timeWindow: '10 minutes'
    }
  });
}
```

### 5. Admin API Endpoints

#### A. Get Audit Logs
**Endpoint:** `GET /api/v1/audit/logs`

**Headers:**
```
Authorization: Bearer {adminToken}
```

**Query Parameters:**
```
?actionCategory=consultation
&performedBy=userId123
&patientId=patientId456
&severity=critical
&startDate=2025-11-01
&endDate=2025-11-30
&status=success
&isSecurityRelevant=true
&isComplianceRelevant=true
&requiresReview=true
&page=1
&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": {
    "logs": [
      {
        "id": "...",
        "action": "consultation.viewed",
        "actionCategory": "consultation",
        "performedBy": {
          "id": "...",
          "name": "Dr. Sarah Smith",
          "type": "doctor"
        },
        "patient": {
          "id": "...",
          "name": "John Doe"
        },
        "description": "Doctor accessed patient medical timeline",
        "severity": "info",
        "ipAddress": "192.168.1.100",
        "timestamp": "2025-11-10T14:30:00Z",
        "isComplianceRelevant": true
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 10,
      "totalLogs": 500
    },
    "summary": {
      "total": 500,
      "bySeverity": {
        "info": 450,
        "warning": 40,
        "critical": 10
      },
      "byCategory": {
        "authentication": 100,
        "consultation": 200,
        "document": 150,
        "prescription": 50
      }
    }
  }
}
```

#### B. Get User Activity History
**Endpoint:** `GET /api/v1/audit/users/:userId/activity`

**Headers:**
```
Authorization: Bearer {adminToken}
```

**Query Parameters:**
```
?startDate=2025-11-01
&endDate=2025-11-30
&actionCategory=consultation
&page=1
&limit=50
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "name": "Dr. Sarah Smith",
      "type": "doctor"
    },
    "activityTimeline": [
      {
        "timestamp": "2025-11-10T14:30:00Z",
        "action": "consultation.viewed",
        "description": "Accessed patient medical timeline",
        "patient": "John Doe",
        "severity": "info"
      }
    ],
    "statistics": {
      "totalActions": 150,
      "loginCount": 45,
      "consultationsViewed": 80,
      "documentsAccessed": 25
    }
  }
}
```

#### C. Get Patient Access Log
**Endpoint:** `GET /api/v1/audit/patients/:patientId/access-log`

**Headers:**
```
Authorization: Bearer {adminToken}
```

**Purpose:** See who accessed a patient's medical records

**Response:**
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": "...",
      "name": "John Doe"
    },
    "accessLog": [
      {
        "timestamp": "2025-11-10T14:30:00Z",
        "accessedBy": {
          "id": "...",
          "name": "Dr. Sarah Smith",
          "type": "doctor"
        },
        "action": "consultation.viewed",
        "resourceType": "patient_timeline",
        "ipAddress": "192.168.1.100"
      },
      {
        "timestamp": "2025-11-09T10:00:00Z",
        "accessedBy": {
          "id": "...",
          "name": "Dr. Michael Johnson",
          "type": "doctor"
        },
        "action": "document.downloaded",
        "resourceType": "lab_result",
        "ipAddress": "192.168.1.105"
      }
    ],
    "statistics": {
      "totalAccesses": 50,
      "uniqueDoctors": 5,
      "lastAccessed": "2025-11-10T14:30:00Z"
    }
  }
}
```

#### D. Get Security Events
**Endpoint:** `GET /api/v1/audit/security-events`

**Headers:**
```
Authorization: Bearer {adminToken}
```

**Query Parameters:**
```
?severity=critical
&requiresReview=true
&startDate=2025-11-01
&page=1
&limit=20
```

**Purpose:** Monitor security-relevant events

**Response:**
```json
{
  "success": true,
  "data": {
    "events": [
      {
        "timestamp": "2025-11-10T03:00:00Z",
        "action": "security.multiple_failed_logins",
        "severity": "critical",
        "description": "Multiple failed login attempts",
        "ipAddress": "203.0.113.45",
        "metadata": {
          "email": "user@example.com",
          "attemptCount": 8
        },
        "requiresReview": true
      }
    ],
    "summary": {
      "critical": 5,
      "warning": 20,
      "requiresReview": 10
    }
  }
}
```

#### E. Get Audit Statistics
**Endpoint:** `GET /api/v1/audit/statistics`

**Headers:**
```
Authorization: Bearer {adminToken}
```

**Query Parameters:**
```
?startDate=2025-11-01
&endDate=2025-11-30
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalLogs": 10000,
    "dateRange": {
      "start": "2025-11-01",
      "end": "2025-11-30"
    },
    "bySeverity": {
      "info": 9000,
      "warning": 900,
      "critical": 100
    },
    "byCategory": {
      "authentication": 2000,
      "consultation": 3000,
      "document": 2500,
      "prescription": 1500,
      "appointment": 1000
    },
    "topActions": [
      {
        "action": "user.login",
        "count": 1500
      },
      {
        "action": "consultation.viewed",
        "count": 1200
      }
    ],
    "topUsers": [
      {
        "userId": "...",
        "name": "Dr. Sarah Smith",
        "actionCount": 500
      }
    ],
    "securityEvents": {
      "failedLogins": 45,
      "suspiciousActivity": 5,
      "unauthorizedAccess": 2
    }
  }
}
```

#### F. Mark Audit Log as Reviewed
**Endpoint:** `PUT /api/v1/audit/logs/:logId/review`

**Headers:**
```
Authorization: Bearer {adminToken}
```

**Request Body:**
```json
{
  "reviewNotes": "Reviewed - no action needed",
  "reviewedBy": "adminId"
}
```

#### G. Export Audit Logs
**Endpoint:** `GET /api/v1/audit/export`

**Headers:**
```
Authorization: Bearer {adminToken}
```

**Query Parameters:**
```
?format=csv (or 'json', 'xlsx')
&startDate=2025-11-01
&endDate=2025-11-30
&actionCategory=consultation
```

**Purpose:** Export logs for compliance reporting

### 6. Real-time Monitoring Dashboard (via Socket.IO)

```javascript
// Admin connects to audit stream
io.on('connection', (socket) => {
  if (socket.userRole === 'admin') {
    socket.join('audit_monitor');
    
    // Stream critical events in real-time
    socket.on('subscribe_audit', () => {
      // Send new critical events as they happen
    });
  }
});

// When critical audit log is created
io.to('audit_monitor').emit('critical_event', {
  auditLog: {...}
});
```

### 7. Compliance Reports

#### Generate HIPAA Audit Report
**Endpoint:** `GET /api/v1/audit/compliance/hipaa-report`

**Purpose:** Generate compliance report showing all medical record access

#### Generate Activity Report
**Endpoint:** `GET /api/v1/audit/compliance/activity-report`

**Purpose:** Show all system activity for compliance audits

## API Endpoints Summary
```
GET    /api/v1/audit/logs
GET    /api/v1/audit/users/:userId/activity
GET    /api/v1/audit/patients/:patientId/access-log
GET    /api/v1/audit/security-events
GET    /api/v1/audit/statistics
PUT    /api/v1/audit/logs/:logId/review
GET    /api/v1/audit/export
GET    /api/v1/audit/compliance/hipaa-report
GET    /api/v1/audit/compliance/activity-report
```

## Deliverables
1. ✅ AuditLog model
2. ✅ Audit logging helper functions
3. ✅ Express middleware for auto-logging
4. ✅ Kafka event consumers
5. ✅ Track all critical actions
6. ✅ Admin audit log viewer
7. ✅ User activity history
8. ✅ Patient access log
9. ✅ Security event monitoring
10. ✅ Audit statistics
11. ✅ Export functionality
12. ✅ Compliance reports
13. ✅ Real-time monitoring

## Actions to Track
- ✅ User registration/login/logout
- ✅ Failed login attempts
- ✅ Password changes
- ✅ Profile updates
- ✅ Consultation access
- ✅ Prescription creation/updates
- ✅ Document uploads/downloads
- ✅ Referral creation
- ✅ Appointment booking/cancellation
- ✅ Message sending
- ✅ Admin actions

## Testing Checklist
- [ ] Audit logs created for all actions
- [ ] Kafka events generate audit logs
- [ ] Admin can view audit logs
- [ ] Filter and search work correctly
- [ ] Patient access log shows all viewers
- [ ] Security events flagged correctly
- [ ] Critical events send alerts
- [ ] Export functionality works
- [ ] Statistics accurate
- [ ] Real-time monitoring works

---

**Next Step:** All prompts complete! Backend implementation finished. Proceed to integration testing and deployment.
