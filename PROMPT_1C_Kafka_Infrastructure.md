# PROMPT 1C: Kafka Infrastructure Setup

## Objective
Setup Apache Kafka for event-driven communication between microservices. Create producer and consumer utilities, define topics, and establish event schemas.

## Prerequisites
✅ PROMPT 1A completed (Folder structure and MongoDB setup)
✅ PROMPT 1B completed (Shared middleware and utilities)

## Requirements

### 1. Install Kafka Dependencies

Add to `backend/shared/package.json`:

```json
{
  "dependencies": {
    "mongoose": "^8.0.0",
    "dotenv": "^16.3.1",
    "jsonwebtoken": "^9.0.2",
    "morgan": "^1.10.0",
    "kafkajs": "^2.2.4"
  }
}
```

### 2. Kafka Configuration

Create `backend/shared/config/kafka.js`:

```javascript
const { Kafka, logLevel } = require('kafkajs');

/**
 * Kafka Client Configuration
 */
const createKafkaClient = () => {
  const kafka = new Kafka({
    clientId: process.env.KAFKA_CLIENT_ID || 'esante-backend',
    brokers: (process.env.KAFKA_BROKERS || 'localhost:9092').split(','),
    logLevel: logLevel.INFO,
    retry: {
      initialRetryTime: 300,
      retries: 8
    }
  });

  return kafka;
};

module.exports = { createKafkaClient };
```

### 3. Kafka Producer Utility

Create `backend/shared/kafka/producer.js`:

```javascript
const { createKafkaClient } = require('../config/kafka');

/**
 * Kafka Producer Singleton
 */
class KafkaProducer {
  constructor() {
    this.kafka = createKafkaClient();
    this.producer = this.kafka.producer({
      allowAutoTopicCreation: true,
      transactionTimeout: 30000
    });
    this.isConnected = false;
  }

  /**
   * Connect to Kafka
   */
  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      await this.producer.connect();
      this.isConnected = true;
      console.log('✅ Kafka Producer: Connected successfully');
    } catch (error) {
      console.error('❌ Kafka Producer: Connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.producer.disconnect();
      this.isConnected = false;
      console.log('👋 Kafka Producer: Disconnected');
    } catch (error) {
      console.error('❌ Kafka Producer: Disconnection failed:', error.message);
    }
  }

  /**
   * Send event to Kafka topic
   */
  async sendEvent(topic, event) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const message = {
        key: event.eventId || Date.now().toString(),
        value: JSON.stringify({
          ...event,
          timestamp: new Date().toISOString(),
          service: process.env.SERVICE_NAME || 'unknown'
        }),
        headers: {
          'content-type': 'application/json',
          'event-type': event.eventType
        }
      };

      await this.producer.send({
        topic,
        messages: [message]
      });

      console.log(`📤 Kafka: Event sent to topic "${topic}":`, event.eventType);
    } catch (error) {
      console.error(`❌ Kafka: Failed to send event to "${topic}":`, error.message);
      throw error;
    }
  }

  /**
   * Send multiple events in batch
   */
  async sendBatch(topic, events) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const messages = events.map(event => ({
        key: event.eventId || Date.now().toString(),
        value: JSON.stringify({
          ...event,
          timestamp: new Date().toISOString(),
          service: process.env.SERVICE_NAME || 'unknown'
        }),
        headers: {
          'content-type': 'application/json',
          'event-type': event.eventType
        }
      }));

      await this.producer.send({
        topic,
        messages
      });

      console.log(`📤 Kafka: Batch of ${events.length} events sent to topic "${topic}"`);
    } catch (error) {
      console.error(`❌ Kafka: Failed to send batch to "${topic}":`, error.message);
      throw error;
    }
  }
}

// Export singleton instance
const kafkaProducer = new KafkaProducer();

module.exports = kafkaProducer;
```

### 4. Kafka Consumer Utility

Create `backend/shared/kafka/consumer.js`:

