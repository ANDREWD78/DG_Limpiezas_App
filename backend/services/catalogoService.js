'use strict';
/**
 * catalogoService.js — Funciones reutilizables para leer y escribir
 * Config.consumibles_catalogo en Google Sheets.
 *
 * Reglas:
 * - El catálogo se almacena como un string pipe-separated ("Item A|Item B|…")
 * - Café → solo Gratal (mantenido por lógica externa: CONSUMIBLES_GRATAL en constants.js)
 * - Los "Lavavajillas – …" se agrupan automáticamente por el sort natural español
 * - Ninguna función añade duplicados
 */

const sheets = require('./sheets');

const CONFIG_KEY = 'consumibles_catalogo';

/**
 * Leer el catálogo completo como array de strings (ya ordenado).
 * @returns {Promise<string[]>}
 */
async function readCatalogo() {
    const cfg = await sheets.readSheetAsObjects('Config');
    const row = cfg.find(r => r.key === CONFIG_KEY);
    if (!row?.value) return [];
    return row.value.split('|').map(s => s.trim()).filter(Boolean);
}

/**
 * Añadir un item al catálogo si no existe ya.
 * Mantiene orden alfabético español.
 * @param {string} item
 * @returns {{ added: boolean, item: string }}
 */
async function addItemToCatalogo(item) {
    const normalizedItem = item.trim();
    if (!normalizedItem) throw new Error('item vacío');

    const cfg = await sheets.readSheetAsObjects('Config');
    const row = cfg.find(r => r.key === CONFIG_KEY);
    if (!row) throw new Error('Config.consumibles_catalogo no encontrado');

    const items = row.value.split('|').map(s => s.trim()).filter(Boolean);

    // Comprobar duplicado (case-insensitive)
    const alreadyExists = items.some(
        i => i.toLowerCase() === normalizedItem.toLowerCase()
    );
    if (alreadyExists) return { added: false, item: normalizedItem };

    items.push(normalizedItem);
    items.sort((a, b) => a.localeCompare(b, 'es', { sensitivity: 'base' }));

    await sheets.updateRow('Config', row._row, [
        row.key,
        items.join('|'),
        row.descripcion || '',
    ]);
    return { added: true, item: normalizedItem };
}

/**
 * Comprobar si un item ya está en el catálogo (case-insensitive).
 * @param {string} item
 */
async function itemInCatalogo(item) {
    const items = await readCatalogo();
    return items.some(i => i.toLowerCase() === item.trim().toLowerCase());
}

module.exports = { readCatalogo, addItemToCatalogo, itemInCatalogo };
