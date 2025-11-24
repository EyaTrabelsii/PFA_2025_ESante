# E-Santé Backend - Implementation Order

## 📋 Complete Implementation Guide

This document shows the **correct order** for implementing all backend prompts. Follow these in sequence for best results.

---

## ✅ 18 Active Prompts (Total: ~50-60 hours)

### **Phase 1: Infrastructure Setup** (4 prompts | ~8-11 hours)

1. **PROMPT_1A_Folder_Structure_MongoDB.md** ⏱️ 1-2 hours
   - Create backend folder structure
   - Setup MongoDB connection
   - Configure root package.json with workspaces
   - **Next:** PROMPT_1B

2. **PROMPT_1B_Shared_Middleware_Utilities.md** ⏱️ 2-3 hours
   - JWT authentication middleware
   - Custom error classes
   - Validation helpers
   - Response formatters
   - **Dependencies:** PROMPT_1A
   - **Next:** PROMPT_1C

3. **PROMPT_1C_Kafka_Infrastructure.md** ⏱️ 2-3 hours
   - Kafka Docker Compose setup
   - Producer and Consumer utilities
   - Topic definitions (50+ topics)
   - Event schemas
   - **Dependencies:** PROMPT_1A, PROMPT_1B
   - **Next:** PROMPT_1D

4. **PROMPT_1D_API_Gateway.md** ⏱️ 2-3 hours
   - Express API Gateway server
   - Service routing configuration
   - Rate limiting with Redis
   - Health monitoring
   - Complete Docker Compose
   - **Dependencies:** PROMPT_1A, PROMPT_1B, PROMPT_1C
   - **Next:** PROMPT_2A

---

### **Phase 2: Authentication** (2 prompts | ~4-6 hours)

5. **PROMPT_2A_Auth_Core.md** ⏱️ 2-3 hours
   - User model with bcrypt
   - Registration (temporarily auto-verified)
   - Login with JWT tokens
   - Refresh token mechanism
   - **Dependencies:** Phase 1 complete
   - **Next:** PROMPT_2B

6. **PROMPT_2B_Auth_Email_Password.md** ⏱️ 2-3 hours
   - Nodemailer email service
   - Email verification (enable for login)
   - Password reset flow
   - HTML email templates
   - **Dependencies:** PROMPT_2A
   - **Next:** PROMPT_3

---

### **Phase 3: Core Services** (5 prompts | ~15-20 hours)

7. **PROMPT_3_Service_Users.md** ⏱️ 3-4 hours
   - Patient and Doctor profiles
   - AWS S3 photo upload
   - Doctor search with geolocation (2dsphere)
   - **Dependencies:** PROMPT_2A, PROMPT_2B
   - **Next:** PROMPT_4

8. **PROMPT_4_Service_RDV.md** ⏱️ 3-4 hours
   - TimeSlot model (doctor availability)
   - Appointment model (status workflow)
   - Booking and confirmation flow
   - Referral-based auto-confirmed bookings
   - **Dependencies:** PROMPT_3
   - **Next:** PROMPT_5

9. **PROMPT_5_Medical_Records_Consultations.md** ⏱️ 3-4 hours
   - Consultation model with vital signs
   - Patient medical timeline (chronological)
   - Doctor access control
   - Search by symptoms/diagnosis
   - **Dependencies:** PROMPT_4
   - **Next:** PROMPT_6

10. **PROMPT_6_Medical_Records_Prescriptions.md** ⏱️ 3-4 hours
    - Prescription model with medications array
    - 1-hour edit window with auto-lock
    - Modification history tracking
    - Background job for auto-locking
    - **Dependencies:** PROMPT_5
    - **Next:** PROMPT_7

11. **PROMPT_7_Medical_Records_Documents.md** ⏱️ 3-4 hours
    - MedicalDocument model
    - AWS S3 document storage (PDF/images)
    - Signed URL generation (1-hour expiry)
    - Document sharing controls
    - **Dependencies:** PROMPT_5
    - **Next:** PROMPT_8

---

### **Phase 4: Advanced Services** (2 prompts | ~7-9 hours)

12. **PROMPT_8_Service_Referrals.md** ⏱️ 3-4 hours
    - Referral model (doctor-to-doctor)
    - Search specialists by specialty/location
    - Book appointments on behalf of patients
    - Accept/reject workflow
    - **Dependencies:** PROMPT_3, PROMPT_4
    - **Next:** PROMPT_9

13. **PROMPT_9_Service_Messaging.md** ⏱️ 4-5 hours
    - Conversation and Message models
    - Socket.IO real-time messaging
    - Typing indicators and read receipts
    - Online/offline status
    - File attachments
    - **Dependencies:** Phase 1-3 complete
    - **Next:** PROMPT_10A

---

### **Phase 5: Cross-Cutting Services** (3 prompts | ~8-11 hours)

14. **PROMPT_10A_Notifications_Push.md** ⏱️ 3-4 hours
    - Notification model with preferences
    - OneSignal push notification integration
    - Kafka event consumers (7 topics)
    - Device registration
    - In-app notifications via Socket.IO
    - Background job for scheduled notifications
    - **Dependencies:** All services built (2-9)
    - **Next:** PROMPT_10B

15. **PROMPT_10B_Notifications_Email.md** ⏱️ 2-3 hours
    - Nodemailer setup
    - 9+ HTML email templates (appointments, referrals, prescriptions, etc.)
    - Email delivery integration
    - Quiet hours implementation
    - Complete multi-channel flow
    - **Dependencies:** PROMPT_10A
    - **Next:** PROMPT_11

