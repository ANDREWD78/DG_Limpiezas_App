const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

async function testApi() {
    const headers = {
        'X-AUTH-TOKEN': process.env.AVAIBOOK_TOKEN,
        'Accept': 'application/json'
    };

    console.log("--- TEST 1: No params ---");
    try {
        const res = await axios.get('https://api.avaibook.com/api/owner/bookings/', { headers });
        console.log(`Length: ${res.data.length}`);
        console.log(JSON.stringify(res.data, null, 2));
    } catch (e) { console.log("Error:", e.message); }
    
    console.log("--- TEST 2: ?dateFilter=checkIn&startDate=2020-01-01 ---");
    try {
        const res = await axios.get('https://api.avaibook.com/api/owner/bookings/?dateFilter=checkIn&startDate=2020-01-01', { headers });
        console.log(`Length: ${res.data.length}`);
    } catch (e) { console.log("Error:", e.message); }

    console.log("--- TEST 3: ?checkInStartDate=2020-01-01 ---");
    try {
        const res = await axios.get('https://api.avaibook.com/api/owner/bookings/?checkInStartDate=2020-01-01', { headers });
        console.log(`Length: ${res.data.length}`);
    } catch (e) { console.log("Error:", e.message); }
}

testApi();
