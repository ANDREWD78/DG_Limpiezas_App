const axios = require('axios');
require('dotenv').config({ path: __dirname + '/.env' });

const ids = [
    'C655D5566C', '3FD30B6121', '1981AB4ED4', '8957C2670F', '2F51F2F879',
    'EACE16A9A4', 'BBE30CDAD4', '9312510F76', '8A859F82C3', 'C1AC83F6EB',
    '1CF140A7CC', 'FC72E218FE', 'B4541D4583', 'D52B5041C8', '42C28F148E',
    '3C1392B053', 'B8CDA68D29', '4CA6BFCC43', 'D889B2D3E0', '5DE8735E5A',
    '4DAD69C0F4', 'DE8F1EDE6E', '73D7F2AB2B', 'A1A8D418CA', '40DD6D0D9D',
    '279D5D9F4C', 'C7E1A5B5A4', 'D31BA0A16A', '2D7D886A56', '98C6E6450D',
    'EFA6DB4ACD', '9257A2301E', 'E965F93A39', '8D9B322D07', '34B2A0A390',
    '408085F1BE', '0436F7A326', 'FD5E9D7621', 'E1DE4FD444'
];

async function runDiagnosis() {
    const headers = {
        'X-AUTH-TOKEN': process.env.AVAIBOOK_TOKEN,
        'Accept': 'application/json'
    };

    const success = [];
    const errors = [];

    console.log(`Diagnosticando ${ids.length} reservas...`);

    // Hacemos peticiones en lotes curados de 5
    for (let i = 0; i < ids.length; i += 5) {
        const chunk = ids.slice(i, i + 5);
        const promises = chunk.map(async (id) => {
            try {
                const res = await axios.get(`https://api.avaibook.com/api/owner/bookings/${id}/`, { headers });
                const b = res.data;
                success.push({
                    reserva_id: b.id,
                    accommodationName: b.accommodationName,
                    unitName: b.unitName,
                    partnerName: b.partnerName || 'DIRECTO/API',
                    checkInDate: b.checkInDate,
                    createdAt: b.createdAt || b.date,
                    status: b.status
                });
            } catch (e) {
                errors.push({
                    reserva_id: id,
                    status_code: e.response?.status || 'N/A',
                    error_message: e.response?.data?.message || e.message
                });
            }
        });
        await Promise.all(promises);
    }

    console.log("\n=======================================================");
    console.log(`✅ RESERVAS QUE SÍ DEVUELVE (Total: ${success.length})`);
    console.log("=======================================================\n");
    console.table(success);
    
    console.log("\n=======================================================");
    console.log(`❌ RESERVAS QUE DA ERROR (Total: ${errors.length})`);
    console.log("=======================================================\n");
    console.table(errors);

    // Resumen analítico automático
    console.log("\n--- RESUMEN ANALÍTICO ---");
    const partners = [...new Set(success.map(s => s.partnerName))];
    console.log(`Canales con éxito: ${partners.join(', ')}`);
    const accs = [...new Set(success.map(s => s.accommodationName))];
    console.log(`Casas con éxito: ${accs.join(', ')}`);
}

runDiagnosis();