```javascript
const { createKafkaClient } = require('../config/kafka');

/**
 * Kafka Consumer Class
 */
class KafkaConsumer {
  constructor(groupId) {
    this.kafka = createKafkaClient();
    this.consumer = this.kafka.consumer({
      groupId: groupId || process.env.SERVICE_NAME || 'esante-consumer',
      sessionTimeout: 30000,
      heartbeatInterval: 3000
    });
    this.isConnected = false;
    this.handlers = new Map();
  }

  /**
   * Connect to Kafka
   */
  async connect() {
    if (this.isConnected) {
      return;
    }

    try {
      await this.consumer.connect();
      this.isConnected = true;
      console.log('✅ Kafka Consumer: Connected successfully');
    } catch (error) {
      console.error('❌ Kafka Consumer: Connection failed:', error.message);
      throw error;
    }
  }

  /**
   * Disconnect from Kafka
   */
  async disconnect() {
    if (!this.isConnected) {
      return;
    }

    try {
      await this.consumer.disconnect();
      this.isConnected = false;
      console.log('👋 Kafka Consumer: Disconnected');
    } catch (error) {
      console.error('❌ Kafka Consumer: Disconnection failed:', error.message);
    }
  }

  /**
   * Subscribe to topics
   */
  async subscribe(topics) {
    try {
      if (!this.isConnected) {
        await this.connect();
      }

      const topicArray = Array.isArray(topics) ? topics : [topics];

      for (const topic of topicArray) {
        await this.consumer.subscribe({
          topic,
          fromBeginning: false
        });
        console.log(`📥 Kafka Consumer: Subscribed to topic "${topic}"`);
      }
    } catch (error) {
      console.error('❌ Kafka Consumer: Subscription failed:', error.message);
      throw error;
    }
  }

  /**
   * Register event handler for specific event type
   */
  registerHandler(eventType, handler) {
    this.handlers.set(eventType, handler);
    console.log(`🔧 Kafka Consumer: Handler registered for "${eventType}"`);
  }

  /**
   * Start consuming messages
   */
  async consume() {
    try {
      await this.consumer.run({
        eachMessage: async ({ topic, partition, message }) => {
          try {
            const event = JSON.parse(message.value.toString());
            const eventType = message.headers['event-type']?.toString() || event.eventType;

            console.log(`📩 Kafka Consumer: Received event "${eventType}" from topic "${topic}"`);

            // Find and execute handler
            const handler = this.handlers.get(eventType);
            if (handler) {
              await handler(event);
              console.log(`✅ Kafka Consumer: Event "${eventType}" processed successfully`);
            } else {
              console.warn(`⚠️  Kafka Consumer: No handler for event type "${eventType}"`);
            }
          } catch (error) {
            console.error('❌ Kafka Consumer: Error processing message:', error.message);
            // Optionally send to dead letter queue
            await this.sendToDeadLetterQueue(topic, message, error);
          }
        }
      });
    } catch (error) {
      console.error('❌ Kafka Consumer: Error in consume loop:', error.message);
      throw error;
    }
  }

  /**
   * Send failed message to dead letter queue
   */
  async sendToDeadLetterQueue(originalTopic, message, error) {
    try {
      const dlqTopic = `${originalTopic}.dlq`;
      const producer = require('./producer');

      await producer.sendEvent(dlqTopic, {
        eventType: 'dlq.message',
        originalTopic,
        originalMessage: message.value.toString(),
        error: error.message,
        timestamp: new Date().toISOString()
      });
    } catch (dlqError) {
      console.error('❌ Failed to send to DLQ:', dlqError.message);
    }
  }
}

module.exports = KafkaConsumer;
```

### 5. Kafka Topics Definition

Create `backend/shared/kafka/topics.js`:

