'use strict';

// ─── Checklist definitivo por casa — FUENTE ÚNICA DE VERDAD ─────────────────
// Estructura: { id, label, cond? }
// cond: 'verano' | 'invierno' → el item solo aplica en esa temporada
// LABEL_MAP se genera automáticamente — no editar a mano.

const CHECKLIST_POR_CASA = {
    MIRADOR: [
        { id: 'cocina', label: 'Cocina' },
        { id: 'horno_neveras', label: 'Limpiar Horno y Neveras' },
        { id: 'menaje', label: 'Revisar cazuelas, vajilla y cubiertos' },
        { id: 'lavavajillas', label: 'Revisar Lavavajillas y Campana' },
        { id: 'habitaciones', label: 'Habitaciones (limpieza y sábanas próxima reserva)' },
        { id: 'banos', label: 'Baños' },
        { id: 'cajones_muebles', label: 'Revisar cajones y muebles' },
        { id: 'salon', label: 'Salón' },
        { id: 'aires', label: 'Aires acondicionados (vaciar agua)' },
        { id: 'exterior_jardin', label: 'Escobar zona entrada exterior y jardín' },
        { id: 'barbacoa', label: 'Limpiar Barbacoa (poner funda)' },
        { id: 'cristal_barbacoa', label: 'Cristal detrás barbacoa' },
        { id: 'piscina', label: 'Piscina', cond: 'verano' },
        { id: 'oficina', label: 'Oficina y sábanas ordenadas' },
        { id: 'consumibles', label: 'Revisar consumibles' },
    ],
    CASON: [
        { id: 'lena', label: 'Rellenar leña' },
        { id: 'cocina', label: 'Cocina' },
        { id: 'horno_neveras', label: 'Limpiar Horno y Neveras' },
        { id: 'menaje', label: 'Revisar cazuelas, vajilla y cubiertos' },
        { id: 'hab_banos', label: 'Habitaciones y baños' },
        { id: 'salon', label: 'Salón' },
        { id: 'porche', label: 'Porche' },
        { id: 'pellets', label: 'Estufa pellets: rellenar, limpiar parte de arriba y cristal', cond: 'invierno' },
        { id: 'telaranas', label: 'Revisar telarañas' },
        { id: 'armario_limpieza', label: 'Armario limpieza: rellenar consumibles y cerrar' },
        { id: 'consumibles', label: 'Revisar consumibles' },
    ],
    GRATAL: [
        { id: 'cocina', label: 'Cocina' },
        { id: 'menaje', label: 'Revisar cazuelas, vajilla y cubiertos' },
        { id: 'habitaciones', label: 'Habitaciones (limpieza y sábanas próxima reserva)' },
        { id: 'cajones_armarios', label: 'Revisar cajones y armarios' },
        { id: 'bano', label: 'Baño' },
        { id: 'salon', label: 'Salón' },
        { id: 'sala_juegos', label: 'Sala juegos ordenada' },
        { id: 'porche_jardin', label: 'Escobar porche y jardín' },
        { id: 'lena', label: 'Rellenar leña', cond: 'invierno' },
        { id: 'estufa', label: 'Estufa: limpiar arriba y cristal' },
        { id: 'aires', label: 'Aires acondicionados (limpieza exterior)' },
        { id: 'piscina', label: 'Revisar piscina', cond: 'verano' },
        { id: 'consumibles', label: 'Revisar consumibles' },
    ],
};

// Mapa plano id → label (primera ocurrencia gana si hay colisión entre casas)
const LABEL_MAP = {};
Object.values(CHECKLIST_POR_CASA).flat().forEach(({ id, label }) => {
    if (!LABEL_MAP[id]) LABEL_MAP[id] = label;
});

module.exports = { CHECKLIST_POR_CASA, LABEL_MAP };
