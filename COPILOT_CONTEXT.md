# GitHub Copilot Context File - E-Santé Platform

**Last Updated:** November 5, 2025  
**Project Status:** 61% Complete (Sprint 11 of 18)  
**Purpose:** This file provides complete context for GitHub Copilot across devices

---

## 🎯 Project Overview

**Name:** E-Santé Healthcare Management Platform  
**Type:** Microservices-based healthcare management system  
**Goal:** Connect patients, general practitioners (GPs), and specialists for seamless healthcare delivery

### Key Features
- ✅ Multi-role authentication (Patients, GPs, Specialists)
- ✅ Appointment scheduling and management
- ✅ **n8n Workflow Automation** for intelligent appointment booking (multi-channel)
- ✅ Electronic medical records (consultations, prescriptions, documents)
- ✅ Referral system (GP to specialist)
- ✅ Real-time secure messaging (Socket.IO)
- ✅ Multi-channel notifications (Push via OneSignal, Email via Nodemailer, In-app)
- ✅ Comprehensive audit logging
- ✅ Geolocation-based doctor search
- 🔄 Mobile application (React Native) - IN PROGRESS
- 📋 Web admin dashboard - PLANNED
- 📋 Testing & optimization - PLANNED
- 📋 Production deployment - PLANNED

---

## 🏗️ Architecture Overview

### Technology Stack

**Backend:**
- Node.js + Express.js
- MongoDB (NoSQL database)
- Mongoose (ODM)
- Apache Kafka (event streaming)
- Redis (caching, sessions, rate limiting)
- Socket.IO (real-time messaging)
- JWT + bcrypt (authentication)

**Automation & Integration:**
- n8n (workflow automation)
- OneSignal (push notifications)
- Nodemailer (email)
- AWS S3 (file storage)

**Infrastructure:**
- Docker + Docker Compose
- 8 microservices + 1 API Gateway

### Microservices Architecture

| Port | Service | Purpose |
|------|---------|---------|
| 3000 | API Gateway | Entry point, routing, rate limiting, auth verification |
| 3001 | Auth Service | Registration, login, password management, JWT |
| 3002 | User Service | Profile management, doctor search, geolocation |
| 3003 | RDV Service | Appointment booking, availability, reminders |
| 3004 | Medical Records | Consultations, prescriptions, documents (S3) |
| 3005 | Referral Service | GP-to-specialist referrals, tracking |
| 3006 | Messaging Service | Real-time chat, Socket.IO, conversations |
| 3007 | Notification Service | Push (OneSignal), Email (Nodemailer), In-app |
| 3008 | Audit Service | Comprehensive logging, compliance |

### Databases

```
MongoDB databases:
- esante_auth (users, auth tokens)
- esante_users (profiles, doctor info)
- esante_rdv (appointments, availability)
- esante_medical_records (consultations, prescriptions, documents)
- esante_referrals (referrals)
- esante_messaging (conversations, messages)
- esante_notifications (notification logs, preferences)
- esante_audit (audit logs)
```

### Kafka Event Topics

```
Kafka topics:
- auth.user.* (registered, verified, login)
- users.profile.*
- rdv.appointment.* (created, confirmed, cancelled, reminder)
- medical-records.* (consultation, prescription, document)
- referrals.* (created, accepted, completed)
- messaging.* (conversation, message)
- notifications.* (push, email, in-app)
- audit.* (all system events)
```

---

## 📊 Project Status

### Completion Metrics

- **Total Sprints:** 18 (36 weeks / 9 months)
- **Completed Sprints:** 11 (Sprints 0-11)
- **Current Sprint:** 12 (Mobile Application - Core)
- **Completion:** 61%
- **User Stories:** 60/96 completed (63%)
- **Story Points:** 533/838 delivered (64%)

### Sprint Breakdown