```javascript
/**
 * Kafka Topics Definition
 * Naming convention: service.entity.action
 */

const TOPICS = {
  // Auth Service Events
  AUTH: {
    USER_REGISTERED: 'auth.user.registered',
    USER_VERIFIED: 'auth.user.verified',
    USER_LOGIN: 'auth.user.login',
    PASSWORD_RESET: 'auth.password.reset',
    TOKEN_REFRESHED: 'auth.token.refreshed'
  },

  // User Service Events
  USER: {
    PROFILE_CREATED: 'user.profile.created',
    PROFILE_UPDATED: 'user.profile.updated',
    PHOTO_UPLOADED: 'user.photo.uploaded',
    DOCTOR_VERIFIED: 'user.doctor.verified'
  },

  // Appointment Service Events
  RDV: {
    SLOT_CREATED: 'rdv.slot.created',
    SLOT_DELETED: 'rdv.slot.deleted',
    APPOINTMENT_REQUESTED: 'rdv.appointment.requested',
    APPOINTMENT_CONFIRMED: 'rdv.appointment.confirmed',
    APPOINTMENT_CANCELLED: 'rdv.appointment.cancelled',
    APPOINTMENT_COMPLETED: 'rdv.appointment.completed',
    APPOINTMENT_REMINDER: 'rdv.appointment.reminder'
  },

  // Medical Records Events
  MEDICAL: {
    CONSULTATION_CREATED: 'medical.consultation.created',
    CONSULTATION_UPDATED: 'medical.consultation.updated',
    PRESCRIPTION_CREATED: 'medical.prescription.created',
    PRESCRIPTION_UPDATED: 'medical.prescription.updated',
    PRESCRIPTION_LOCKED: 'medical.prescription.locked',
    DOCUMENT_UPLOADED: 'medical.document.uploaded',
    DOCUMENT_SHARED: 'medical.document.shared',
    DOCUMENT_ACCESSED: 'medical.document.accessed'
  },

  // Referral Service Events
  REFERRAL: {
    REFERRAL_CREATED: 'referral.referral.created',
    REFERRAL_ACCEPTED: 'referral.referral.accepted',
    REFERRAL_REJECTED: 'referral.referral.rejected',
    REFERRAL_COMPLETED: 'referral.referral.completed'
  },

  // Messaging Service Events
  MESSAGING: {
    CONVERSATION_CREATED: 'messaging.conversation.created',
    MESSAGE_SENT: 'messaging.message.sent',
    MESSAGE_DELIVERED: 'messaging.message.delivered',
    MESSAGE_READ: 'messaging.message.read'
  },

  // Notification Events
  NOTIFICATION: {
    PUSH_SENT: 'notification.push.sent',
    EMAIL_SENT: 'notification.email.sent',
    SMS_SENT: 'notification.sms.sent'
  },

  // Audit Events
  AUDIT: {
    ACTION_LOGGED: 'audit.action.logged',
    SECURITY_EVENT: 'audit.security.event'
  }
};

module.exports = TOPICS;
```

### 6. Event Schema Templates

Create `backend/shared/kafka/schemas.js`:

