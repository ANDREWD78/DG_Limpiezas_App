// ─── Data constants — ubicaciones, consumibles, zonas fotos ────────────────
'use strict';

// ─── Ubicaciones por casa (incidencias) ────────────────────────────────────
const UBICACIONES = {
    MIRADOR: [
        'Cocina', 'Salón', 'Habitación Flumen', 'Baño común PB (sin ducha)',
        'Oficina', 'Despensa', 'Sala de juegos', 'Habitación Gratal',
        'Habitación Tiacuto', 'Habitación Águila', 'Habitación Gabardiella',
        'Habitación Picón', 'Exterior/Jardín', 'Piscina',
    ],
    CASON: [
        'Entrada', 'Cocina', 'Salón', 'Baño PB', 'Habitación grande',
        'Habitación pequeña', 'Baño suite (habitación pequeña)',
        'Baño escaleras', 'Chimenea/Hogar', 'Exterior',
    ],
    GRATAL: [
        'Entrada', 'Cocina', 'Salón', 'Baño', 'Habitación Matrimonio',
        'Habitación Nido', 'Habitación Literas', 'Habitación 2 camas',
        'Sala de juegos', 'Jardín delantero', 'Jardín trasero',
        'Barbacoa', 'Piscina',
    ],
};

// ─── Categorías de incidencia ───────────────────────────────────────────────
const CATEGORIAS_INCIDENCIA = [
    'Electricidad', 'Agua', 'Calefacción', 'WiFi', 'Puertas-cerraduras',
    'Electrodomésticos', 'Mobiliario', 'Exterior', 'Limpieza extra',
    'Plagas', 'Otro',
];

// ─── Consumibles (orden alfabético, Lavavajillas agrupados) ────────────────
const CONSUMIBLES_BASE = [
    'Ambientador',
    'Bayetas',
    'Bolsas basura',
    'Champú',
    'Esponja friegaplatos',
    'Gel ducha',
    'Jabón manos',
    'Lavavajillas (cápsulas)',
    'Lavavajillas (líquido)',
    'Papel de aluminio',
    'Papel de cocina',
    'Papel higiénico',
    'Pastillas lavavajillas',
    'Sal lavavajillas',
    'Suavizante',
    'Vinagre limpiador',
];
const CONSUMIBLES_GRATAL = ['Café']; // solo Gratal

// ─── Zonas de fotos cierre ─────────────────────────────────────────────────
const ZONAS_FOTOS_BASE = [
    { id: 'cocina', label: 'Cocina', min: 1 },
    { id: 'salon', label: 'Salón', min: 1 },
    { id: 'banos', label: 'Baños', min: 2 },
    { id: 'habitaciones', label: 'Habitaciones', min: 2 },
    { id: 'exterior', label: 'Exterior/Entrada', min: 1 },
];
const ZONA_SALA_JUEGOS = { id: 'sala_juegos', label: 'Sala de juegos', min: 1 };
const ZONA_PISCINA = { id: 'piscina', label: 'Piscina', min: 1 };

// ─── Casas ─────────────────────────────────────────────────────────────────
const CASAS = ['MIRADOR', 'CASON', 'GRATAL'];

// ─── Tipos de limpieza ─────────────────────────────────────────────────────
const TIPOS_LIMPIEZA = ['cambio', 'revision', 'profunda', 'post-incidencia'];

// ─── Temporadas ────────────────────────────────────────────────────────────
const TEMPORADAS = ['verano', 'invierno', 'entretiempo'];

module.exports = {
    UBICACIONES, CATEGORIAS_INCIDENCIA, CONSUMIBLES_BASE, CONSUMIBLES_GRATAL,
    ZONAS_FOTOS_BASE, ZONA_SALA_JUEGOS, ZONA_PISCINA,
    CASAS, TIPOS_LIMPIEZA, TEMPORADAS,
};
