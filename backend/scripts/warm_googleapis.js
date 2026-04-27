'use strict';
// Calienta el caché de módulos de googleapis y mide el tiempo de carga.
// Ejecutar una vez antes del backfill si el require se bloquea:
//   node backend/scripts/warm_googleapis.js
console.time('googleapis');
require('googleapis');
console.timeEnd('googleapis');
console.log('OK — googleapis listo');
