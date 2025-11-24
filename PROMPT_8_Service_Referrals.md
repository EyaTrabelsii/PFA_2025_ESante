# PROMPT 8: Service Referrals - Doctor Referral System

## Objective
Build the doctor-to-doctor referral system allowing doctors to refer patients to specialists, view specialist availability, book appointments on behalf of patients, and track referral workflow.

## Requirements

### 1. Database Schema

#### Referral Model
```javascript
{
  // Referral Parties
  referringDoctorId: ObjectId (reference to Doctor, required, indexed),
  targetDoctorId: ObjectId (reference to Doctor, required, indexed),
  patientId: ObjectId (reference to Patient, required, indexed),
  
  // Referral Information
  referralDate: Date (required, default: now),
  reason: String (required), // Why patient needs specialist
  urgency: String (enum: ['routine', 'urgent', 'emergency'], default: 'routine'),
  specialty: String (required), // Target specialty
  
  // Medical Context
  diagnosis: String,
  symptoms: [String],
  relevantHistory: String, // Brief medical history
  currentMedications: String,
  specificConcerns: String, // What specialist should focus on
  
  // Attached Documents
  attachedDocuments: [ObjectId], // References to MedicalDocument
  includeFullHistory: Boolean (default: true), // Share full medical records
  
  // Appointment Booking
  appointmentId: ObjectId (reference to Appointment), // If booked
  isAppointmentBooked: Boolean (default: false),
  preferredDates: [Date], // Patient's preferred dates
  
  // Referral Status
  status: String (enum: [
    'pending',      // Created, waiting for appointment
    'scheduled',    // Appointment booked
    'accepted',     // Target doctor accepted
    'in_progress',  // Consultation happening
    'completed',    // Referral consultation done
    'rejected',     // Target doctor rejected
    'cancelled'     // Cancelled by any party
  ], default: 'pending'),
  
  // Status Updates
  statusHistory: [{
    status: String,
    timestamp: Date,
    updatedBy: ObjectId,
    notes: String
  }],
  
  // Communication
  referralNotes: String, // Notes from referring doctor
  responseNotes: String, // Notes from target doctor
  feedback: String, // Feedback after completion
  
  // Metadata
  expiryDate: Date, // Referral expires if not used
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
referralSchema.index({ referringDoctorId: 1, referralDate: -1 });
referralSchema.index({ targetDoctorId: 1, status: 1 });
referralSchema.index({ patientId: 1, referralDate: -1 });
referralSchema.index({ status: 1, urgency: 1 });
```

### 2. Core Features

