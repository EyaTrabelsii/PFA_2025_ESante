# PROMPT 4: Service RDV - Appointments Microservice

## Objective
Build the appointment management microservice handling doctor availability, patient appointment requests, doctor validation/rejection, appointment history, and referral-based appointments.

## Requirements

### 1. Database Schemas

#### Appointment Model
```javascript
{
  patientId: ObjectId (reference to Patient, required),
  doctorId: ObjectId (reference to Doctor, required),
  
  appointmentDate: Date (required),
  appointmentTime: String (required), // "14:30"
  duration: Number (default: 30), // minutes
  
  status: String (enum: ['pending', 'confirmed', 'rejected', 'cancelled', 'completed', 'no-show'], default: 'pending'),
  
  reason: String (patient's reason for visit),
  notes: String (doctor's notes - optional),
  
  // Referral Information (if booked by another doctor)
  isReferral: Boolean (default: false),
  referredBy: ObjectId (reference to Doctor - if referral),
  referralId: ObjectId (reference to Referral),
  
  // Cancellation/Rejection
  cancellationReason: String,
  cancelledBy: String (enum: ['patient', 'doctor']),
  cancelledAt: Date,
  
  rejectionReason: String,
  rejectedAt: Date,
  
  // Confirmation
  confirmedAt: Date,
  completedAt: Date,
  
  // Reminders
  reminderSent: Boolean (default: false),
  reminderSentAt: Date,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### TimeSlot Model (Doctor Availability)
```javascript
{
  doctorId: ObjectId (reference to Doctor, required),
  date: Date (required),
  
  slots: [{
    time: String (required), // "09:00", "09:30", "10:00"
    isBooked: Boolean (default: false),
    appointmentId: ObjectId (reference to Appointment if booked)
  }],
  
  isAvailable: Boolean (default: true), // Doctor can mark entire day unavailable
  specialNotes: String, // e.g., "Emergency cases only"
  
  createdAt: Date,
  updatedAt: Date
}

// Compound index on doctorId + date for fast queries
timeSlotSchema.index({ doctorId: 1, date: 1 }, { unique: true });
```

### 2. Core Features

#### A. Doctor: Set Availability
**Endpoint:** `POST /api/v1/appointments/doctor/availability`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "date": "2025-11-15",
  "slots": [
    {"time": "09:00"},
    {"time": "09:30"},
    {"time": "10:00"},
    {"time": "10:30"},
    {"time": "14:00"},
    {"time": "14:30"},
    {"time": "15:00"}
  ],
  "isAvailable": true
}
```

**Process:**
1. Authenticate doctor
2. Validate date (must be today or future)
3. Validate time slots format
4. Check if availability already exists for this date
5. Create or update TimeSlot document
6. Set all slots as isBooked: false
7. Publish Kafka event: `doctor.availability_set`
8. Return success

#### B. Doctor: Get My Availability
**Endpoint:** `GET /api/v1/appointments/doctor/availability`

**Query Parameters:**
```
?startDate=2025-11-01
&endDate=2025-11-30
```

**Process:**
1. Authenticate doctor
2. Get doctor's availability for date range
3. Return time slots with booking status

#### C. Patient: View Doctor Availability
**Endpoint:** `GET /api/v1/appointments/doctors/:doctorId/availability`

**Query Parameters:**
```
?date=2025-11-15
or
?startDate=2025-11-01&endDate=2025-11-30
```

**Process:**
1. Get doctor's time slots for specified date(s)
2. Filter out booked slots
3. Return only available slots
4. Group by date

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "date": "2025-11-15",
      "availableSlots": [
        {"time": "09:00"},
        {"time": "09:30"},
        {"time": "14:00"}
      ]
    }
  ]
}
```

#### D. Patient: Request Appointment
**Endpoint:** `POST /api/v1/appointments/request`

**Headers:**
```
Authorization: Bearer {patientToken}
```

**Request Body:**
```json
{
  "doctorId": "doctorId123",
  "appointmentDate": "2025-11-15",
  "appointmentTime": "14:30",
  "reason": "Regular checkup and chest pain consultation"
}
```

**Process:**
1. Authenticate patient
2. Validate doctor exists and is active
3. Check if slot is available (not booked)
4. Create appointment with status: 'pending'
5. Mark slot as booked temporarily (lock it)
6. Publish Kafka event: `appointment.requested`
7. Send notification to doctor
8. Return appointment details

**Response:**
```json
{
  "success": true,
  "message": "Appointment request sent. Waiting for doctor confirmation.",
  "data": {
    "appointmentId": "...",
    "status": "pending",
    "doctorName": "Dr. Sarah Smith",
    "appointmentDate": "2025-11-15",
    "appointmentTime": "14:30"
  }
}
```

#### E. Doctor: View Appointment Requests
**Endpoint:** `GET /api/v1/appointments/doctor/requests`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?status=pending
&page=1
&limit=20
```

