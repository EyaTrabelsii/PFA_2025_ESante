# PROMPT 7: Service Medical Records - Part 3: Medical Documents

## Objective
Build the medical document management system with AWS S3 storage, supporting multiple document types (lab results, imaging, prescriptions, insurance docs) in PDF or image formats, linked to consultations.

## Requirements

### 1. Database Schema

#### MedicalDocument Model
```javascript
{
  patientId: ObjectId (reference to Patient, required, indexed),
  uploadedBy: ObjectId (required), // Can be patient or doctor
  uploaderType: String (enum: ['patient', 'doctor'], required),
  uploaderDoctorId: ObjectId (if uploaded by doctor),
  
  consultationId: ObjectId (reference to Consultation, optional), // Link to specific visit
  
  // Document Information
  documentType: String (enum: ['lab_result', 'imaging', 'prescription', 'insurance', 'medical_report', 'other'], required),
  title: String (required), // "Cardiac Enzyme Test Results"
  description: String,
  
  // File Information
  fileName: String (required), // Original filename
  fileSize: Number (required), // in bytes
  mimeType: String (required), // "application/pdf", "image/jpeg", "image/png"
  fileExtension: String (required), // "pdf", "jpg", "png"
  
  // S3 Storage
  s3Key: String (required, unique), // Unique file path in S3
  s3Bucket: String (required),
  s3Url: String, // Public URL (if applicable)
  
  // Document Date
  documentDate: Date, // When the document was created (e.g., test date)
  uploadDate: Date (required, default: now),
  
  // Access Control
  isSharedWithAllDoctors: Boolean (default: true), // Patient can control sharing
  sharedWithDoctors: [ObjectId], // Specific doctors (if not all)
  
  // Metadata
  tags: [String], // ["blood_test", "cardiology"]
  
  // Status
  status: String (enum: ['active', 'archived', 'deleted'], default: 'active'),
  
  createdAt: Date,
  updatedAt: Date
}

// Indexes
medicalDocumentSchema.index({ patientId: 1, uploadDate: -1 });
medicalDocumentSchema.index({ consultationId: 1 });
medicalDocumentSchema.index({ uploadedBy: 1, uploadDate: -1 });
medicalDocumentSchema.index({ s3Key: 1 }, { unique: true });
```

### 2. AWS S3 Configuration

#### S3 Bucket Structure:
```
esante-medical-documents/
├── profiles/
│   └── [user profile photos]
├── medical-documents/
│   ├── lab-results/
│   │   ├── patient_123_20251110_abc123.pdf
│   │   └── patient_123_20251115_def456.jpg
│   ├── imaging/
│   │   └── patient_123_20251110_xray_xyz789.pdf
│   ├── prescriptions/
│   ├── insurance/
│   └── other/
```

#### File Naming Convention:
```
{documentType}_patient_{patientId}_{timestamp}_{uniqueId}.{extension}
Example: lab-results_patient_507f1f77_1699632000000_abc123.pdf
```

#### S3 Helper Functions:
```javascript
// Upload document
async uploadDocument(file, patientId, documentType)

// Generate signed URL (secure access, expires in 1 hour)
async getSignedUrl(s3Key, expiresIn = 3600)

// Delete document
async deleteDocument(s3Key)

// Check file exists
async fileExists(s3Key)
```

### 3. Core Features

#### A. Upload Medical Document
**Endpoint:** `POST /api/v1/medical/documents/upload`

**Headers:**
```
Authorization: Bearer {token}
Content-Type: multipart/form-data
```

**Request:**
```
file: File (required - PDF or image)
patientId: String (required if doctor uploads, auto-filled if patient)
consultationId: String (optional - link to specific consultation)
documentType: String (required - lab_result, imaging, prescription, insurance, medical_report, other)
title: String (required)
description: String (optional)
documentDate: Date (optional - when document was created)
tags: String[] (optional)
```