#### A. Create Referral
**Endpoint:** `POST /api/v1/referrals`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "patientId": "patientId123",
  "targetDoctorId": "specialistId456",
  "reason": "Patient requires cardiology consultation for suspected coronary artery disease",
  "urgency": "urgent",
  "specialty": "Cardiology",
  "diagnosis": "Suspected angina pectoris with elevated cardiac enzymes",
  "symptoms": ["Chest pain", "Shortness of breath", "Fatigue"],
  "relevantHistory": "Patient has 5-year history of hypertension, currently on medication. Recent stress test showed abnormalities.",
  "currentMedications": "Aspirin 100mg daily, Atorvastatin 20mg daily, Metoprolol 50mg twice daily",
  "specificConcerns": "Please evaluate for possible coronary angiography. Patient experiencing increasing frequency of chest pain episodes.",
  "attachedDocuments": ["docId1", "docId2"],
  "includeFullHistory": true,
  "preferredDates": ["2025-11-20", "2025-11-21", "2025-11-22"],
  "referralNotes": "Please prioritize this patient due to symptom progression."
}
```

**Process:**
1. Authenticate referring doctor
2. Validate patient exists and doctor has treated them
3. Validate target doctor exists and specialty matches
4. Verify attached documents exist and belong to patient
5. Create referral with status: 'pending'
6. Set expiry date (e.g., 90 days from now)
7. Add to status history: "created"
8. Publish Kafka event: `referral.created`
9. Send notification to target doctor
10. Log in audit service
11. Return referral details

**Response:**
```json
{
  "success": true,
  "message": "Referral created successfully. Target doctor will be notified.",
  "data": {
    "referralId": "...",
    "targetDoctor": {
      "id": "...",
      "name": "Dr. Emily Johnson",
      "specialty": "Cardiology"
    },
    "patient": {
      "id": "...",
      "name": "John Doe"
    },
    "status": "pending",
    "urgency": "urgent",
    "expiryDate": "2026-02-10"
  }
}
```

#### B. Get Referral Details
**Endpoint:** `GET /api/v1/referrals/:referralId`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user (referring doctor, target doctor, or patient)
2. Find referral
3. Verify access:
   - Referring doctor can view
   - Target doctor can view
   - Patient can view their own
4. Populate all related data:
   - Patient info
   - Both doctors info
   - Attached documents (with signed URLs)
   - Appointment details (if booked)
5. Log access in audit
6. Return complete referral details

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "referralDate": "2025-11-10",
    "status": "scheduled",
    "urgency": "urgent",
    "referringDoctor": {
      "id": "...",
      "name": "Dr. Sarah Smith",
      "specialty": "General Practice"
    },
    "targetDoctor": {
      "id": "...",
      "name": "Dr. Emily Johnson",
      "specialty": "Cardiology"
    },
    "patient": {
      "id": "...",
      "name": "John Doe",
      "age": 45
    },
    "reason": "Patient requires cardiology consultation...",
    "diagnosis": "Suspected angina pectoris...",
    "symptoms": ["Chest pain", "Shortness of breath"],
    "relevantHistory": "...",
    "currentMedications": "...",
    "specificConcerns": "...",
    "attachedDocuments": [
      {
        "id": "...",
        "title": "Cardiac Enzyme Test",
        "type": "lab_result",
        "signedUrl": "..."
      }
    ],
    "appointment": {
      "id": "...",
      "date": "2025-11-20",
      "time": "14:00",
      "status": "confirmed"
    },
    "statusHistory": [
      {
        "status": "pending",
        "timestamp": "2025-11-10T10:00:00Z",
        "updatedBy": "Dr. Sarah Smith"
      },
      {
        "status": "scheduled",
        "timestamp": "2025-11-10T11:30:00Z",
        "updatedBy": "Dr. Sarah Smith",
        "notes": "Appointment booked for Nov 20"
      }
    ]
  }
}
```

#### C. Search Specialists for Referral
**Endpoint:** `GET /api/v1/referrals/search-specialists`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?specialty=cardiology
&city=paris
&latitude=48.8566
&longitude=2.3522
&radius=10
&availableAfter=2025-11-15
```

**Process:**
1. Authenticate doctor
2. Search doctors by specialty
3. Filter by location (if provided)
4. Check availability (if date provided)
5. Filter: isVerified=true, isActive=true
6. Sort by distance or rating
7. Return list of specialists

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Dr. Emily Johnson",
      "specialty": "Cardiology",
      "subSpecialty": "Interventional Cardiology",
      "clinicName": "Heart Center",
      "clinicAddress": {...},
      "distance": 3.2,
      "rating": 4.8,
      "yearsOfExperience": 15,
      "nextAvailable": "2025-11-18",
      "consultationFee": 120
    }
  ]
}
```

#### D. Book Appointment for Referral
**Endpoint:** `POST /api/v1/referrals/:referralId/book-appointment`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "appointmentDate": "2025-11-20",
  "appointmentTime": "14:00",
  "notes": "Urgent consultation requested"
}
```

**Process:**
1. Authenticate referring doctor
2. Find referral and verify ownership
3. Check referral status is 'pending' or 'accepted'
4. Verify target doctor's availability for date/time
5. Create appointment:
   - patientId, targetDoctorId
   - status: 'confirmed' (auto-confirmed for referrals)
   - isReferral: true
   - referredBy: current doctor
   - referralId: link to referral
6. Mark time slot as booked
7. Update referral:
   - appointmentId: link to appointment
   - isAppointmentBooked: true
   - status: 'scheduled'
8. Add to status history
9. Publish Kafka events:
   - `referral.scheduled`
   - `appointment.referral_booked`
10. Send notifications to patient and target doctor
11. Return appointment details

**Response:**
```json
{
  "success": true,
  "message": "Appointment booked successfully for patient",
  "data": {
    "referralId": "...",
    "appointmentId": "...",
    "appointmentDate": "2025-11-20",
    "appointmentTime": "14:00",
    "targetDoctor": "Dr. Emily Johnson",
    "status": "scheduled"
  }
}
```

#### E. Target Doctor: View Received Referrals
**Endpoint:** `GET /api/v1/referrals/received`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?status=pending
&urgency=urgent
&startDate=2025-11-01
&endDate=2025-11-30
&page=1
&limit=20
```

