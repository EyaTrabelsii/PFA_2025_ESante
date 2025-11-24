# PROMPT 6: Service Medical Records - Part 2: Prescriptions (Ordonnances)

## Objective
Build the prescription management system with multiple medications, 1-hour edit window, auto-lock functionality, and modification history tracking.

## Requirements

### 1. Database Schema

#### Prescription Model (Ordonnance)
```javascript
{
  consultationId: ObjectId (reference to Consultation, required, unique),
  patientId: ObjectId (reference to Patient, required, indexed),
  doctorId: ObjectId (reference to Doctor, required, indexed),
  
  prescriptionDate: Date (required, default: now),
  
  // Medications array
  medications: [{
    medicationName: String (required),
    dosage: String (required), // "500mg", "10ml"
    form: String, // "tablet", "capsule", "syrup", "injection"
    frequency: String (required), // "twice daily", "3 times a day", "every 6 hours"
    duration: String (required), // "7 days", "2 weeks", "1 month"
    instructions: String, // "Take after meals", "Take on empty stomach"
    quantity: Number, // Total quantity prescribed
    notes: String // Additional notes
  }],
  
  // General prescription notes
  generalInstructions: String,
  specialWarnings: String,
  
  // Edit Lock System (1 hour window)
  isLocked: Boolean (default: false),
  lockedAt: Date, // Auto-calculated: createdAt + 1 hour
  canEditUntil: Date (default: createdAt + 1 hour),
  
  // Modification History (Audit Trail)
  modificationHistory: [{
    modifiedAt: Date,
    modifiedBy: ObjectId (doctorId),
    changeType: String, // "created", "updated", "locked"
    changes: Object, // What was changed
    previousData: Object // Snapshot before change
  }],
  
  // Status
  status: String (enum: ['active', 'completed', 'cancelled'], default: 'active'),
  
  // Pharmacy Information (optional)
  pharmacyName: String,
  pharmacyAddress: String,
  
  createdAt: Date,
  updatedAt: Date,
  createdBy: ObjectId (doctorId)
}

// Indexes
prescriptionSchema.index({ patientId: 1, prescriptionDate: -1 });
prescriptionSchema.index({ doctorId: 1, prescriptionDate: -1 });
prescriptionSchema.index({ consultationId: 1 }, { unique: true });
prescriptionSchema.index({ canEditUntil: 1 }); // For locking queries

// Pre-save hook to calculate lock time
prescriptionSchema.pre('save', function(next) {
  if (this.isNew) {
    this.canEditUntil = new Date(this.createdAt.getTime() + 60 * 60 * 1000); // +1 hour
    this.lockedAt = this.canEditUntil;
  }
  next();
});

// Method to check if editable
prescriptionSchema.methods.isEditable = function() {
  return !this.isLocked && new Date() < this.canEditUntil;
};

// Method to auto-lock if time expired
prescriptionSchema.methods.checkAndLock = function() {
  if (!this.isLocked && new Date() >= this.canEditUntil) {
    this.isLocked = true;
    this.modificationHistory.push({
      modifiedAt: new Date(),
      changeType: 'auto_locked',
      changes: { isLocked: true }
    });
    return this.save();
  }
  return Promise.resolve(this);
};
```

#### Medication Model (Optional - for autocomplete/suggestions)
```javascript
{
  name: String (required, unique),
  genericName: String,
  category: String, // "Antibiotic", "Analgesic", "Antihypertensive"
  commonDosages: [String], // ["500mg", "1000mg"]
  commonForms: [String], // ["tablet", "capsule"]
  sideEffects: [String],
  contraindications: [String],
  isActive: Boolean (default: true)
}
```

### 2. Core Features

