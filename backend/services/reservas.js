const sheets = require('./sheets');

/**
 * Recupera reservas de Avaibook y Overrides, las fusiona y devuelve
 * un array con las reservas integradas.
 */
async function getReservasFusionadas() {
    const [rAvaibook, rHistoricas, rOverrides] = await Promise.all([
        sheets.readSheetAsObjects('ReservasAvaibook').catch(() => []),
        sheets.readSheetAsObjects('ReservasHistoricas').catch(() => []),
        sheets.readSheetAsObjects('ReservasOverrides').catch(() => [])
    ]);

    const mapAvaibook = new Set(rAvaibook.map(r => String(r.reserva_id)));
    const rHistoricasFiltradas = rHistoricas.filter(r => r.reserva_id && !mapAvaibook.has(String(r.reserva_id)));
    const reservasBase = [...rHistoricasFiltradas, ...rAvaibook];

    const mapOverrides = new Map(rOverrides.map(o => [o.reserva_id, o]));
    const reservasContexto = reservasBase.map(ra => {
        const ov = mapOverrides.get(ra.reserva_id) || {};
        return {
            reserva_id: ra.reserva_id,
            external_id: ra.external_id,
            casa: ra.casa,
            estado_reserva: ra.estado_reserva,
            fecha_entrada: ra.fecha_entrada,
            fecha_salida: ra.fecha_salida,
            hora_entrada: ra.hora_entrada,
            hora_salida: ra.hora_salida,
            huespedes: ra.huespedes,
            viajero_nombre: ra.viajero_nombre,
            email: ra.email,
            telefono: ra.telefono,
            accommodation_id: ra.accommodation_id,
            unit_id: ra.unit_id,
            canal: ra.canal,
            origen: ra.origen,
            // Datos económicos
            importe_total: ra.importe_total || '0',
            comision_partner: ra.comision_partner || '0',
            comision_avaibook: ra.comision_avaibook || '0',
            comision_total: ra.comision_total || '0',
            importe_neto: ra.importe_neto || '0',
            // Overrides fusionados
            cuna: ov.cuna || '',
            num_cunas: ov.num_cunas || '',
            late_checkout: ov.late_checkout || '',
            late_checkout_hora: ov.late_checkout_hora || '',
            nota_interna: ov.nota_interna || '',
            nota_equipo: ov.nota_equipo || ''
        };
    });

    return reservasContexto;
}

module.exports = {
    getReservasFusionadas
};
