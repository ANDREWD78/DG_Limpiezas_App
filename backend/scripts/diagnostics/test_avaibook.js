const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

async function testApi() {
    const headers = {
        'X-AUTH-TOKEN': process.env.AVAIBOOK_TOKEN,
        'Accept': 'application/json'
    };

    const accommodations = ['386667', '384924', '384878'];
    for (const id of accommodations) {
        const url = `https://api.avaibook.com/api/owner/accommodations/${id}/bookings/?limit=100`;
        try {
            const res = await axios.get(url, { headers });
            const items = res.data.items || res.data || [];
            console.log(`\nAccommodation ${id} Bookings: ${items.length}`);
            items.forEach(b => console.log(` - In: ${b.checkInDate} Out: ${b.checkOutDate} Status: ${b.status} ExtID: ${b.externalId}`));
        } catch (e) {
            console.log(`Error for ${id}: ${e.response?.status} - ${e.response?.data?.message || e.message}`);
        }
    }
}

testApi();
