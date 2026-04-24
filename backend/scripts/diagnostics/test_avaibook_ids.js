const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

async function testApi() {
    const headers = {
        'X-AUTH-TOKEN': process.env.AVAIBOOK_TOKEN,
        'Accept': 'application/json'
    };

    const ids = ['C655D5566C', '3FD30B6121', '1981AB4ED4'];

    console.log("--- TEST: Fetch by ID ---");
    for (const id of ids) {
        try {
            const res = await axios.get(`https://api.avaibook.com/api/owner/bookings/${id}/`, { headers });
            const b = res.data;
            console.log(`ID: ${id} -> Status: ${b.status}, In: ${b.checkInDate}, Out: ${b.checkOutDate}`);
        } catch (e) {
            console.log(`Error for ${id}: ${e.response?.status} - ${e.response?.data?.message || e.message}`);
        }
    }
}

testApi();
