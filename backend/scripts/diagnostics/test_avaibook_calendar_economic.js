const axios = require('axios');
require('dotenv').config({ path: __dirname + '/../../.env' });

async function testApi() {
    const headers = {
        'X-AUTH-TOKEN': process.env.AVAIBOOK_TOKEN,
        'Accept': 'application/json'
    };

    console.log(`\n--- TEST 2: BOOKINGS ENDPOINT (Economic Data) ---`);
    // Using a wide date range to ensure we catch some bookings
    const bookingsUrl = `https://api.avaibook.com/api/owner/bookings/?limit=5&checkinStartDate=2026-01-01&checkinEndDate=2026-12-31`;
    try {
        const res = await axios.get(bookingsUrl, { headers });
        console.log(`Bookings API Response Status: ${res.status}`);
        const items = res.data.items || res.data || [];
        console.log(`Found ${items.length} bookings.`);
        if (items.length > 0) {
            console.log('\nSample Booking Details (from list):');
            const firstBooking = items[0];
            console.log(JSON.stringify(firstBooking, null, 2));
            
            const testBookingId = firstBooking.id || firstBooking.bookingId || firstBooking.externalId;
            if(testBookingId) {
                console.log(`\n--- TEST 2.1: DETAILED BOOKING ENDPOINT (${testBookingId}) ---`);
                const bookingDetailUrl = `https://api.avaibook.com/api/owner/bookings/${testBookingId}/`;
                const reqDetail = await axios.get(bookingDetailUrl, { headers });
                console.log('Detailed Booking Info (Filtered for Economic fields):');
                
                const b = reqDetail.data;
                const ecoData = {
                    id: b.id,
                    totalPrice: b.totalPrice,
                    amount: b.amount,
                    advanceAmount: b.advanceAmount,
                    totalPaid: b.totalPaid,
                    pendingAmount: b.pendingAmount,
                    commission: b.commission,
                    avaibookCommission: b.avaibookCommission,
                    partnerCommission: b.partnerCommission,
                    totalAmount: b.totalAmount,
                    netAmount: b.netAmount,
                    prices: b.prices,
                    financials: b.financials
                };
                console.log(JSON.stringify(ecoData, null, 2));
                console.log('\nFull Detailed Response:');
                console.log(JSON.stringify(b, null, 2));
            } else {
                console.log('No booking ID found to test details.');
            }
        }
    } catch (e) {
        console.log(`Error reading bookings: ${e.response?.status} - ${JSON.stringify(e.response?.data) || e.message}`);
    }
}

testApi();
