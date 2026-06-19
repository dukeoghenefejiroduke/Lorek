const axios = require('axios');

const register = async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/auth/register', {
      username: 'testuser_' + Date.now(),
      email: 'testuser' + Date.now() + '@gmail.com',
      password: 'Password123',
    });
    console.log(response.data);
  } catch (error) {
    if (error.response) {
      console.error(JSON.stringify(error.response.data, null, 2));
    } else {
      console.error(error.message);
    }
  }
};

register();