#### A. Create Prescription
**Endpoint:** `POST /api/v1/medical/prescriptions`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "consultationId": "consultationId123",
  "medications": [
    {
      "medicationName": "Aspirin",
      "dosage": "100mg",
      "form": "tablet",
      "frequency": "Once daily",
      "duration": "30 days",
      "instructions": "Take after breakfast",
      "quantity": 30,
      "notes": "For cardiovascular protection"
    },
    {
      "medicationName": "Atorvastatin",
      "dosage": "20mg",
      "form": "tablet",
      "frequency": "Once daily at bedtime",
      "duration": "30 days",
      "instructions": "Take before sleep",
      "quantity": 30
    },
    {
      "medicationName": "Metoprolol",
      "dosage": "50mg",
      "form": "tablet",
      "frequency": "Twice daily",
      "duration": "30 days",
      "instructions": "Take morning and evening",
      "quantity": 60
    }
  ],
  "generalInstructions": "Complete the full course. Do not stop medications without consulting doctor.",
  "specialWarnings": "Monitor blood pressure regularly. Report any unusual bleeding."
}
```

**Process:**
1. Authenticate doctor
2. Verify consultation exists
3. Verify doctor owns the consultation
4. Validate medications array (must have at least 1 medication)
5. Check prescription doesn't already exist for this consultation
6. Create prescription with:
   - canEditUntil = now + 1 hour
   - isLocked = false
7. Add to modification history: "created"
8. Link prescription to consultation
9. Publish Kafka event: `prescription.created`
10. Log in audit service
11. Return prescription details with edit deadline

**Response:**
```json
{
  "success": true,
  "message": "Prescription created successfully. You can edit it for 1 hour.",
  "data": {
    "prescriptionId": "...",
    "canEditUntil": "2025-11-10T15:30:00Z",
    "remainingEditTime": "59 minutes",
    "medications": [...],
    "isEditable": true
  }
}
```

#### B. Get Prescription by ID
**Endpoint:** `GET /api/v1/medical/prescriptions/:prescriptionId`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user (doctor or patient)
2. Find prescription
3. Check and auto-lock if time expired
4. Verify access:
   - Patient: must be the patient
   - Doctor: can view if treated this patient
5. Populate consultation, patient, doctor info
6. Calculate remaining edit time
7. Log access in audit
8. Return prescription

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "prescriptionDate": "2025-11-10T14:30:00Z",
    "doctor": {
      "name": "Dr. Sarah Smith",
      "specialty": "Cardiology",
      "licenseNumber": "ABC123"
    },
    "patient": {
      "name": "John Doe"
    },
    "medications": [
      {
        "medicationName": "Aspirin",
        "dosage": "100mg",
        "form": "tablet",
        "frequency": "Once daily",
        "duration": "30 days",
        "instructions": "Take after breakfast",
        "quantity": 30
      }
    ],
    "generalInstructions": "...",
    "isLocked": true,
    "canEditUntil": "2025-11-10T15:30:00Z",
    "isEditable": false
  }
}
```

