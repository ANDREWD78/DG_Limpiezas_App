// Helpers de zona horaria Europe/Madrid para visualización de timestamps
// Usar siempre estos helpers en lugar de toLocaleString/toTimeString/slice(11,16).

const TZ = 'Europe/Madrid';

function _parts(d) {
  const ps = new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  }).formatToParts(d);
  const p = {};
  ps.forEach(x => { p[x.type] = x.value; });
  if (p.hour === '24') p.hour = '00';
  return p;
}

// "27/04/26 · 17:45"
export function formatDateTimeMadrid(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = _parts(d);
  return `${p.day}/${p.month}/${p.year.slice(2)} · ${p.hour}:${p.minute}`;
}

// "17:45"
export function formatTimeMadrid(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = _parts(d);
  return `${p.hour}:${p.minute}`;
}

// "27/04/26"
export function formatDateMadrid(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = _parts(d);
  return `${p.day}/${p.month}/${p.year.slice(2)}`;
}

// Fecha de hoy en Madrid → "YYYY-MM-DD"
export function todayMadrid() {
  const p = _parts(new Date());
  return `${p.year}-${p.month}-${p.day}`;
}

// Hora actual en Madrid → "HH:MM"
export function timeMadrid() {
  const p = _parts(new Date());
  return `${p.hour}:${p.minute}`;
}

// Convierte timestamp UTC a valor para <input type="datetime-local"> en hora Madrid
// Devuelve "YYYY-MM-DDTHH:MM"
export function toDatetimeLocalMadrid(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const p = _parts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}