| Sprint | Focus Area | Stories | Points | Status |
|--------|-----------|---------|--------|--------|
| Sprint 0 | Project Setup & Infrastructure | 5 | 34 | ✅ COMPLETED |
| Sprint 1 | Authentication & User Management | 6 | 42 | ✅ COMPLETED |
| Sprint 2 | Appointment System (RDV) | 6 | 47 | ✅ COMPLETED |
| Sprint 3 | Medical Records - Consultations | 4 | 28 | ✅ COMPLETED |
| Sprint 4 | Medical Records - Prescriptions | 5 | 36 | ✅ COMPLETED |
| Sprint 5 | Medical Records - Documents | 5 | 36 | ✅ COMPLETED |
| Sprint 6 | Referral System | 6 | 47 | ✅ COMPLETED |
| Sprint 7 | Messaging System | 6 | 55 | ✅ COMPLETED |
| Sprint 8 | Notification System - Push | 5 | 47 | ✅ COMPLETED |
| Sprint 9 | Notification System - Email | 5 | 47 | ✅ COMPLETED |
| Sprint 10 | Audit & Logging Service | 5 | 45 | ✅ COMPLETED |
| Sprint 11 | API Gateway & Integration | 6 | 69 | ✅ COMPLETED |
| Sprint 12 | Mobile Application - Core | 5 | 47 | 🔄 IN PROGRESS |
| Sprint 13 | Mobile Application - Features | 5 | 55 | 📋 PLANNED |
| Sprint 14 | Web Admin Dashboard | 5 | 47 | 📋 PLANNED |
| Sprint 15 | Testing & Quality Assurance | 5 | 55 | 📋 PLANNED |
| Sprint 16 | Performance Optimization | 5 | 47 | 📋 PLANNED |
| Sprint 17 | Deployment & Documentation | 5 | 54 | 📋 PLANNED |

---

## 🎉 Major Achievements

### ✅ Completed Features

1. **Complete Authentication System**
   - Email/password registration with verification
   - JWT-based authentication
   - Password reset flow
   - Role-based access control (Patient, GP, Specialist)

2. **User Management**
   - Profile management (CRUD)
   - Geolocation-based doctor search (MongoDB geospatial queries)
   - Specialization filtering
   - Profile pictures (S3 integration ready)

3. **Appointment System (RDV)**
   - Doctor availability management (recurring schedules)
   - Appointment booking (pending → confirmed flow)
   - Confirmation/rejection by doctors
   - Cancellation by both parties
   - Automated reminders (24h, 1h before)

4. **Medical Records**
   - **Consultations:** Full medical records with diagnosis, symptoms, treatment plans
   - **Prescriptions:** Multi-medication prescriptions with auto-lock after 48 hours
   - **Documents:** S3 file upload (PDF, images, DICOM), secure download with pre-signed URLs
   - Access control and audit logging

5. **Referral System**
   - GP to specialist referrals with medical context
   - Urgency levels
   - Accept/reject by specialists
   - Completion with outcome notes
   - Automated reminders

6. **Real-Time Messaging**
   - Socket.IO integration
   - One-on-one conversations
   - Text and file attachments
   - Typing indicators
   - Read receipts
   - Online/offline status

7. **Multi-Channel Notifications**
   - **Push Notifications:** OneSignal (iOS, Android, Web)
   - **Email Notifications:** Nodemailer with 9 HTML templates
   - **In-app Notifications:** Real-time via Socket.IO
   - User preferences (enable/disable by type and channel)
   - Quiet hours support

8. **Audit & Logging**
   - Kafka-based event capture
   - 7-year retention (compliance)
   - User activity timeline
   - Medical record access tracking
   - S3 archival for old logs

9. **API Gateway**
   - Centralized routing
   - Redis-based rate limiting
   - Request/response logging
   - Health check aggregation
   - CORS configuration
   - API versioning (/api/v1/)

10. **🤖 n8n Workflow Automation (INNOVATION)**
    - Intelligent appointment booking via multiple channels
    - WhatsApp, Telegram, Voice Assistant (Alexa, Google) integration
    - Automated doctor availability checks
    - Multi-channel confirmations (SMS, Email, WhatsApp)
    - Appointment reminders and rescheduling workflows
    - Waitlist automation

---

