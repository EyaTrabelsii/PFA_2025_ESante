# PROMPT 5: Service Medical Records - Part 1: Consultations

## Objective
Build the consultation management system that records doctor-patient interactions and provides a complete medical timeline for each patient.

## Requirements

### 1. Database Schema

#### Consultation Model
```javascript
{
  appointmentId: ObjectId (reference to Appointment, required, unique),
  patientId: ObjectId (reference to Patient, required, indexed),
  doctorId: ObjectId (reference to Doctor, required, indexed),
  
  consultationDate: Date (required),
  consultationType: String (enum: ['in-person', 'follow-up', 'referral'], default: 'in-person'),
  
  // Chief Complaint
  chiefComplaint: String (required), // Main reason for visit
  
  // Medical Note (Doctor's observations)
  medicalNote: {
    symptoms: [String],
    diagnosis: String,
    physicalExamination: String,
    vitalSigns: {
      temperature: Number, // Celsius
      bloodPressure: String, // "120/80"
      heartRate: Number, // bpm
      respiratoryRate: Number, // breaths/min
      oxygenSaturation: Number, // percentage
      weight: Number, // kg
      height: Number // cm
    },
    labResults: String, // Doctor's notes on lab results
    additionalNotes: String
  },
  
  // References to related records
  prescriptionId: ObjectId (reference to Prescription - created separately),
  documentIds: [ObjectId] (references to MedicalDocument),
  
  // Follow-up
  requiresFollowUp: Boolean (default: false),
  followUpDate: Date,
  followUpNotes: String,
  
  // Referral Information
  isFromReferral: Boolean (default: false),
  referralId: ObjectId (reference to Referral),
  
  // Status
  status: String (enum: ['draft', 'completed', 'archived'], default: 'completed'),
  
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId (doctorId),
  lastModifiedBy: ObjectId (doctorId)
}

// Indexes
consultationSchema.index({ patientId: 1, consultationDate: -1 });
consultationSchema.index({ doctorId: 1, consultationDate: -1 });
consultationSchema.index({ appointmentId: 1 }, { unique: true });
```

### 2. Core Features

#### A. Create Consultation (After Appointment Completion)
**Endpoint:** `POST /api/v1/medical/consultations`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "appointmentId": "appointmentId123",
  "chiefComplaint": "Patient complains of chest pain and shortness of breath",
  "medicalNote": {
    "symptoms": ["Chest pain", "Shortness of breath", "Fatigue"],
    "diagnosis": "Suspected angina pectoris, requires further cardiac evaluation",
    "physicalExamination": "Patient appears in mild distress. Chest auscultation reveals normal S1/S2 with no murmurs.",
    "vitalSigns": {
      "temperature": 36.8,
      "bloodPressure": "145/90",
      "heartRate": 88,
      "respiratoryRate": 18,
      "oxygenSaturation": 97,
      "weight": 75.5,
      "height": 175
    },
    "additionalNotes": "Patient has history of hypertension. Recommend ECG and cardiac enzyme tests."
  },
  "requiresFollowUp": true,
  "followUpDate": "2025-12-01",
  "followUpNotes": "Review test results and adjust treatment plan"
}
```

**Process:**
1. Authenticate doctor
2. Verify appointment exists and status is 'completed'
3. Verify doctor owns this appointment
4. Check consultation doesn't already exist for this appointment
5. Create consultation with status: 'completed'
6. Publish Kafka event: `consultation.created`
7. Log action in audit service
8. Return consultation details

**Automatic Trigger:**
- Can be triggered automatically when appointment status changes to 'completed'
- Or doctor manually creates after the visit

#### B. Get Consultation by ID
**Endpoint:** `GET /api/v1/medical/consultations/:consultationId`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user (doctor or patient)
2. Find consultation
3. Verify access:
   - If patient: must be the patient of this consultation
   - If doctor: can view any consultation for patients they've treated
4. Populate patient and doctor info
5. Populate prescription and documents
6. Log access in audit service
7. Return consultation details

#### C. Update Consultation
**Endpoint:** `PUT /api/v1/medical/consultations/:consultationId`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "medicalNote": {
    "additionalNotes": "Updated after reviewing lab results: Cardiac enzymes elevated, recommend immediate cardiology referral"
  },
  "requiresFollowUp": true,
  "followUpDate": "2025-11-25"
}
```