**Process:**
1. Authenticate doctor
2. Get appointments where doctorId = current doctor
3. Filter by status (default: pending)
4. Populate patient info
5. Sort by appointmentDate, appointmentTime
6. Paginate results
7. Return list

#### F. Doctor: Confirm Appointment
**Endpoint:** `PUT /api/v1/appointments/:appointmentId/confirm`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body (optional):**
```json
{
  "notes": "Please bring previous medical records"
}
```

**Process:**
1. Authenticate doctor
2. Find appointment and verify doctor owns it
3. Check status is 'pending'
4. Update status to 'confirmed'
5. Set confirmedAt timestamp
6. Keep slot as booked
7. Publish Kafka event: `appointment.confirmed`
8. Send notification to patient
9. Return updated appointment

#### G. Doctor: Reject Appointment
**Endpoint:** `PUT /api/v1/appointments/:appointmentId/reject`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "rejectionReason": "Not available at this time, please choose another slot"
}
```

**Process:**
1. Authenticate doctor
2. Find appointment and verify doctor owns it
3. Check status is 'pending'
4. Update status to 'rejected'
5. Set rejectionReason and rejectedAt
6. Free up the time slot (isBooked: false)
7. Publish Kafka event: `appointment.rejected`
8. Send notification to patient
9. Return updated appointment

#### H. Patient: Cancel Appointment
**Endpoint:** `PUT /api/v1/appointments/:appointmentId/cancel`

**Headers:**
```
Authorization: Bearer {patientToken}
```

**Request Body:**
```json
{
  "cancellationReason": "Personal emergency"
}
```

**Process:**
1. Authenticate patient
2. Find appointment and verify patient owns it
3. Check status is 'pending' or 'confirmed'
4. Update status to 'cancelled'
5. Set cancellationReason, cancelledBy: 'patient', cancelledAt
6. Free up the time slot
7. Publish Kafka event: `appointment.cancelled`
8. Send notification to doctor
9. Return success

#### I. Get Appointment Details
**Endpoint:** `GET /api/v1/appointments/:appointmentId`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user
2. Find appointment
3. Verify user is patient or doctor of this appointment
4. Populate patient and doctor info
5. Return appointment details

#### J. Patient: Get My Appointments
**Endpoint:** `GET /api/v1/appointments/patient/my-appointments`

**Headers:**
```
Authorization: Bearer {patientToken}
```

**Query Parameters:**
```
?status=confirmed (or 'pending', 'completed', 'all')
&timeFilter=upcoming (or 'past', 'all')
&page=1
&limit=20
```

**Process:**
1. Authenticate patient
2. Get appointments for this patient
3. Filter by status and timeFilter
   - upcoming: appointmentDate >= today
   - past: appointmentDate < today
4. Sort: upcoming (asc), past (desc)
5. Populate doctor info
6. Paginate
7. Return list

**Response:**
```json
{
  "success": true,
  "data": {
    "appointments": [
      {
        "id": "...",
        "doctor": {
          "id": "...",
          "name": "Dr. Sarah Smith",
          "specialty": "Cardiology",
          "photo": "..."
        },
        "appointmentDate": "2025-11-15",
        "appointmentTime": "14:30",
        "status": "confirmed",
        "reason": "Regular checkup"
      }
    ],
    "pagination": {...}
  }
}
```

#### K. Doctor: Get My Appointments
**Endpoint:** `GET /api/v1/appointments/doctor/my-appointments`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?date=2025-11-15 (optional - for daily view)
&status=confirmed
&page=1
&limit=20
```

**Process:**
1. Authenticate doctor
2. Get appointments for this doctor
3. Filter by date and status
4. Sort by appointmentDate, appointmentTime
5. Populate patient info
6. Return list

#### L. Doctor: Mark Appointment as Completed
**Endpoint:** `PUT /api/v1/appointments/:appointmentId/complete`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Process:**
1. Authenticate doctor
2. Verify appointment belongs to doctor
3. Check status is 'confirmed'
4. Update status to 'completed'
5. Set completedAt timestamp
6. Publish Kafka event: `appointment.completed`
7. Trigger consultation creation (for medical records service)
8. Return success