```javascript
/**
 * Event Schema Templates
 * These define the structure of events sent through Kafka
 */

const EVENT_SCHEMAS = {
  // User Registration Event
  USER_REGISTERED: {
    eventType: 'auth.user.registered',
    eventId: 'uuid',
    userId: 'string',
    email: 'string',
    role: 'string', // 'patient' | 'doctor' | 'admin'
    timestamp: 'ISO date string'
  },

  // User Verified Event
  USER_VERIFIED: {
    eventType: 'auth.user.verified',
    eventId: 'uuid',
    userId: 'string',
    email: 'string',
    timestamp: 'ISO date string'
  },

  // Appointment Requested Event
  APPOINTMENT_REQUESTED: {
    eventType: 'rdv.appointment.requested',
    eventId: 'uuid',
    appointmentId: 'string',
    patientId: 'string',
    doctorId: 'string',
    date: 'ISO date string',
    timeSlot: 'string',
    reason: 'string',
    timestamp: 'ISO date string'
  },

  // Appointment Confirmed Event
  APPOINTMENT_CONFIRMED: {
    eventType: 'rdv.appointment.confirmed',
    eventId: 'uuid',
    appointmentId: 'string',
    patientId: 'string',
    doctorId: 'string',
    date: 'ISO date string',
    timeSlot: 'string',
    timestamp: 'ISO date string'
  },

  // Consultation Created Event
  CONSULTATION_CREATED: {
    eventType: 'medical.consultation.created',
    eventId: 'uuid',
    consultationId: 'string',
    patientId: 'string',
    doctorId: 'string',
    appointmentId: 'string',
    diagnosis: 'string',
    timestamp: 'ISO date string'
  },

  // Prescription Created Event
  PRESCRIPTION_CREATED: {
    eventType: 'medical.prescription.created',
    eventId: 'uuid',
    prescriptionId: 'string',
    patientId: 'string',
    doctorId: 'string',
    consultationId: 'string',
    medicationCount: 'number',
    canEditUntil: 'ISO date string',
    timestamp: 'ISO date string'
  },

  // Document Uploaded Event
  DOCUMENT_UPLOADED: {
    eventType: 'medical.document.uploaded',
    eventId: 'uuid',
    documentId: 'string',
    patientId: 'string',
    doctorId: 'string',
    documentType: 'string',
    fileSize: 'number',
    timestamp: 'ISO date string'
  },

  // Referral Created Event
  REFERRAL_CREATED: {
    eventType: 'referral.referral.created',
    eventId: 'uuid',
    referralId: 'string',
    patientId: 'string',
    fromDoctorId: 'string',
    toDoctorId: 'string',
    specialty: 'string',
    urgency: 'string',
    timestamp: 'ISO date string'
  },

  // Message Sent Event
  MESSAGE_SENT: {
    eventType: 'messaging.message.sent',
    eventId: 'uuid',
    messageId: 'string',
    conversationId: 'string',
    senderId: 'string',
    receiverId: 'string',
    messageType: 'string',
    timestamp: 'ISO date string'
  }
};

/**
 * Create event with schema validation
 */
const createEvent = (eventType, data) => {
  return {
    eventType,
    eventId: generateEventId(),
    ...data,
    timestamp: new Date().toISOString()
  };
};

/**
 * Generate unique event ID
 */
const generateEventId = () => {
  return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
};

module.exports = {
  EVENT_SCHEMAS,
  createEvent,
  generateEventId
};
```

### 7. Docker Compose for Kafka (Local Development)

Create `backend/docker-compose.kafka.yml`:

```yaml
version: '3.8'

services:
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

  kafka:
    image: confluentinc/cp-kafka:latest
    container_name: esante-kafka
    depends_on:
      - zookeeper
    ports:
      - "9092:9092"
      - "9093:9093"
    environment:
      KAFKA_BROKER_ID: 1
      KAFKA_ZOOKEEPER_CONNECT: zookeeper:2181
      KAFKA_ADVERTISED_LISTENERS: PLAINTEXT://localhost:9092,PLAINTEXT_INTERNAL://kafka:9093
      KAFKA_LISTENER_SECURITY_PROTOCOL_MAP: PLAINTEXT:PLAINTEXT,PLAINTEXT_INTERNAL:PLAINTEXT
      KAFKA_INTER_BROKER_LISTENER_NAME: PLAINTEXT_INTERNAL
      KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR: 1
      KAFKA_AUTO_CREATE_TOPICS_ENABLE: 'true'
    networks:
      - esante-network

  kafka-ui:
    image: provectuslabs/kafka-ui:latest
    container_name: esante-kafka-ui
    depends_on:
      - kafka
    ports:
      - "8080:8080"
    environment:
      KAFKA_CLUSTERS_0_NAME: esante-cluster
      KAFKA_CLUSTERS_0_BOOTSTRAPSERVERS: kafka:9093
      KAFKA_CLUSTERS_0_ZOOKEEPER: zookeeper:2181
    networks:
      - esante-network

networks:
  esante-network:
    driver: bridge
```

### 8. Update Shared Index

Update `backend/shared/index.js` to export Kafka utilities:

