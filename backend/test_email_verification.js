
const axios = require('axios');

const BASE_URL = 'http://localhost:5000/api'; // Assuming backend runs on 5000

async function testRegistrationAndVerification() {
  try {
    console.log('--- Starting Test: Registration & Email Verification ---');

    // 1. Register
    const userData = {
      username: 'testuser_' + Date.now(),
      email: 'testuser_' + Date.now() + '@example.com',
      password: 'Password123'
    };

    console.log('Registering user:', userData.username);
    const registerResponse = await axios.post(`${BASE_URL}/auth/register`, userData);
    console.log('Registration Response:', registerResponse.data.message);

    // Note: We need a way to get the verification token.
    // In a real test, we would mock the email service or check a database.
    // Since we cannot easily check the email, we might need to inspect the User model in DB.
    
    console.log('--- Manual Step Required ---');
    console.log('Please find the verification token in the database for user:', userData.username);
    console.log('Then update this test script with the token to test /verify-email');
    
  } catch (error) {
    console.error('Test failed:', error.response ? error.response.data : error.message);
  }
}

testRegistrationAndVerification();