**Process:**
1. Authenticate target doctor
2. Get referrals where targetDoctorId = current doctor
3. Filter by status, urgency, date range
4. Sort by urgency (emergency > urgent > routine), then date
5. Populate patient and referring doctor info
6. Paginate results
7. Return list

**Response:**
```json
{
  "success": true,
  "data": {
    "referrals": [
      {
        "id": "...",
        "referralDate": "2025-11-10",
        "urgency": "urgent",
        "status": "pending",
        "patient": {
          "id": "...",
          "name": "John Doe",
          "age": 45
        },
        "referringDoctor": {
          "name": "Dr. Sarah Smith",
          "specialty": "General Practice"
        },
        "reason": "Patient requires cardiology consultation...",
        "diagnosis": "Suspected angina pectoris",
        "hasAppointment": false
      }
    ],
    "pagination": {...},
    "summary": {
      "pending": 5,
      "urgent": 2,
      "emergency": 0
    }
  }
}
```

#### F. Referring Doctor: View My Referrals
**Endpoint:** `GET /api/v1/referrals/sent`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?status=scheduled
&patientId=specificPatient
&page=1
&limit=20
```

**Process:**
1. Authenticate referring doctor
2. Get referrals where referringDoctorId = current doctor
3. Filter by status, patient
4. Sort by referralDate (desc)
5. Populate patient and target doctor info
6. Return list

#### G. Target Doctor: Accept Referral
**Endpoint:** `PUT /api/v1/referrals/:referralId/accept`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "responseNotes": "I will review the case and see the patient at scheduled time."
}
```

**Process:**
1. Authenticate target doctor
2. Find referral and verify target doctor
3. Check status is 'pending' or 'scheduled'
4. Update status to 'accepted'
5. Add responseNotes
6. Add to status history
7. Publish Kafka event: `referral.accepted`
8. Send notification to referring doctor
9. Return success

#### H. Target Doctor: Reject Referral
**Endpoint:** `PUT /api/v1/referrals/:referralId/reject`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "responseNotes": "I specialize in pediatric cardiology. Please refer to adult cardiologist.",
  "suggestedDoctors": ["doctorId1", "doctorId2"]
}
```

**Process:**
1. Authenticate target doctor
2. Find referral and verify target doctor
3. Update status to 'rejected'
4. Add responseNotes and suggested alternatives
5. Free up appointment slot (if was booked)
6. Add to status history
7. Publish Kafka event: `referral.rejected`
8. Send notification to referring doctor
9. Return success with suggested doctors

#### I. Complete Referral (After Consultation)
**Endpoint:** `PUT /api/v1/referrals/:referralId/complete`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "feedback": "Patient evaluated. Diagnosis confirmed as stable angina. Started on additional medication. Recommend follow-up in 3 months.",
  "consultationCreated": true
}
```

**Process:**
1. Authenticate target doctor
2. Find referral and verify target doctor
3. Check appointment is completed
4. Update status to 'completed'
5. Add feedback
6. Add to status history
7. Publish Kafka event: `referral.completed`
8. Send notification to referring doctor with feedback
9. Return success

#### J. Patient: View My Referrals
**Endpoint:** `GET /api/v1/referrals/my-referrals`

**Headers:**
```
Authorization: Bearer {patientToken}
```

