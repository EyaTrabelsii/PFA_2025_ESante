# PROMPT 3: Service Users - User Management Microservice

## Objective
Build the user management microservice to handle Patient and Doctor profiles, including profile management, search functionality, and photo uploads to AWS S3.

## Requirements

### 1. Database Schemas

#### Patient Model
```javascript
{
  userId: ObjectId (reference to User in auth-service, unique, required),
  firstName: String (required),
  lastName: String (required),
  dateOfBirth: Date (required),
  gender: String (enum: ['male', 'female', 'other']),
  phone: String (required),
  address: {
    street: String,
    city: String,
    state: String,
    zipCode: String,
    country: String
  },
  profilePhoto: String (S3 URL),
  bloodType: String (enum: ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']),
  allergies: [String],
  chronicDiseases: [String],
  emergencyContact: {
    name: String,
    relationship: String,
    phone: String
  },
  insuranceInfo: {
    provider: String,
    policyNumber: String,
    expiryDate: Date
  },
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

#### Doctor Model
```javascript
{
  userId: ObjectId (reference to User in auth-service, unique, required),
  firstName: String (required),
  lastName: String (required),
  specialty: String (required), // e.g., Cardiology, Dermatology, Pediatrics
  subSpecialty: String,
  phone: String (required),
  profilePhoto: String (S3 URL),
  licenseNumber: String (required, unique),
  yearsOfExperience: Number,
  education: [{
    degree: String,
    institution: String,
    year: Number
  }],
  languages: [String], // e.g., ['French', 'English', 'Arabic']
  
  // Clinic/Practice Information
  clinicName: String,
  clinicAddress: {
    street: String,
    city: String (required),
    state: String,
    zipCode: String,
    country: String (required),
    coordinates: {
      latitude: Number (required for maps),
      longitude: Number (required for maps)
    }
  },
  
  // Professional Details
  about: String (bio/description),
  consultationFee: Number,
  acceptsInsurance: Boolean (default: false),
  rating: Number (default: 0),
  totalReviews: Number (default: 0),
  
  // Availability
  workingHours: [{
    day: String (enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']),
    isAvailable: Boolean,
    slots: [{
      startTime: String, // "09:00"
      endTime: String    // "17:00"
    }]
  }],
  
  isVerified: Boolean (default: false), // Admin verification
  isActive: Boolean (default: true),
  createdAt: Date,
  updatedAt: Date
}
```

### 2. Core Features

#### A. Get Current User Profile
**Endpoint:** `GET /api/v1/users/me`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Process:**
1. Authenticate user via JWT
2. Get userId and role from token
3. Fetch profile (Patient or Doctor based on role)
4. Populate user data from auth service
5. Return complete profile

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "...",
      "email": "...",
      "role": "patient"
    },
    "profile": {
      "id": "...",
      "firstName": "John",
      "lastName": "Doe",
      // ... other fields
    }
  }
}
```

#### B. Update Patient Profile
**Endpoint:** `PUT /api/v1/users/patient/profile`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "firstName": "John",
  "lastName": "Doe",
  "phone": "+1234567890",
  "address": {
    "street": "123 Main St",
    "city": "Paris",
    "zipCode": "75001",
    "country": "France"
  },
  "bloodType": "O+",
  "allergies": ["Penicillin"],
  "chronicDiseases": ["Diabetes"],
  "emergencyContact": {
    "name": "Jane Doe",
    "relationship": "Sister",
    "phone": "+1234567891"
  }
}
```

**Process:**
1. Authenticate patient
2. Validate input
3. Update patient profile
4. Publish Kafka event: `patient.profile_updated`
5. Return updated profile

#### C. Update Doctor Profile
**Endpoint:** `PUT /api/v1/users/doctor/profile`

**Headers:**
```
Authorization: Bearer {accessToken}
```

**Request Body:**
```json
{
  "firstName": "Dr. Sarah",
  "lastName": "Smith",
  "specialty": "Cardiology",
  "phone": "+1234567890",
  "clinicName": "Heart Care Clinic",
  "clinicAddress": {
    "street": "456 Medical Ave",
    "city": "Paris",
    "zipCode": "75002",
    "country": "France",
    "coordinates": {
      "latitude": 48.8566,
      "longitude": 2.3522
    }
  },
  "about": "Experienced cardiologist with 15 years of practice...",
  "consultationFee": 80,
  "languages": ["French", "English"],
  "workingHours": [
    {
      "day": "Monday",
      "isAvailable": true,
      "slots": [
        {"startTime": "09:00", "endTime": "17:00"}
      ]
    }
  ]
}
```

**Process:**
1. Authenticate doctor
2. Validate input
3. Update doctor profile
4. Publish Kafka event: `doctor.profile_updated`
5. Return updated profile

#### D. Upload Profile Photo
**Endpoint:** `POST /api/v1/users/upload-photo`

**Headers:**
```
Authorization: Bearer {accessToken}
Content-Type: multipart/form-data
```

**Request:**
```
photo: File (jpeg, jpg, png, max 5MB)
```

**Process:**
1. Authenticate user
2. Validate file (type, size)
3. Generate unique filename: `profile_${userId}_${timestamp}.${ext}`
4. Upload to S3 bucket: `esante-medical-documents/profiles/`
5. Get S3 URL
6. Update profile with photo URL
7. Delete old photo from S3 (if exists)
8. Publish Kafka event: `user.photo_updated`
9. Return photo URL

**S3 Configuration:**
- Bucket: esante-medical-documents
- Folder: profiles/
- ACL: private (use signed URLs for access)
- Max size: 5MB
- Allowed formats: jpg, jpeg, png

#### E. Search Doctors
**Endpoint:** `GET /api/v1/users/doctors/search`

**Query Parameters:**
```
?name=smith
&specialty=cardiology
&city=paris
&latitude=48.8566
&longitude=2.3522
&radius=10 (km)
&page=1
&limit=20
```

**Process:**
1. Build search query:
   - Text search on firstName, lastName, clinicName
   - Filter by specialty
   - Filter by city
   - Geospatial search (if lat/lng provided)
2. Filter: isActive=true, isVerified=true
3. Paginate results
4. Sort by distance (if location search) or rating
5. Return doctors list

**Response:**
```json
{
  "success": true,
  "data": {
    "doctors": [
      {
        "id": "...",
        "firstName": "Dr. Sarah",
        "lastName": "Smith",
        "specialty": "Cardiology",
        "profilePhoto": "...",
        "clinicName": "Heart Care Clinic",
        "clinicAddress": {...},
        "rating": 4.5,
        "consultationFee": 80,
        "distance": 2.5 // km (if location search)
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 5,
      "totalDoctors": 100
    }
  }
}
```

#### F. Get Doctor by ID (Public Profile)
**Endpoint:** `GET /api/v1/users/doctors/:doctorId`

**Process:**
1. Find doctor by ID
2. Check if verified and active
3. Return public doctor info (hide sensitive data)
4. Include rating and reviews count

#### G. Get Doctors Near Location (Map View)
**Endpoint:** `GET /api/v1/users/doctors/nearby`

**Query Parameters:**
```
?latitude=48.8566
&longitude=2.3522
&radius=5 (km)
&specialty=cardiology (optional)
```

**Process:**
1. Geospatial query using MongoDB $near or $geoWithin
2. Filter by specialty (if provided)
3. Return doctors with coordinates for map markers
4. Include basic info for map pins

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "...",
      "name": "Dr. Sarah Smith",
      "specialty": "Cardiology",
      "coordinates": {
        "latitude": 48.8566,
        "longitude": 2.3522
      },
      "rating": 4.5,
      "distance": 1.2
    }
  ]
}
```

### 3. AWS S3 Integration

#### S3 Helper Functions:
```javascript
// Upload file
uploadToS3(file, folder)

// Get signed URL (private access)
getSignedUrl(fileKey, expiresIn)

// Delete file
deleteFromS3(fileKey)
```

#### S3 Bucket Structure:
```
esante-medical-documents/
├── profiles/
│   ├── profile_userId1_timestamp.jpg
│   └── profile_userId2_timestamp.png
└── documents/ (for medical records - used in later services)
```

### 4. Geospatial Indexing
```javascript
// MongoDB 2dsphere index on doctor coordinates
doctorSchema.index({ 'clinicAddress.coordinates': '2dsphere' });
```

### 5. Kafka Events Published

```javascript
// patient.profile_updated
{
  eventType: 'patient.profile_updated',
  userId: '...',
  patientId: '...',
  timestamp: Date.now()
}

// doctor.profile_updated
{
  eventType: 'doctor.profile_updated',
  userId: '...',
  doctorId: '...',
  changes: ['clinicAddress', 'workingHours'],
  timestamp: Date.now()
}

// user.photo_updated
{
  eventType: 'user.photo_updated',
  userId: '...',
  photoUrl: '...',
  timestamp: Date.now()
}
```

### 6. Validation Rules
- Phone: Valid format
- Email: Valid format (handled in auth service)
- License number: Unique for doctors
- Coordinates: Valid latitude/longitude
- Photo: Max 5MB, jpeg/jpg/png only
- Working hours: Valid time format

### 7. Admin Features (Optional)
**Endpoint:** `PUT /api/v1/users/admin/verify-doctor/:doctorId`
- Verify doctor (isVerified = true)
- Requires admin role

## API Endpoints Summary
```
GET    /api/v1/users/me
PUT    /api/v1/users/patient/profile
PUT    /api/v1/users/doctor/profile
POST   /api/v1/users/upload-photo
GET    /api/v1/users/doctors/search
GET    /api/v1/users/doctors/nearby
GET    /api/v1/users/doctors/:doctorId
PUT    /api/v1/users/admin/verify-doctor/:doctorId
```

## Deliverables
1. ✅ Patient and Doctor models
2. ✅ Profile CRUD operations
3. ✅ AWS S3 photo upload
4. ✅ Doctor search with filters
5. ✅ Geospatial search (nearby doctors)
6. ✅ Map view endpoint
7. ✅ Kafka event publishers
8. ✅ Input validation
9. ✅ Error handling

## Testing Checklist
- [ ] Patient can view/update profile
- [ ] Doctor can view/update profile
- [ ] Photo upload to S3 works
- [ ] Search doctors by name/specialty
- [ ] Search doctors by location
- [ ] Nearby doctors with coordinates
- [ ] Geospatial search accuracy
- [ ] Public doctor profile accessible

---

**Next Step:** After this prompt is complete, proceed to PROMPT 4 (Service RDV)