#### C. Update Prescription (Within 1 Hour)
**Endpoint:** `PUT /api/v1/medical/prescriptions/:prescriptionId`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "medications": [
    {
      "medicationName": "Aspirin",
      "dosage": "150mg", // CHANGED from 100mg
      "form": "tablet",
      "frequency": "Once daily",
      "duration": "30 days",
      "instructions": "Take after breakfast",
      "quantity": 30
    },
    {
      "medicationName": "Atorvastatin",
      "dosage": "20mg",
      "form": "tablet",
      "frequency": "Once daily at bedtime",
      "duration": "30 days",
      "instructions": "Take before sleep",
      "quantity": 30
    }
  ],
  "generalInstructions": "Updated instructions..."
}
```

**Process:**
1. Authenticate doctor
2. Find prescription
3. Verify doctor owns this prescription
4. **Check if editable:**
   - If isLocked = true → Return error "Prescription is locked"
   - If current time > canEditUntil → Auto-lock and return error
   - Otherwise → Allow edit
5. Save snapshot of current data to modificationHistory
6. Update medications and instructions
7. Add to modification history:
   ```javascript
   {
     modifiedAt: new Date(),
     modifiedBy: doctorId,
     changeType: 'updated',
     changes: {medications: true, generalInstructions: true},
     previousData: {medications: [...old], generalInstructions: "..."}
   }
   ```
8. Publish Kafka event: `prescription.updated`
9. Log in audit service
10. Return updated prescription with remaining edit time

**Error Response (if locked):**
```json
{
  "success": false,
  "error": "Prescription is locked and can no longer be edited. The 1-hour editing window has expired.",
  "lockedAt": "2025-11-10T15:30:00Z"
}
```

#### D. Manual Lock Prescription (Doctor can lock early)
**Endpoint:** `POST /api/v1/medical/prescriptions/:prescriptionId/lock`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Process:**
1. Authenticate doctor
2. Find prescription
3. Verify doctor owns it
4. Check if already locked
5. Set isLocked = true
6. Add to modification history: "manual_lock"
7. Publish Kafka event: `prescription.locked`
8. Return success

#### E. Get Prescription Modification History
**Endpoint:** `GET /api/v1/medical/prescriptions/:prescriptionId/history`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Process:**
1. Authenticate doctor
2. Find prescription
3. Verify doctor has access (treated patient)
4. Return complete modification history
5. Log access in audit

**Response:**
```json
{
  "success": true,
  "data": {
    "prescriptionId": "...",
    "history": [
      {
        "modifiedAt": "2025-11-10T14:30:00Z",
        "modifiedBy": {
          "id": "...",
          "name": "Dr. Sarah Smith"
        },
        "changeType": "created",
        "changes": "Initial prescription created"
      },
      {
        "modifiedAt": "2025-11-10T14:45:00Z",
        "modifiedBy": {
          "id": "...",
          "name": "Dr. Sarah Smith"
        },
        "changeType": "updated",
        "changes": {
          "medications[0].dosage": "100mg → 150mg"
        }
      },
      {
        "modifiedAt": "2025-11-10T15:30:00Z",
        "changeType": "auto_locked",
        "changes": "Prescription automatically locked after 1 hour"
      }
    ]
  }
}
```

#### F. Get Patient's Prescriptions
**Endpoint:** `GET /api/v1/medical/patients/:patientId/prescriptions`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?startDate=2024-01-01
&endDate=2025-12-31
&status=active
&page=1
&limit=20
```

**Process:**
1. Authenticate doctor
2. Get prescriptions for patient
3. Filter by date range and status
4. Sort by prescriptionDate (desc)
5. Populate doctor info
6. Return list with medication summaries

**Response:**
```json
{
  "success": true,
  "data": {
    "prescriptions": [
      {
        "id": "...",
        "date": "2025-11-10",
        "doctor": "Dr. Sarah Smith",
        "medicationCount": 3,
        "medicationSummary": "Aspirin, Atorvastatin, Metoprolol",
        "isLocked": true
      }
    ],
    "pagination": {...}
  }
}
```

#### G. Patient: View My Prescriptions
**Endpoint:** `GET /api/v1/medical/patients/my-prescriptions`

**Headers:**
```
Authorization: Bearer {patientToken}
```

**Query Parameters:**
```
?status=active
&page=1
&limit=20
```

**Process:**
1. Authenticate patient
2. Get all prescriptions for this patient
3. Filter by status
4. Sort by date (desc)
5. Return list

#### H. Get Current Active Prescriptions for Patient
**Endpoint:** `GET /api/v1/medical/patients/:patientId/active-prescriptions`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Process:**
1. Authenticate doctor
2. Get prescriptions where:
   - patientId matches
   - status = 'active'
   - prescriptionDate within last 3 months (configurable)
3. Return current medications patient is taking
4. Useful for checking drug interactions

### 3. Background Job: Auto-Lock Prescriptions
**Scheduled Task:** Runs every 5 minutes

