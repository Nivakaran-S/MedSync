// test-appointment-api.js
// Simple test script to demonstrate appointment API usage
// Run with: node test-appointment-api.js

const axios = require('axios');

const BASE_URL = 'http://localhost:3003/api/appointments';

// Mock JWT token (in real usage, get from auth service)
const mockToken = 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpZCI6IjY0ZjA5YjQ3ODk3ZjY1MjMxMjM0NTY3OCIsInJvbGUiOiJwYXRpZW50In0.mock_signature';

const testAppointmentAPI = async () => {
  try {
    console.log('🧪 Testing Appointment Service API\n');

    // Test 1: Health check
    console.log('1. Health Check:');
    const healthResponse = await axios.get('http://localhost:3003/');
    console.log('✅ Service Status:', healthResponse.data.status);
    console.log('✅ Service Version:', healthResponse.data.version);
    console.log();

    // Test 2: Get appointments (will fail without auth, but shows the endpoint works)
    console.log('2. Get Appointments (without auth - should fail):');
    try {
      await axios.get(BASE_URL);
    } catch (error) {
      console.log('✅ Expected auth error:', error.response?.status, error.response?.statusText);
    }
    console.log();

    // Test 3: Create appointment (will fail without valid auth, but shows validation)
    console.log('3. Create Appointment (without valid auth - should fail):');
    const testAppointment = {
      patientId: '507f1f77bcf86cd799439011',
      doctorId: '507f1f77bcf86cd799439012',
      date: '2024-01-15',
      time: '14:30',
      type: 'consultation',
      notes: 'Test appointment'
    };

    try {
      await axios.post(BASE_URL, testAppointment, {
        headers: { Authorization: mockToken }
      });
    } catch (error) {
      console.log('✅ Expected auth error:', error.response?.status, error.response?.statusText);
    }
    console.log();

    console.log('🎉 API Test Complete!');
    console.log('\n📝 To test with real authentication:');
    console.log('1. Start the auth service');
    console.log('2. Get a valid JWT token');
    console.log('3. Use the token in Authorization header');
    console.log('4. Test CRUD operations with valid data');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
};

// Run the test
testAppointmentAPI();