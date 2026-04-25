'use strict';
const { now } = require('./time');

// Helper nativo para evitar axios/follow-redirects y sus fugas de memoria
async function fetchJson(url, headers) {
    const res = await fetch(url, { headers });
    if (!res.ok) {
        let errText = '';
        try { errText = await res.text(); } catch (_) {}
        const err = new Error(`HTTP ${res.status} ${res.statusText}`);
        err.responseData = errText;
        throw err;
    }
    return res.json();
}

// Mapping duro pactado
const AVAIBOOK_MAP = {
    '386667': 'GRATAL',
    '384924': 'CASON',
    '384878': 'MIRADOR'
};

const BASE_URL = 'https://api.avaibook.com/api/owner';

// Cache simple del token en memoria si se necesitara refresco, aquí asumiremos
// lectura directa de ENV o un generador if needed
const getAuthHeaders = () => {
    // Si usas JWT dinámico, cámbialo a tu proveedor de Tokens.
    // Si es un token fijo/Personal Access Token:
    return {
        'X-AUTH-TOKEN': process.env.AVAIBOOK_TOKEN, // Configurado en .env
        'Accept': 'application/json'
    };
};

/**
 * Filtra y normaliza las reservas recibidas
 */
function normalizarReserva(booking) {
    const casa = AVAIBOOK_MAP[String(booking.accommodationId)];
    if (!casa) return null; // Ignoramos alojamientos no mapeados
    
    // FILTRO IMPORTANTE: Descartar de origen las CANCELADAS
    const estado = String(booking.status || '').toUpperCase();
    if (estado.includes('CANCEL') || estado.includes('ANUL') || estado.includes('VOID')) {
        console.log(`[Avaibook] Descartada reserva ${booking.id || booking.externalId} (${casa}) en origen por estado: ${estado}`);
        return null; 
    }

    // Datos económicos
    const importeTotal = Number(booking.totalAmount) || 0;
    const comisionPartner = Number(booking.partnerFee) || 0;
    const comisionAvaibook = Number(booking.avaibookFee) || 0;
    const comisionTotal = comisionPartner + comisionAvaibook;
    const importeNeto = importeTotal - comisionTotal;

    return {
        reserva_id: String(booking.id || ''),
        external_id: String(booking.externalId || ''),
        casa: casa,
        estado_reserva: estado,
        fecha_entrada: String(booking.checkInDate || ''),
        fecha_salida: String(booking.checkOutDate || ''),
        hora_entrada: String(booking.checkinTime || ''),
        hora_salida: String(booking.checkoutTime || ''),
        huespedes: Number(booking.numberOfguests) || 0,
        viajero_nombre: String(booking.travellerName || ''),
        email: String(booking.travellerEmail || ''),
        telefono: String(booking.defaultLeaderPhone || ''),
        accommodation_id: String(booking.accommodationId || ''),
        unit_id: String(booking.unitId || ''),
        canal: String(booking.partnerName || ''),
        origen: 'AVAIBOOK',
        updated_ts: now(),
        importe_total: importeTotal,
        comision_partner: comisionPartner,
        comision_avaibook: comisionAvaibook,
        comision_total: comisionTotal,
        importe_neto: importeNeto
    };
}

/**
 * Obtiene las reservas vigentes operativas
 * Filtramos manualmente startDate por ejemplo para los últimos 7 días hasta N futuros
 */
async function fetchReservasActivas() {
    // Usamos una ventana basada en la fecha de check-in:
    // -1 mes: para incluir reservas recientes, en curso y terminar cierres
    // +10 meses: para el calendario operativo (máx permitido por API es 1 año total)
    const hoy = new Date();
    
    const pasado = new Date(hoy);
    pasado.setMonth(pasado.getMonth() - 1);
    const checkinStartDate = pasado.toISOString().slice(0, 10);
    
    const futuro = new Date(hoy);
    futuro.setMonth(futuro.getMonth() + 10);
    const checkinEndDate = futuro.toISOString().slice(0, 10);

    const url = `${BASE_URL}/bookings/?checkinStartDate=${checkinStartDate}&checkinEndDate=${checkinEndDate}`;

    const headers = getAuthHeaders();
    if (!headers['X-AUTH-TOKEN']) {
        throw new Error('AVAIBOOK_TOKEN no definido en variables de entorno.');
    }

    try {
        let allList = [];
        let offset = 0;
        const limit = 100; // Generalmente las APIs soportan 50-100 por offset

        while (true) {
            const paginatedUrl = `${url}&offset=${offset}&limit=${limit}`;
            const data = await fetchJson(paginatedUrl, headers);
            const items = data?.items || data || [];
            
            if (!Array.isArray(items) || items.length === 0) {
                break; // No hay más resultados
            }

            allList = allList.concat(items);
            
            // Si nos devolvió menos del límite, es la última página
            if (items.length < limit) {
                break;
            }
            offset += limit;
        }

        const normalizadas = allList
            .map(normalizarReserva)
            .filter(Boolean); // quita nulls
            
        return normalizadas;
    } catch (e) {
        console.error('[Avaibook API Error]', e.responseData || e.message);
        throw e;
    }
}