**Process:**
1. Authenticate user (patient or doctor)
2. Validate file:
   - Type: PDF, JPEG, JPG, PNG only
   - Size: Max 10MB
3. Determine patientId:
   - If patient uploads: use their own patientId
   - If doctor uploads: use provided patientId
4. Generate unique S3 key:
   ```
   documentType/patient_${patientId}_${timestamp}_${uuid}.${ext}
   ```
5. Upload file to S3
6. Create document metadata in MongoDB
7. Link to consultation (if provided)
8. Publish Kafka event: `document.uploaded`
9. Log in audit service
10. Return document details with temporary signed URL

**Response:**
```json
{
  "success": true,
  "message": "Document uploaded successfully",
  "data": {
    "documentId": "...",
    "title": "Cardiac Enzyme Test Results",
    "documentType": "lab_result",
    "fileName": "test_results.pdf",
    "fileSize": 245678,
    "uploadDate": "2025-11-10T14:30:00Z",
    "signedUrl": "https://s3.amazonaws.com/...",
    "urlExpiresIn": "1 hour"
  }
}
```

**Error Handling:**
- File too large
- Invalid file type
- S3 upload failure
- Insufficient storage quota

#### B. Get Document Details
**Endpoint:** `GET /api/v1/medical/documents/:documentId`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user
2. Find document
3. Verify access:
   - Patient: Must be their document
   - Doctor: Must have treated this patient OR be shared with