```javascript
// ... existing exports ...

// Kafka
const kafkaProducer = require('./kafka/producer');
const KafkaConsumer = require('./kafka/consumer');
const TOPICS = require('./kafka/topics');
const { EVENT_SCHEMAS, createEvent, generateEventId } = require('./kafka/schemas');

module.exports = {
  // ... existing exports ...

  // Kafka
  kafkaProducer,
  KafkaConsumer,
  TOPICS,
  EVENT_SCHEMAS,
  createEvent,
  generateEventId
};
```

### 9. Kafka Helper Functions

Create `backend/shared/kafka/helpers.js`:

```javascript
const kafkaProducer = require('./producer');
const TOPICS = require('./topics');
const { createEvent } = require('./schemas');

/**
 * Emit user registered event
 */
const emitUserRegistered = async (userId, email, role) => {
  const event = createEvent('auth.user.registered', {
    userId,
    email,
    role
  });
  await kafkaProducer.sendEvent(TOPICS.AUTH.USER_REGISTERED, event);
};

/**
 * Emit appointment confirmed event
 */
const emitAppointmentConfirmed = async (appointmentData) => {
  const event = createEvent('rdv.appointment.confirmed', appointmentData);
  await kafkaProducer.sendEvent(TOPICS.RDV.APPOINTMENT_CONFIRMED, event);
};

/**
 * Emit consultation created event
 */
const emitConsultationCreated = async (consultationData) => {
  const event = createEvent('medical.consultation.created', consultationData);
  await kafkaProducer.sendEvent(TOPICS.MEDICAL.CONSULTATION_CREATED, event);
};

/**
 * Emit prescription created event
 */
const emitPrescriptionCreated = async (prescriptionData) => {
  const event = createEvent('medical.prescription.created', prescriptionData);
  await kafkaProducer.sendEvent(TOPICS.MEDICAL.PRESCRIPTION_CREATED, event);
};

/**
 * Emit referral created event
 */
const emitReferralCreated = async (referralData) => {
  const event = createEvent('referral.referral.created', referralData);
  await kafkaProducer.sendEvent(TOPICS.REFERRAL.REFERRAL_CREATED, event);
};

/**
 * Emit message sent event
 */
const emitMessageSent = async (messageData) => {
  const event = createEvent('messaging.message.sent', messageData);
  await kafkaProducer.sendEvent(TOPICS.MESSAGING.MESSAGE_SENT, event);
};

module.exports = {
  emitUserRegistered,
  emitAppointmentConfirmed,
  emitConsultationCreated,
  emitPrescriptionCreated,
  emitReferralCreated,
  emitMessageSent
};
```

## Testing Checklist

After completing this prompt, verify:

- [ ] `backend/shared/config/kafka.js` exists with Kafka client configuration
- [ ] `backend/shared/kafka/producer.js` exists with producer singleton
- [ ] `backend/shared/kafka/consumer.js` exists with consumer class
- [ ] `backend/shared/kafka/topics.js` exists with all topic definitions
- [ ] `backend/shared/kafka/schemas.js` exists with event schemas
- [ ] `backend/shared/kafka/helpers.js` exists with helper functions
- [ ] `backend/docker-compose.kafka.yml` exists
- [ ] `backend/shared/package.json` includes kafkajs dependency
- [ ] `backend/shared/index.js` exports Kafka utilities
- [ ] Can start Kafka with: `docker-compose -f docker-compose.kafka.yml up -d`
- [ ] Kafka UI accessible at http://localhost:8080

## Deliverables

1. ✅ Kafka client configuration
2. ✅ Producer utility (singleton pattern)
3. ✅ Consumer utility (with handler registration)
4. ✅ Topic definitions (50+ topics)
5. ✅ Event schemas and templates
6. ✅ Helper functions for common events
7. ✅ Docker Compose for Kafka + Zookeeper + UI
8. ✅ Dead letter queue support
9. ✅ Updated shared index.js

## Time Estimate
⏱️ **2-3 hours**

---

**Next:** Proceed to PROMPT 1D (API Gateway Setup)