#### M. Referral Appointment Booking (Doctor books for Patient)
**Endpoint:** `POST /api/v1/appointments/referral-booking`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Request Body:**
```json
{
  "patientId": "patientId123",
  "targetDoctorId": "specialistId456",
  "appointmentDate": "2025-11-20",
  "appointmentTime": "10:00",
  "referralId": "referralId789",
  "notes": "Patient needs specialist consultation for cardiac condition"
}
```

**Process:**
1. Authenticate referring doctor
2. Verify referral exists and belongs to this doctor
3. Check target doctor's availability
4. Create appointment with:
   - status: 'confirmed' (auto-confirmed for referrals)
   - isReferral: true
   - referredBy: current doctor
5. Mark slot as booked
6. Publish Kafka event: `appointment.referral_booked`
7. Send notifications to patient and target doctor
8. Return appointment details

### 3. Appointment Statistics (for Doctor Dashboard)
**Endpoint:** `GET /api/v1/appointments/doctor/statistics`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "totalAppointments": 150,
    "pending": 5,
    "confirmed": 20,
    "completed": 120,
    "cancelled": 3,
    "noShow": 2,
    "todayAppointments": 8
  }
}
```

### 4. Kafka Events Published

```javascript
// appointment.requested
{
  eventType: 'appointment.requested',
  appointmentId: '...',
  patientId: '...',
  doctorId: '...',
  appointmentDate: '...',
  appointmentTime: '...',
  timestamp: Date.now()
}

// appointment.confirmed
{
  eventType: 'appointment.confirmed',
  appointmentId: '...',
  patientId: '...',
  doctorId: '...',
  timestamp: Date.now()
}

// appointment.rejected
{
  eventType: 'appointment.rejected',
  appointmentId: '...',
  reason: '...',
  timestamp: Date.now()
}

// appointment.cancelled
{
  eventType: 'appointment.cancelled',
  appointmentId: '...',
  cancelledBy: 'patient',
  timestamp: Date.now()
}

// appointment.completed
{
  eventType: 'appointment.completed',
  appointmentId: '...',
  patientId: '...',
  doctorId: '...',
  timestamp: Date.now()
}

// appointment.referral_booked
{
  eventType: 'appointment.referral_booked',
  appointmentId: '...',
  referredBy: '...',
  targetDoctorId: '...',
  timestamp: Date.now()
}
```

### 5. Validation & Business Rules
- Cannot book appointment in the past
- Cannot book if slot is already taken
- Patient can't book with same doctor on same day/time twice
- Appointment can only be cancelled at least 2 hours before (optional rule)
- Doctor can only confirm/reject pending appointments
- Completed appointments cannot be modified

### 6. Reminders (handled by Notification Service)
- Send reminder 24 hours before appointment
- Send reminder 1 hour before appointment

## API Endpoints Summary
```
# Doctor Availability
POST   /api/v1/appointments/doctor/availability
GET    /api/v1/appointments/doctor/availability
GET    /api/v1/appointments/doctors/:doctorId/availability

# Appointment Requests
POST   /api/v1/appointments/request
GET    /api/v1/appointments/doctor/requests
PUT    /api/v1/appointments/:appointmentId/confirm
PUT    /api/v1/appointments/:appointmentId/reject
PUT    /api/v1/appointments/:appointmentId/cancel
PUT    /api/v1/appointments/:appointmentId/complete

# View Appointments
GET    /api/v1/appointments/:appointmentId
GET    /api/v1/appointments/patient/my-appointments
GET    /api/v1/appointments/doctor/my-appointments
GET    /api/v1/appointments/doctor/statistics

# Referral Booking
POST   /api/v1/appointments/referral-booking
```

## Deliverables
1. ✅ Appointment and TimeSlot models
2. ✅ Doctor availability management
3. ✅ Patient appointment request
4. ✅ Doctor confirm/reject workflow
5. ✅ Appointment cancellation
6. ✅ Appointment history
7. ✅ Referral-based booking
8. ✅ Appointment statistics
9. ✅ Kafka event publishers
10. ✅ Validation and error handling

## Testing Checklist
- [ ] Doctor sets availability
- [ ] Patient views available slots
- [ ] Patient requests appointment
- [ ] Doctor receives request
- [ ] Doctor confirms appointment
- [ ] Doctor rejects appointment (slot freed)
- [ ] Patient cancels appointment
- [ ] Cannot book same slot twice
- [ ] Referral booking works
- [ ] Appointment history displays correctly

---

**Next Step:** After this prompt is complete, proceed to PROMPT 5 (Medical Records Part 1)