/**
 * Obtiene una reserva individual mediante su ID
 */
async function fetchReservaById(id) {
    const url = `${BASE_URL}/bookings/${id}/`;
    const headers = getAuthHeaders();
    if (!headers['X-AUTH-TOKEN']) {
        throw new Error('AVAIBOOK_TOKEN no definido.');
    }

    try {
        const booking = await fetchJson(url, headers);
        if (!booking) return null;
        return normalizarReserva(booking);
    } catch (e) {
        console.error(`[Avaibook API Error] fetchReservaById(${id}):`, e.responseData || e.message);
        return null; // En caso de error, como que no exista, la ignoramos.
    }
}

/**
 * Recupera bloqueos manuales (Cierres de disponibilidad) usando el calendar endpoint
 */
async function fetchBloqueosCalendario() {
    const hoy = new Date();
    
    const pasado = new Date(hoy);
    pasado.setMonth(pasado.getMonth() - 1);
    const startDate = pasado.toISOString().slice(0, 10);
    
    const futuro = new Date(hoy);
    futuro.setMonth(futuro.getMonth() + 10);
    const endDate = futuro.toISOString().slice(0, 10);

    // El endpoint de calendario tiene un máximo de 90 días por petición.
    // Chunking the date ranges
    const rangeMs = futuro.getTime() - pasado.getTime();
    const rangeDays = Math.ceil(rangeMs / (1000 * 60 * 60 * 24));
    const maxDaysPerChunk = 90;
    
    let chunkStart = new Date(pasado);
    let chunks = [];
    
    while (chunkStart < futuro) {
        let chunkEnd = new Date(chunkStart);
        chunkEnd.setDate(chunkStart.getDate() + maxDaysPerChunk);
        if (chunkEnd > futuro) {
            chunkEnd = new Date(futuro);
        }
        chunks.push({
            startDate: chunkStart.toISOString().slice(0, 10),
            endDate: chunkEnd.toISOString().slice(0, 10)
        });
        chunkStart = new Date(chunkEnd.getTime() + (1000 * 60 * 60 * 24)); // next day
    }

    const headers = getAuthHeaders();
    if (!headers['X-AUTH-TOKEN']) {
        throw new Error('AVAIBOOK_TOKEN no definido.');
    }

    let bloqueos = [];

    // Iterar por todos los alojamientos mapeados
    for (const [accommodationId, casa] of Object.entries(AVAIBOOK_MAP)) {
        for (const chunk of chunks) {
            const url = `${BASE_URL}/accommodations/${accommodationId}/calendar/?startDate=${chunk.startDate}&endDate=${chunk.endDate}`;
            try {
                const data = await fetchJson(url, headers);
                const items = data || [];
                if (!Array.isArray(items)) continue;

                for (const item of items) {
                    if (item.type === 'BLOCKED' && item.booking === '') {
                        // Generar un ID estable para evitar duplicados en BD
                        const blockId = `block_${accommodationId}_${item.startDate}_${item.endDate}`;
                        
                        // Avoid duplicates if a block spans two chunks
                        if (!bloqueos.find(b => b.reserva_id === blockId)) {
                            const bloqueoFakeReserva = {
                                reserva_id: blockId,
                                external_id: '',
                                casa: casa,
                                estado_reserva: 'BLOCKED',
                                fecha_entrada: item.startDate,
                                fecha_salida: item.endDate,
                                hora_entrada: '16:00', // Default por si hace falta en frontend
                                hora_salida: '11:00',
                                huespedes: 0,
                                viajero_nombre: 'Cierre de disponibilidad',
                                email: '',
                                telefono: '',
                                accommodation_id: accommodationId,
                                unit_id: String(item.unit || ''),
                                canal: '',
                                origen: 'MANUAL_BLOCK',
                                updated_ts: now(),
                                importe_total: 0,
                                comision_partner: 0,
                                comision_avaibook: 0,
                                comision_total: 0,
                                importe_neto: 0
                            };
                            bloqueos.push(bloqueoFakeReserva);
                        }
                    }
                }
            } catch (e) {
                console.error(`[Avaibook API Error] fetchBloqueosCalendario(${accommodationId}, ${chunk.startDate}-${chunk.endDate}):`, e.responseData || e.message);
            }
        }
    }

    return bloqueos;
}

module.exports = {
    fetchReservasActivas,
    fetchReservaById,
    fetchBloqueosCalendario,
    normalizarReserva
};