4. Generate signed URL for file access
5. Log access in audit
6. Return document metadata with signed URL

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "...",
    "title": "Cardiac Enzyme Test Results",
    "description": "Blood test results from November 10, 2025",
    "documentType": "lab_result",
    "documentDate": "2025-11-10",
    "uploadDate": "2025-11-10T14:30:00Z",
    "uploadedBy": {
      "type": "doctor",
      "name": "Dr. Sarah Smith"
    },
    "fileInfo": {
      "fileName": "cardiac_test.pdf",
      "fileSize": 245678,
      "mimeType": "application/pdf"
    },
    "signedUrl": "https://s3.amazonaws.com/...",
    "urlExpiresIn": "1 hour",
    "tags": ["blood_test", "cardiology"],
    "linkedConsultation": {
      "id": "...",
      "date": "2025-11-10",
      "doctor": "Dr. Sarah Smith"
    }
  }
}
```

#### C. Get Patient's Documents
**Endpoint:** `GET /api/v1/medical/documents/patient/:patientId`

**Headers:**
```
Authorization: Bearer {doctorToken}
```

**Query Parameters:**
```
?documentType=lab_result
&startDate=2024-01-01
&endDate=2025-12-31
&consultationId=specificConsultationId
&tags=cardiology,blood_test
&page=1
&limit=20
```

**Process:**
1. Authenticate doctor
2. Verify doctor has treated this patient
3. Get documents for patient
4. Filter by documentType, date range, consultation, tags
5. Sort by uploadDate (desc)
6. Paginate results
7. Generate signed URLs for each document
8. Log bulk access in audit
9. Return list

**Response:**
```json
{
  "success": true,
  "data": {
    "documents": [
      {
        "id": "...",
        "title": "Cardiac Enzyme Test",
        "documentType": "lab_result",
        "documentDate": "2025-11-10",
        "uploadDate": "2025-11-10T14:30:00Z",
        "uploadedBy": "Dr. Sarah Smith",
        "fileSize": 245678,
        "mimeType": "application/pdf",
        "signedUrl": "...",
        "thumbnail": "..." // (optional for images)
      }
    ],
    "pagination": {
      "currentPage": 1,
      "totalPages": 3,
      "totalDocuments": 45
    }
  }
}
```

#### D. Get Documents for Consultation
**Endpoint:** `GET /api/v1/medical/consultations/:consultationId/documents`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user (doctor or patient)
2. Verify access to consultation
3. Get all documents linked to this consultation
4. Generate signed URLs
5. Return list

**Use Case:**
- Doctor reviewing all documents related to specific visit
- Patient viewing what was uploaded during their appointment

#### E. Patient: Get My Documents
**Endpoint:** `GET /api/v1/medical/documents/my-documents`

**Headers:**
```
Authorization: Bearer {patientToken}
```

**Query Parameters:**
```
?documentType=lab_result
&startDate=2025-01-01
&endDate=2025-12-31
&page=1
&limit=20
```

**Process:**
1. Authenticate patient
2. Get all documents for this patient
3. Filter by type and date
4. Sort by uploadDate (desc)
5. Generate signed URLs
6. Return list

#### F. Update Document Metadata
**Endpoint:** `PUT /api/v1/medical/documents/:documentId`

**Headers:**
```
Authorization: Bearer {token}
```

**Request Body:**
```json
{
  "title": "Updated Title",
  "description": "Updated description",
  "documentDate": "2025-11-10",
  "tags": ["updated_tag"],
  "isSharedWithAllDoctors": false,
  "sharedWithDoctors": ["doctorId1", "doctorId2"]
}
```

**Process:**
1. Authenticate user
2. Find document
3. Verify ownership (uploader can edit)
4. Update metadata (cannot change file itself)
5. Publish Kafka event: `document.updated`
6. Return updated document

**Note:** Cannot change the actual file, only metadata

#### G. Delete Document (Soft Delete)
**Endpoint:** `DELETE /api/v1/medical/documents/:documentId`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user
2. Find document
3. Verify ownership or admin role
4. Soft delete: Set status = 'deleted'
5. Optionally delete from S3 (or keep for audit)
6. Publish Kafka event: `document.deleted`
7. Log in audit
8. Return success

**Business Rule:**
- Soft delete (keep record for audit)
- Only uploader or admin can delete
- S3 file may be retained for compliance

#### H. Download Document
**Endpoint:** `GET /api/v1/medical/documents/:documentId/download`

**Headers:**
```
Authorization: Bearer {token}
```

**Process:**
1. Authenticate user
2. Verify access to document
3. Generate signed S3 download URL
4. Log download in audit
5. Redirect to signed URL or return URL

**Response:**
```json
{
  "success": true,
  "data": {
    "downloadUrl": "https://s3.amazonaws.com/...",
    "fileName": "cardiac_test.pdf",
    "expiresIn": "5 minutes"
  }
}
```

#### I. Get Document Statistics
**Endpoint:** `GET /api/v1/medical/documents/statistics`

**Headers:**
```
Authorization: Bearer {token}
```

**For Patient:**
```json
{
  "success": true,
  "data": {
    "totalDocuments": 45,
    "byType": {
      "lab_result": 15,
      "imaging": 10,
      "prescription": 12,
      "insurance": 5,
      "other": 3
    },
    "totalStorageUsed": "45.2 MB"
  }
}
```

**For Doctor:**
```json
{
  "success": true,
  "data": {
    "documentsUploaded": 250,
    "patientsWithDocuments": 120,
    "thisMonth": 35
  }
}
```

### 4. Document Sharing Controls

#### Patient: Manage Document Sharing
**Endpoint:** `PUT /api/v1/medical/documents/:documentId/sharing`

**Headers:**
```
Authorization: Bearer {patientToken}
```

**Request Body:**
```json
{
  "isSharedWithAllDoctors": false,
  "sharedWithDoctors": ["doctorId1", "doctorId2"]
}
```

**Process:**
- Patient controls who can see specific documents
- Default: Shared with all doctors who treated them
- Can restrict to specific doctors

### 5. File Validation

```javascript
const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'image/jpeg',
  'image/jpg',
  'image/png'
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function validateFile(file) {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    throw new Error('Invalid file type. Only PDF and images allowed.');
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new Error('File too large. Maximum size is 10MB.');
  }
  return true;
}
```

### 6. S3 Security

#### Bucket Policy:
- Private bucket (no public access)
- All access via signed URLs
- URLs expire in 1 hour
- Server-side encryption enabled
- Versioning enabled (optional)

#### IAM Permissions:
```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject"
      ],
      "Resource": "arn:aws:s3:::esante-medical-documents/medical-documents/*"
    }
  ]
}
```

### 7. Kafka Events Published

```javascript
// document.uploaded
{
  eventType: 'document.uploaded',
  documentId: '...',
  patientId: '...',
  uploadedBy: '...',
  uploaderType: 'doctor',
  documentType: 'lab_result',
  consultationId: '...',
  fileSize: 245678,
  timestamp: Date.now()
}