16. **PROMPT_11_Service_Audit.md** ⏱️ 3-4 hours
    - AuditLog model
    - Kafka consumers for all events
    - Track all critical actions
    - Admin audit log viewer
    - Security event monitoring
    - Export and compliance reports
    - **Dependencies:** All services built
    - **Next:** Testing & Deployment

---

## 🗑️ Removed Prompts (Redundant)

These prompts were **removed** because they duplicate content already covered:

- ❌ **PROMPT_12_Kafka_Integration** → Already covered in **PROMPT_1C**
- ❌ **PROMPT_13_API_Gateway** → Already covered in **PROMPT_1D**

*Files moved to `archive/` folder*

---

## 📁 File Organization

```
pfa/
├── IMPLEMENTATION_ORDER.md          ← YOU ARE HERE
├── PROMPT_1A_Folder_Structure_MongoDB.md
├── PROMPT_1B_Shared_Middleware_Utilities.md
├── PROMPT_1C_Kafka_Infrastructure.md
├── PROMPT_1D_API_Gateway.md
├── PROMPT_2A_Auth_Core.md
├── PROMPT_2B_Auth_Email_Password.md
├── PROMPT_3_Service_Users.md
├── PROMPT_4_Service_RDV.md
├── PROMPT_5_Medical_Records_Consultations.md
├── PROMPT_6_Medical_Records_Prescriptions.md
├── PROMPT_7_Medical_Records_Documents.md
├── PROMPT_8_Service_Referrals.md
├── PROMPT_9_Service_Messaging.md
├── PROMPT_10A_Notifications_Push.md
├── PROMPT_10B_Notifications_Email.md
├── PROMPT_11_Service_Audit.md
├── docs/                            ← Documentation
│   ├── START_HERE.md
│   ├── README_BACKEND_PROMPTS.md
│   ├── BACKEND_PROMPTS_OVERVIEW.md
│   ├── PROMPT_1_IMPROVEMENTS.md
│   ├── PROMPT_2_IMPROVEMENTS.md
│   ├── PROMPT_10_IMPROVEMENTS.md
│   ├── PROMPT_12_REDUNDANCY_NOTE.md
│   └── PROMPT_13_REDUNDANCY_NOTE.md
├── archive/                         ← Old/redundant files
│   ├── PROMPT_1_Project_Structure_OLD.md
│   ├── PROMPT_2_Service_Auth_OLD.md
│   ├── PROMPT_10_Service_Notifications_OLD.md
│   ├── PROMPT_12_Kafka_Integration_REDUNDANT.md
│   └── PROMPT_13_API_Gateway_REDUNDANT.md
├── backend/                         ← Implementation (will be created)
├── mobile/
└── web admin/
```

---

## 🔗 Dependency Chain

```
1A (Foundation)
  ↓
1B (Middleware) 
  ↓
1C (Kafka)
  ↓
1D (API Gateway)
  ↓
2A (Auth Core)
  ↓
2B (Auth Email)
  ↓
3 (Users) ──────┐
  ↓             │
4 (Appointments)│
  ↓             │
5 (Consultations)
  ├─→ 6 (Prescriptions)
  └─→ 7 (Documents)
      ↓
8 (Referrals) ←─┘
  ↓
9 (Messaging)
  ↓
10A (Notifications Push)
  ↓
10B (Notifications Email)
  ↓
11 (Audit)
```

---

## ✅ Implementation Checklist

Use this to track your progress:

### Phase 1: Infrastructure
- [x] 1A: Folder Structure + MongoDB
- [x] 1B: Shared Middleware
- [x] 1C: Kafka Infrastructure
- [x] 1D: API Gateway

### Phase 2: Authentication
- [x] 2A: Auth Core
- [x] 2B: Auth Email & Password

### Phase 3: Core Services
- [x] 3: User Service
- [x] 4: Appointments
- [x] 5: Consultations
- [ ] 6: Prescriptions
- [ ] 7: Medical Documents

### Phase 4: Advanced Services
- [ ] 8: Referrals
- [ ] 9: Messaging

### Phase 5: Cross-Cutting
- [ ] 10A: Notifications Push
- [ ] 10B: Notifications Email
- [ ] 11: Audit Service

---

## 🚀 Quick Start

1. **Start here:** Open `PROMPT_1A_Folder_Structure_MongoDB.md`
2. **Follow in order:** Complete each prompt before moving to the next
3. **Test incrementally:** Test each service as you build it
4. **Reference docs:** Check `docs/` folder for detailed explanations

---

## 📊 Time Estimates by Phase

| Phase | Prompts | Total Time |
|-------|---------|------------|
| Phase 1: Infrastructure | 4 | 8-11 hours |
| Phase 2: Authentication | 2 | 4-6 hours |
| Phase 3: Core Services | 5 | 15-20 hours |
| Phase 4: Advanced Services | 2 | 7-9 hours |
| Phase 5: Cross-Cutting | 3 | 8-11 hours |
| **TOTAL** | **18** | **~50-60 hours** |

---

## 🎯 Key Principles

1. **Sequential Implementation**: Follow the order - each prompt depends on previous ones
2. **Test After Each Prompt**: Ensure each service works before moving on
3. **No Skipping Infrastructure**: Phase 1 must be completed first
4. **Incremental Complexity**: Services get more complex as you progress
5. **Complete Before Splitting**: Don't split work across phases

---

**Ready to start? Open `PROMPT_1A_Folder_Structure_MongoDB.md`** 🚀
