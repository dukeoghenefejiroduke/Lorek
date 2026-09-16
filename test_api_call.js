const axios = require('axios');
async function test() {
  try {
    // Note: I cannot easily mock the 'auth' middleware here without a valid token.
    // I will try to hit the endpoint directly. If it requires auth, it might fail.
    // For now, checking if the server responds at all.
    const response = await axios.get('http://127.0.0.1:5000/api/lessons', { params: { lang: 'IZON' }});
    console.log(JSON.stringify(response.data, null, 2));
  } catch (err) {
    console.log('Error:', err.response ? err.response.status : err.message);
  }
}
test();