## 📁 Project Structure

```
pfa/
├── backend/
│   ├── api-gateway/              # API Gateway (Port 3000)
│   ├── services/
│   │   ├── auth-service/         # Port 3001
│   │   ├── user-service/         # Port 3002
│   │   ├── rdv-service/          # Port 3003
│   │   ├── medical-records-service/  # Port 3004
│   │   ├── referral-service/     # Port 3005
│   │   ├── messaging-service/    # Port 3006
│   │   ├── notification-service/ # Port 3007
│   │   └── audit-service/        # Port 3008
│   ├── shared/                   # Shared utilities, middleware, Kafka
│   │   ├── config/
│   │   ├── kafka/
│   │   ├── middleware/
│   │   └── utils/
│   ├── docker-compose.yml        # Main services (MongoDB, Redis)
│   ├── docker-compose.kafka.yml  # Kafka & Zookeeper
│   ├── start-all-services.ps1    # Start all services (Windows)
│   └── package.json
├── docs/                         # Technical documentation
│   ├── BACKEND_PROMPTS_OVERVIEW.md
│   ├── START_HERE.md
│   ├── N8N_AUTOMATION_GUIDE.md
│   ├── AWS_S3_SETUP_GUIDE.md
│   └── CODING_STYLE_GUIDE.md
├── PRODUCT_BACKLOG.md            # Complete product backlog (96 stories)
├── IMPLEMENTATION_ORDER.md       # What's been built
├── VERIFICATION_REPORT.md        # Testing results
├── COPILOT_CONTEXT.md           # THIS FILE
└── PROMPT_*.md                   # Implementation guides for each sprint
```

---

## 🔑 Key Implementation Details

### Authentication Flow
1. User registers → Email verification token sent
2. User verifies email → Account activated
3. User logs in → JWT token + refresh token issued
4. Protected routes validate JWT via middleware

### Event-Driven Architecture
```
Service A → Kafka Producer → Kafka Topic → Kafka Consumer → Service B
```
- All domain events published to Kafka
- Services consume events asynchronously
- Loose coupling between services

### Notification Flow
```
Action (e.g., appointment created) 
→ Kafka event published 
→ Notification Service consumes event 
→ Creates notification in DB 
→ Sends via channels (push, email, in-app) 
→ User receives notification
```

### File Upload Flow (Medical Documents)
```
Client → Upload endpoint → Multer middleware 
→ Validate file → Upload to AWS S3 
→ Store metadata in MongoDB 
→ Return file ID
```

### Real-Time Messaging
```
Client connects via Socket.IO 
→ Authenticates with JWT 
→ Joins conversation room 
→ Sends message via REST API 
→ Socket.IO broadcasts to room 
→ Other participants receive instantly
```

---

## 🚨 Known Issues & Technical Debt

### High Priority
1. **Import path errors** - Some services have incorrect import paths (../../../../shared)
2. **MongoDB replica set** - Required for change streams, using standalone with fallback
3. **Database indexes** - Need optimization for performance (Sprint 16)
4. **Unit tests** - Comprehensive tests needed (Sprint 15)

### Medium Priority
1. **Error handling** - Some endpoints need better error handling
2. **Request validation** - Add validation middleware for all endpoints
3. **Kafka retry logic** - Implement retry for failed events
4. **Logging levels** - Standardize logging across services

### Low Priority
1. **Code duplication** - Refactor shared logic into utilities
2. **Health checks** - Add dependency health checks
3. **Log rotation** - Implement log rotation strategy

---

## 🛠️ Development Commands

### Start Infrastructure
```powershell
# Start MongoDB + Redis
cd backend
docker-compose up -d

# Start Kafka + Zookeeper
docker-compose -f docker-compose.kafka.yml up -d
```

### Start All Services
```powershell
# Windows
.\start-all-services.ps1

# Or manually start each service
cd backend/services/auth-service && npm start
cd backend/services/user-service && npm start
# ... etc for all services
cd backend/api-gateway && npm start
```