**Process:**
1. Authenticate doctor
2. Find consultation
3. Verify doctor owns this consultation
4. Update allowed fields only (cannot change patientId, doctorId, etc.)
5. Set lastModifiedBy
6. Publish Kafka event: `consultation.updated`
7. Log modification in audit service
8. Return updated consultation

**Business Rule:**
- Only the doctor who created the consultation can update it
- Cannot modify after 24 hours (optional rule for data integrity)

#### D. Get Patient Medical Timeline
**Endpoint:** `GET /api/v1/medical/patients/:patientId/timeline`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?startDate=2024-01-01
&endDate=2025-12-31
&doctorId=specificDoctorId (optional - filter by specific doctor)
&page=1
&limit=50
```

**Process:**
1. Authenticate doctor
2. Get all consultations for patient
3. Filter by date range
4. Filter by doctor if specified
5. Sort by consultationDate (desc - newest first)
6. Populate doctor info for each consultation
7. Include prescription and document summaries
8. Paginate results
9. Log access in audit service
10. Return timeline

**Response:**
```json
{
  "success": true,
  "data": {
    "patient": {
      "id": "...",
      "name": "John Doe",
      "dateOfBirth": "1980-05-15"
    },
    "timeline": [
      {
        "consultationId": "...",
        "date": "2025-11-10",
        "doctor": {
          "id": "...",
          "name": "Dr. Sarah Smith",
          "specialty": "Cardiology"
        },
        "chiefComplaint": "Chest pain",
        "diagnosis": "Angina pectoris",
        "hasPrescription": true,
        "documentCount": 3
      },
      {
        "consultationId": "...",
        "date": "2025-10-20",
        "doctor": {
          "id": "...",
          "name": "Dr. Michael Johnson",
          "specialty": "General Practice"
        },
        "chiefComplaint": "Annual checkup",
        "diagnosis": "Hypertension - controlled",
        "hasPrescription": true,
        "documentCount": 1
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalConsultations": 25
    }
  }
}
```

#### E. Get Consultation Full Details (for Doctor View)
**Endpoint:** `GET /api/v1/medical/consultations/:consultationId/full`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Process:**
1. Authenticate doctor
2. Find consultation
3. Verify doctor has treated this patient (automatic access rule)
4. Populate all related data:
   - Patient full profile
   - Prescription details (if exists)
   - All medical documents
   - Previous consultations summary
5. Log detailed access in audit service
6. Return complete consultation details

**Response:**
```json
{
  "success": true,
  "data": {
    "consultation": {
      "id": "...",
      "date": "2025-11-10",
      "chiefComplaint": "...",
      "medicalNote": {...},
      "doctor": {...}
    },
    "patient": {
      "id": "...",
      "name": "John Doe",
      "age": 45,
      "bloodType": "O+",
      "allergies": ["Penicillin"],
      "chronicDiseases": ["Hypertension"]
    },
    "prescription": {
      "id": "...",
      "medications": [...]
    },
    "documents": [
      {
        "id": "...",
        "type": "lab_result",
        "name": "Cardiac Enzyme Test",
        "uploadedDate": "2025-11-10"
      }
    ],
    "previousConsultations": [
      {
        "id": "...",
        "date": "2025-10-20",
        "doctor": "Dr. Michael Johnson",
        "diagnosis": "Hypertension"
      }
    ]
  }
}
```

#### F. Get Doctor's Consultation History
**Endpoint:** `GET /api/v1/medical/doctors/my-consultations`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?startDate=2025-11-01
&endDate=2025-11-30
&page=1
&limit=20
```

**Process:**
1. Authenticate doctor
2. Get consultations where doctorId = current doctor
3. Filter by date range
4. Sort by consultationDate (desc)
5. Populate patient info
6. Paginate results
7. Return list

#### G. Search Patient History
**Endpoint:** `GET /api/v1/medical/patients/:patientId/search`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?keyword=hypertension
&diagnosis=angina
&dateFrom=2024-01-01
&dateTo=2025-12-31
```

**Process:**
1. Authenticate doctor
2. Search consultations for patient:
   - Text search in diagnosis, symptoms, chiefComplaint
   - Filter by date range
3. Return matching consultations
4. Log search in audit service

#### H. Patient: View My Medical History
**Endpoint:** `GET /api/v1/medical/patients/my-history`

**Headers:**
```
Authorization: Bearer {patientToken}
```

**Query Parameters:**
```
?page=1
&limit=20
```

**Process:**
1. Authenticate patient
2. Get all consultations for this patient
3. Sort by date (desc)
4. Populate doctor info
5. Return simplified view (patient-friendly)
6. Return list

**Response (Simplified for Patient):**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "date": "2025-11-10",
      "doctor": {
        "name": "Dr. Sarah Smith",
        "specialty": "Cardiology"
      },
      "reason": "Chest pain consultation",
      "diagnosis": "Angina pectoris",
      "hasPrescription": true,
      "hasDocuments": true
    }
  ]
}
```

### 3. Consultation Statistics
**Endpoint:** `GET /api/v1/medical/statistics/consultations`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalConsultations": 250,
    "thisMonth": 35,
    "thisWeek": 12,
    "today": 3,
    "commonDiagnoses": [
      {"diagnosis": "Hypertension", "count": 45},
      {"diagnosis": "Diabetes Type 2", "count": 30}
    ]
  }
}
```

### 4. Kafka Events Published

```javascript
// consultation.created
{
  eventType: 'consultation.created',
  consultationId: '...',
  appointmentId: '...',
  patientId: '...',
  doctorId: '...',
  consultationDate: '...',
  diagnosis: '...',
  timestamp: Date.now()
}

