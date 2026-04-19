# Appointment Service

A comprehensive appointment management microservice for the MedSync healthcare platform.

## Features

- Full CRUD operations for appointments
- Role-based access control (Patient, Doctor, Admin)
- Appointment conflict detection
- Comprehensive appointment schema with medical fields
- JWT authentication
- MongoDB integration
- RESTful API design

## API Endpoints

### Authentication Required
All endpoints require a Bearer token in the Authorization header.

### Appointments

#### GET /api/appointments
Get all appointments (filtered by user role)
- **Patient**: Only their own appointments
- **Doctor**: Only appointments with them as doctor
- **Admin**: All appointments

Query parameters:
- `patientId`: Filter by patient
- `doctorId`: Filter by doctor
- `date`: Filter by date (YYYY-MM-DD)
- `status`: Filter by status
- `type`: Filter by appointment type
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)

#### GET /api/appointments/:id
Get a single appointment by ID

#### POST /api/appointments
Create a new appointment

**Request Body:**
```json
{
  "patientId": "user_id",
  "doctorId": "doctor_id",
  "date": "2024-01-15",
  "time": "14:30",
  "duration": 30,
  "type": "consultation",
  "notes": "Patient complains of headache",
  "symptoms": ["headache", "nausea"]
}
```

#### PUT /api/appointments/:id
Update an appointment

#### DELETE /api/appointments/:id
Delete an appointment (cannot delete past appointments)

#### PATCH /api/appointments/:id/cancel
Cancel an appointment

#### GET /api/appointments/range/date
Get appointments within a date range (Doctor/Admin only)

Query parameters:
- `startDate`: Start date (required)
- `endDate`: End date (required)
- `doctorId`: Filter by doctor (Admin only)

## Appointment Schema

```javascript
{
  patientId: ObjectId (ref: User),
  doctorId: ObjectId (ref: User),
  date: Date,
  time: String (HH:MM format),
  duration: Number (minutes, default: 30),
  status: Enum ['scheduled', 'confirmed', 'in-progress', 'completed', 'cancelled', 'no-show'],
  type: Enum ['consultation', 'follow-up', 'emergency', 'check-up', 'telemedicine'],
  notes: String,
  symptoms: [String],
  diagnosis: String,
  prescription: String,
  followUpRequired: Boolean,
  followUpDate: Date,
  createdBy: ObjectId (ref: User),
  createdAt: Date,
  updatedAt: Date
}
```

## User Roles & Permissions

### Patient
- Create appointments for themselves
- View their own appointments
- Update their own upcoming appointments
- Cancel their own appointments

### Doctor
- Create appointments for patients
- View appointments assigned to them
- Update any appointment assigned to them
- Cancel any appointment assigned to them
- View appointments by date range

### Admin
- All permissions
- View all appointments
- Create appointments for any patient
- Update any appointment
- Delete any appointment
- Cancel any appointment

## Installation & Setup

1. Install dependencies:
```bash
npm install
```

2. Set environment variables in `.env`:
```env
MONGO_URI=mongodb://localhost:27017/medsync-appointments
JWT_SECRET=your-super-secret-jwt-key
PORT=3003
```

3. Start the service:
```bash
npm start
```

For development:
```bash
npm run dev
```

## Error Handling

The service includes comprehensive error handling:
- Validation errors for required fields
- Authentication errors (401)
- Authorization errors (403)
- Not found errors (404)
- Conflict errors (409) for scheduling conflicts
- Internal server errors (500)

## Conflict Detection

The service automatically checks for scheduling conflicts when:
- Creating new appointments
- Updating existing appointment date/time

Conflicts occur when:
- Two appointments overlap for the same doctor
- Appointments are not cancelled or completed

## Development Notes

- Uses Mongoose for MongoDB integration
- JWT tokens are validated but user data is not fetched from database (microservices architecture)
- Indexes are created for efficient queries
- Virtual properties and methods are available on the model
- Comprehensive logging for debugging

## Testing

To test the API, you can use tools like Postman or curl:

```bash
# Health check
curl http://localhost:3003/

# Get appointments (requires auth)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" http://localhost:3003/api/appointments
```