**Process:**
```javascript
// Find prescriptions that need locking
const prescriptionsToLock = await Prescription.find({
  isLocked: false,
  canEditUntil: { $lte: new Date() }
});

// Lock each one
for (const prescription of prescriptionsToLock) {
  prescription.isLocked = true;
  prescription.modificationHistory.push({
    modifiedAt: new Date(),
    changeType: 'auto_locked',
    changes: { isLocked: true }
  });
  await prescription.save();
  
  // Publish Kafka event
  publishEvent('prescription.auto_locked', {
    prescriptionId: prescription._id,
    timestamp: Date.now()
  });
}
```

### 4. Medication Database (Optional Feature)
**Endpoint:** `GET /api/v1/medical/medications/search`

**Query Parameters:**
```
?query=aspirin
&category=analgesic
```

**Process:**
- Search medication database for autocomplete
- Return matching medications with dosage suggestions
- Helps doctors prescribe accurately

### 5. Kafka Events Published

```javascript
// prescription.created
{
  eventType: 'prescription.created',
  prescriptionId: '...',
  consultationId: '...',
  patientId: '...',
  doctorId: '...',
  medicationCount: 3,
  canEditUntil: '...',
  timestamp: Date.now()
}

// prescription.updated
{
  eventType: 'prescription.updated',
  prescriptionId: '...',
  updatedBy: '...',
  modificationType: 'medications',
  timestamp: Date.now()
}

// prescription.locked / prescription.auto_locked
{
  eventType: 'prescription.locked',
  prescriptionId: '...',
  lockType: 'auto', // or 'manual'
  timestamp: Date.now()
}

// prescription.accessed
{
  eventType: 'prescription.accessed',
  prescriptionId: '...',
  accessedBy: '...',
  timestamp: Date.now()
}
```

### 6. Validation & Business Rules
- Prescription must have at least 1 medication
- Cannot edit after 1 hour
- Cannot delete prescription (for legal/audit reasons)
- Only creating doctor can edit
- Medication names must not be empty
- Dosage and frequency are required
- Auto-lock system prevents backdating

### 7. Audit & Compliance
- Complete modification history preserved
- All access logged
- Cannot be deleted or fully modified after lock
- Meets medical record retention requirements
- Timestamped with server time (prevent client manipulation)

## API Endpoints Summary
```
POST   /api/v1/medical/prescriptions
GET    /api/v1/medical/prescriptions/:prescriptionId
PUT    /api/v1/medical/prescriptions/:prescriptionId
POST   /api/v1/medical/prescriptions/:prescriptionId/lock
GET    /api/v1/medical/prescriptions/:prescriptionId/history
GET    /api/v1/medical/patients/:patientId/prescriptions
GET    /api/v1/medical/patients/:patientId/active-prescriptions
GET    /api/v1/medical/patients/my-prescriptions
GET    /api/v1/medical/medications/search (optional)
```

## Deliverables
1. ✅ Prescription model with medications array
2. ✅ 1-hour edit window logic
3. ✅ Auto-lock functionality
4. ✅ Manual lock option
5. ✅ Modification history tracking
6. ✅ Create prescription endpoint
7. ✅ Update prescription (with time check)
8. ✅ View prescription details
9. ✅ Patient's prescription history
10. ✅ Active prescriptions query
11. ✅ Background job for auto-locking
12. ✅ Kafka event publishers
13. ✅ Complete audit trail

## Testing Checklist
- [ ] Create prescription successfully
- [ ] Edit prescription within 1 hour works
- [ ] Cannot edit after 1 hour
- [ ] Auto-lock triggers correctly
- [ ] Manual lock works
- [ ] Modification history tracks all changes
- [ ] Patient can view their prescriptions
- [ ] Doctor can view patient prescription history
- [ ] Time calculation is accurate
- [ ] Audit logs all access

---

**Next Step:** After this prompt is complete, proceed to PROMPT 7 (Medical Records Part 3 - Documents)