### Test Endpoints
```powershell
# Health check
curl http://localhost:3000/health

# API docs
http://localhost:3000/api-docs
```

---

## 📝 Coding Standards

### File Naming
- Routes: `{entity}.routes.js` (e.g., `users.routes.js`)
- Controllers: `{entity}.controller.js`
- Models: `{Entity}.js` (capitalized, e.g., `User.js`)
- Services: `{entity}.service.js`

### API Conventions
- RESTful endpoints: `/api/v1/{resource}`
- JWT in header: `Authorization: Bearer <token>`
- Error responses: `{ error: "message", code: "ERROR_CODE" }`
- Success responses: `{ success: true, data: {...} }`

### Event Naming
- Format: `{domain}.{entity}.{action}`
- Examples: `auth.user.registered`, `rdv.appointment.confirmed`

### Database Collections
- Lowercase, underscore-separated
- Examples: `users`, `appointments`, `medical_consultations`

---

## 🎯 Next Steps (Sprint 12+)

### Sprint 12: Mobile Application - Core (IN PROGRESS)
- React Native project setup
- Authentication screens (login, register)
- Home dashboard
- Profile management
- Push notification integration

### Sprint 13: Mobile Application - Features
- Doctor search with geolocation
- Appointment booking flow
- Medical records viewer
- Real-time messaging UI

### Sprint 14: Web Admin Dashboard
- Admin authentication
- User management (list, suspend, view)
- System metrics and analytics
- Audit log viewer

### Sprint 15: Testing & Quality Assurance
- Unit tests (Jest)
- Integration tests
- End-to-end tests
- Security testing
- Bug fixes

### Sprint 16: Performance Optimization
- Database query optimization
- Caching strategies (Redis)
- Load testing
- MongoDB replica set setup

### Sprint 17: Deployment & Documentation
- CI/CD pipeline (GitHub Actions)
- Production infrastructure (AWS/Azure)
- Monitoring (Prometheus, Grafana)
- API documentation
- User training materials

---

## 📚 Important Files to Review

### For Understanding the Project
1. `PRODUCT_BACKLOG.md` - Complete backlog with all 96 user stories
2. `IMPLEMENTATION_ORDER.md` - What's been built and in what order
3. `docs/BACKEND_PROMPTS_OVERVIEW.md` - Overview of all prompts

### For Implementation Details
1. `PROMPT_*_Service_*.md` - Step-by-step implementation for each service
2. `PROMPT_*_IMPLEMENTATION_SUMMARY.md` - What was actually built
3. `docs/N8N_AUTOMATION_GUIDE.md` - n8n workflow setup

### For Development
1. `backend/START_SERVICES.md` - How to start services
2. `backend/DOCKER_SETUP.md` - Docker infrastructure
3. `docs/AWS_S3_SETUP_GUIDE.md` - S3 configuration
4. `docs/CODING_STYLE_GUIDE.md` - Coding standards

### For Testing
1. `VERIFICATION_REPORT.md` - Testing results
2. `backend/TEST_RESULTS.md` - API test results
3. `backend/test_api.py` - Test script

---

## 🤖 n8n Workflow Automation (Innovation Highlight)

### Overview
n8n workflow automation (US-11.6) enables intelligent, multi-channel appointment booking.

### Integration Channels
- 📱 WhatsApp Business API
- ✈️ Telegram Bot
- 🎤 Voice Assistants (Alexa Skills, Google Actions)
- 🌐 Web Widget
- 📧 Email-based requests

### Workflow Example
```
Patient via WhatsApp: "I need a cardiologist in Casablanca this week"

n8n Workflow:
1. Parse request (specialty: cardiology, location: Casablanca, timeframe: this week)
2. Call GET /api/v1/users/doctors/search?specialty=cardiology&city=Casablanca
3. For each doctor, call GET /api/v1/rdv/availability
4. Filter slots matching "this week"
5. Present 3 best options to patient
6. Patient selects "Wed 2pm"
7. Call POST /api/v1/rdv/appointments
8. Send confirmations (WhatsApp + Email + Push)
9. Log audit event

Total time: < 60 seconds (vs 5-10 minutes manual)
```