// consultation.updated
{
  eventType: 'consultation.updated',
  consultationId: '...',
  updatedBy: '...',
  changes: ['medicalNote.additionalNotes', 'followUpDate'],
  timestamp: Date.now()
}

// consultation.accessed
{
  eventType: 'consultation.accessed',
  consultationId: '...',
  accessedBy: '...',
  accessType: 'full_view', // or 'timeline_view'
  timestamp: Date.now()
}
```

### 5. Audit Logging
Every consultation access and modification should be logged:
```javascript
{
  action: 'consultation.viewed',
  performedBy: 'doctorId',
  resourceType: 'consultation',
  resourceId: 'consultationId',
  patientId: 'patientId',
  ipAddress: '...',
  userAgent: '...',
  timestamp: Date.now()
}
```

### 6. Validation & Business Rules
- Only doctors can create consultations
- Consultation must be linked to a completed appointment
- Any doctor can view consultations of patients they've treated
- Patient can view their own medical history
- Consultation cannot be deleted (only archived)
- Sensitive medical data requires proper access logging

### 7. Privacy & Security
- All access to patient medical records must be logged
- Doctors can only access patients they have treated or are currently treating
- Patient consent is implicit when they book appointment
- Data encryption at rest (MongoDB encryption)
- HTTPS for all communications

## API Endpoints Summary
```
POST   /api/v1/medical/consultations
GET    /api/v1/medical/consultations/:consultationId
PUT    /api/v1/medical/consultations/:consultationId
GET    /api/v1/medical/consultations/:consultationId/full
GET    /api/v1/medical/patients/:patientId/timeline
GET    /api/v1/medical/patients/:patientId/search
GET    /api/v1/medical/doctors/my-consultations
GET    /api/v1/medical/patients/my-history
GET    /api/v1/medical/statistics/consultations
```

## Deliverables
1. ✅ Consultation model with comprehensive medical fields
2. ✅ Create consultation endpoint
3. ✅ Update consultation endpoint
4. ✅ Patient medical timeline view
5. ✅ Full consultation details for doctors
6. ✅ Doctor's consultation history
7. ✅ Patient view their history
8. ✅ Search functionality
9. ✅ Consultation statistics
10. ✅ Kafka event publishers
11. ✅ Audit logging integration
12. ✅ Access control and security

## Testing Checklist
- [ ] Doctor creates consultation after appointment
- [ ] Doctor views consultation details
- [ ] Doctor updates consultation notes
- [ ] Doctor views patient timeline
- [ ] Timeline shows all doctors who treated patient
- [ ] Patient views their medical history
- [ ] Access control works (doctors can't access random patients)
- [ ] Automatic access for treating doctors
- [ ] Audit logs record all access
- [ ] Search works correctly

---

**Next Step:** After this prompt is complete, proceed to PROMPT 6 (Medical Records Part 2 - Prescriptions)
