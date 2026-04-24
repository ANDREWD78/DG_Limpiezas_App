'use strict';
require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { createClient } = require('@supabase/supabase-js');

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
const CONSUMIBLES_GRATAL = ['Café'];

async function main() {
    const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = process.env;
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
        console.error('[ERROR] Faltan SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY');
        process.exit(1);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    const rows = [
        ...CONSUMIBLES_BASE.map((nombre, i) => ({ casa: 'ALL',    nombre, activo: true, orden: i + 1 })),
        ...CONSUMIBLES_GRATAL.map((nombre, i) => ({ casa: 'GRATAL', nombre, activo: true, orden: i + 1 })),
    ];

    console.log(`[BACKFILL] Procesando ${rows.length} items...`);
    rows.forEach(r => console.log(`  [${r.casa}] ${r.nombre} (orden ${r.orden})`));

    const { error } = await supabase
        .from('consumibles_catalogo')
        .upsert(rows, { onConflict: 'casa,nombre', ignoreDuplicates: false });

    if (error) {
        console.error('[ERROR] Upsert fallido:', error.message);
        process.exit(1);
    }

    console.log(`[BACKFILL] OK — ${rows.length} items insertados/actualizados`);
}

main().catch(e => { console.error('[ERROR] Fatal:', e.message); process.exit(1); });