### Business Value
- 24/7 automated booking
- Reduced reception workload
- Better patient experience
- Higher booking conversion rates
- Scalable to unlimited requests

---

## 💡 Key Decisions & Architecture Choices

### Why Microservices?
- **Scalability:** Each service scales independently
- **Maintainability:** Clear separation of concerns
- **Technology flexibility:** Can use different tech stacks per service
- **Team autonomy:** Different teams can work on different services

### Why Kafka?
- **Asynchronous communication:** Services don't block each other
- **Event sourcing:** Complete audit trail of all events
- **Scalability:** Handles high throughput
- **Reliability:** Event persistence and replay capability

### Why MongoDB?
- **Flexible schema:** Healthcare data varies by use case
- **Geospatial queries:** Doctor search by location
- **Scalability:** Horizontal scaling with sharding
- **Document model:** Natural fit for medical records

### Why Socket.IO for Messaging?
- **Real-time:** Instant message delivery
- **Fallback support:** Works even without WebSocket support
- **Room management:** Easy conversation grouping
- **Presence:** Online/offline status tracking

### Why n8n?
- **Visual workflows:** Easy to design and modify
- **Pre-built integrations:** WhatsApp, Telegram, email, etc.
- **Self-hostable:** Data privacy for healthcare
- **Webhook support:** Easy external system integration

---

## 🔐 Security Considerations

### Implemented
- ✅ JWT authentication with refresh tokens
- ✅ Password hashing with bcrypt (10 rounds)
- ✅ Role-based access control (RBAC)
- ✅ API rate limiting (Redis-based)
- ✅ CORS configuration
- ✅ Input validation and sanitization
- ✅ Audit logging for sensitive operations
- ✅ Pre-signed URLs for S3 (expire after 1 hour)
- ✅ Medical record access tracking

### Planned (Sprint 15)
- 🔄 Penetration testing
- 🔄 SQL injection protection (already mitigated by MongoDB)
- 🔄 XSS protection
- 🔄 CSRF tokens
- 🔄 HTTPS enforcement (production)
- 🔄 Secrets management (AWS Secrets Manager / HashiCorp Vault)

---

## 📞 Contact & Support

### Project Team
- Development Team: Building the E-Santé platform
- Duration: 18 sprints (36 weeks / 9 months)
- Started: March 2025
- Current: Sprint 12 (November 2025)
- Estimated Completion: Sprint 17 (January 2026)

### Documentation
- All documentation in `/docs` folder
- Implementation guides in `PROMPT_*.md` files
- API documentation: `http://localhost:3000/api-docs`

---

## 🎓 How to Use This File with GitHub Copilot

### On a New Device
1. Clone the repository
2. Open this file (`COPILOT_CONTEXT.md`) in VS Code
3. Start a new Copilot chat
4. Say: "Please review COPILOT_CONTEXT.md to understand the project"
5. Copilot will have full context of the project state

### For Specific Tasks
- "Review the n8n automation section and help me add a new workflow"
- "Based on the technical debt section, help me fix import path errors"
- "Looking at Sprint 13 requirements, help me implement doctor search in mobile"

### For Code Generation
- "Following the coding standards in COPILOT_CONTEXT.md, create a new endpoint"
- "Generate tests based on the architecture described in COPILOT_CONTEXT.md"

---

## 📊 Quick Stats Summary

```
✅ Services Operational:     8/8 (100%)
✅ Sprints Completed:        11/18 (61%)
✅ User Stories Done:        60/96 (63%)
✅ Story Points Delivered:   533/838 (64%)
✅ Features Complete:        9 major feature sets
🔄 Current Focus:            Mobile Application
📋 Remaining:                7 sprints (14 weeks)
```

---

**End of Context File**

*This file is automatically maintained and should be updated whenever major milestones are reached or architectural decisions are made.*

**Last Major Update:** Sprint 11 completion - n8n workflow automation integrated  
**Next Review:** Sprint 12 completion - Mobile app core features
