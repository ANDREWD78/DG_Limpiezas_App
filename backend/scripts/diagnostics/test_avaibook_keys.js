const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

async function checkKeys() {
    const url = 'https://api.avaibook.com/api/owner/bookings/';
    try {
        const res = await axios.get(url, { headers: { 'X-AUTH-TOKEN': process.env.AVAIBOOK_TOKEN, 'Accept': 'application/json' }});
        console.log("Keys in response data:", Object.keys(res.data));
    } catch(e) {}
}
checkKeys();