// document.accessed
{
  eventType: 'document.accessed',
  documentId: '...',
  accessedBy: '...',
  accessType: 'view', // or 'download'
  timestamp: Date.now()
}

// document.updated
{
  eventType: 'document.updated',
  documentId: '...',
  updatedBy: '...',
  changes: ['title', 'tags'],
  timestamp: Date.now()
}

// document.deleted
{
  eventType: 'document.deleted',
  documentId: '...',
  deletedBy: '...',
  timestamp: Date.now()
}
```

### 8. Audit Logging
Every document operation must be logged:
```javascript
{
  action: 'document.uploaded',
  performedBy: 'doctorId',
  resourceType: 'medical_document',
  resourceId: 'documentId',
  patientId: 'patientId',
  metadata: {
    documentType: 'lab_result',
    fileName: 'test.pdf',
    fileSize: 245678
  },
  ipAddress: '...',
  timestamp: Date.now()
}
```

### 9. Thumbnail Generation (Optional Enhancement)
For image documents, generate thumbnails:
```javascript
// Use Sharp or AWS Lambda
async function generateThumbnail(imageBuffer) {
  const thumbnail = await sharp(imageBuffer)
    .resize(200, 200, { fit: 'inside' })
    .toBuffer();
  
  // Upload thumbnail to S3
  const thumbnailKey = s3Key.replace('.jpg', '_thumb.jpg');
  await uploadToS3(thumbnail, thumbnailKey);
  
  return thumbnailKey;
}
```

## API Endpoints Summary
```
POST   /api/v1/medical/documents/upload
GET    /api/v1/medical/documents/:documentId
GET    /api/v1/medical/documents/:documentId/download
PUT    /api/v1/medical/documents/:documentId
DELETE /api/v1/medical/documents/:documentId
GET    /api/v1/medical/documents/patient/:patientId
GET    /api/v1/medical/documents/my-documents
GET    /api/v1/medical/consultations/:consultationId/documents
GET    /api/v1/medical/documents/statistics
PUT    /api/v1/medical/documents/:documentId/sharing
```

## Deliverables
1. ✅ MedicalDocument model
2. ✅ AWS S3 integration
3. ✅ File upload with validation
4. ✅ Signed URL generation
5. ✅ Document metadata management
6. ✅ Access control (patient/doctor)
7. ✅ Document listing with filters
8. ✅ Consultation-linked documents
9. ✅ Download functionality
10. ✅ Soft delete
11. ✅ Document sharing controls
12. ✅ Statistics
13. ✅ Kafka event publishers
14. ✅ Complete audit logging
15. ✅ Thumbnail generation (optional)

## Testing Checklist
- [ ] Upload PDF successfully
- [ ] Upload image successfully
- [ ] File validation works (type, size)
- [ ] Signed URLs work and expire
- [ ] Doctor can view patient documents
- [ ] Patient can view their documents
- [ ] Access control prevents unauthorized access
- [ ] Documents linked to consultation
- [ ] Update metadata works
- [ ] Soft delete works
- [ ] Download functionality works
- [ ] Audit logs all access
- [ ] S3 storage is secure

---

**Next Step:** After this prompt is complete, proceed to PROMPT 8 (Service Referrals)