**Process:**
1. Authenticate patient
2. Get all referrals for this patient
3. Sort by referralDate (desc)
4. Populate doctors info
5. Return list (simplified view)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "date": "2025-11-10",
      "referredBy": "Dr. Sarah Smith",
      "referredTo": "Dr. Emily Johnson",
      "specialty": "Cardiology",
      "reason": "Cardiology consultation",
      "status": "scheduled",
      "appointment": {
        "date": "2025-11-20",
        "time": "14:00"
      }
    }
  ]
}
```

#### K. Cancel Referral
**Endpoint:** `PUT /api/v1/referrals/:referralId/cancel`

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "cancellationReason": "Patient recovered, no longer needs specialist"
}
```

**Process:**
1. Authenticate user (referring doctor or patient)
2. Find referral
3. Verify user can cancel (owner or patient)
4. Update status to 'cancelled'
5. Cancel appointment (if booked)
6. Free up time slot
7. Add to status history
8. Publish Kafka event: `referral.cancelled`
9. Send notifications
10. Return success

### 3. Referral Statistics
**Endpoint:** `GET /api/v1/referrals/statistics`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**For Referring Doctor:**
```json
{
  "success": true,
  "data": {
    "totalReferralsSent": 45,
    "pending": 5,
    "scheduled": 8,
    "completed": 30,
    "rejected": 2,
    "topSpecialties": [
      {"specialty": "Cardiology", "count": 15},
      {"specialty": "Orthopedics", "count": 10}
    ]
  }
}
```

**For Target Doctor:**
```json
{
  "success": true,
  "data": {
    "totalReferralsReceived": 120,
    "pending": 10,
    "completed": 95,
    "topReferringSources": [
      {"doctor": "Dr. Sarah Smith", "count": 25}
    ]
  }
}
```

### 4. Kafka Events Published

```javascript
// referral.created
{
  eventType: 'referral.created',
  referralId: '...',
  referringDoctorId: '...',
  targetDoctorId: '...',
  patientId: '...',
  urgency: 'urgent',
  specialty: 'Cardiology',
  timestamp: Date.now()
}

// referral.scheduled
{
  eventType: 'referral.scheduled',
  referralId: '...',
  appointmentId: '...',
  appointmentDate: '...',
  timestamp: Date.now()
}

// referral.accepted / rejected / completed / cancelled
{
  eventType: 'referral.accepted',
  referralId: '...',
  targetDoctorId: '...',
  timestamp: Date.now()
}
```

### 5. Validation & Business Rules
- Referring doctor must have treated patient
- Target doctor must be active and verified
- Specialty must match target doctor's specialty
- Cannot refer to same doctor twice for same condition (within time window)
- Referrals expire after 90 days (configurable)
- Only relevant parties can access referral details
- Full medical history sharing requires patient consent (implicit)

## API Endpoints Summary
```
POST   /api/v1/referrals
GET    /api/v1/referrals/:referralId
POST   /api/v1/referrals/:referralId/book-appointment
PUT    /api/v1/referrals/:referralId/accept
PUT    /api/v1/referrals/:referralId/reject
PUT    /api/v1/referrals/:referralId/complete
PUT    /api/v1/referrals/:referralId/cancel
GET    /api/v1/referrals/search-specialists
GET    /api/v1/referrals/sent (referring doctor)
GET    /api/v1/referrals/received (target doctor)
GET    /api/v1/referrals/my-referrals (patient)
GET    /api/v1/referrals/statistics
```

## Deliverables
1. ✅ Referral model with complete workflow
2. ✅ Create referral endpoint
3. ✅ Search specialists
4. ✅ Book appointment for referral
5. ✅ Accept/reject referral
6. ✅ Complete referral with feedback
7. ✅ Cancel referral
8. ✅ View referrals (sent/received/patient)
9. ✅ Referral statistics
10. ✅ Status tracking and history
11. ✅ Kafka event publishers
12. ✅ Audit logging

## Testing Checklist
- [ ] Doctor creates referral
- [ ] Search specialists works
- [ ] Book appointment for patient
- [ ] Target doctor receives notification
- [ ] Target doctor accepts referral
- [ ] Target doctor rejects referral
- [ ] Appointment links to referral correctly
- [ ] Complete referral workflow
- [ ] Patient views their referrals
- [ ] Referral expiry works
- [ ] Status history tracks all changes
- [ ] Notifications sent correctly

---

**Next Step:** After this prompt is complete, proceed to PROMPT 9 (Service Messaging)
