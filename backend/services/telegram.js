'use strict';
const { LABEL_MAP } = require('../data/checklist');
const API_URL = () => `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`;
const CHAT_ID = () => process.env.TELEGRAM_CHAT_ID;

// ─── Cliente Supabase (lazy) — solo para generar signed URLs en notificaciones ─
const { createClient } = require('@supabase/supabase-js');
let _supabase = null;
function getSupabase() {
    if (_supabase) return _supabase;
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) return null;
    _supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    return _supabase;
}

async function sendMessage(text) {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token || token.includes('TU_BOT')) { console.warn('[TG] token no configurado'); return false; }
    try {
        const res = await fetch(`${API_URL()}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID(), text, parse_mode: 'Markdown' }),
        });
        return res.ok;
    } catch (e) { console.error('[TG]', e.message); return false; }
}

// Envía una sola foto por URL (signed URL de Supabase)
async function sendPhoto(photoUrl, caption = '') {
    try {
        const res = await fetch(`${API_URL()}/sendPhoto`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID(), photo: photoUrl, caption }),
        });
        if (!res.ok) console.warn('[TG] sendPhoto no ok:', await res.text());
        return res.ok;
    } catch (e) { console.error('[TG] sendPhoto error:', e.message); return false; }
}

// Env\u00eda grupo de fotos por URL (2-10 items, l\u00edmite de la API de Telegram)
async function sendMediaGroup(photoUrls, caption = '') {
    if (!photoUrls || photoUrls.length < 2) return false;
    const media = photoUrls.slice(0, 10).map((url, i) => ({
        type: 'photo',
        media: url,
        // Solo el primero puede llevar caption sin conflicto
        ...(i === 0 && caption ? { caption } : {}),
    }));
    try {
        const res = await fetch(`${API_URL()}/sendMediaGroup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID(), media }),
        });
        if (!res.ok) console.warn('[TG] sendMediaGroup no ok:', await res.text());
        return res.ok;
    } catch (e) { console.error('[TG] sendMediaGroup error:', e.message); return false; }
}

// Envía un vídeo por URL
async function sendVideo(videoUrl, caption = '') {
    try {
        const res = await fetch(`${API_URL()}/sendVideo`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ chat_id: CHAT_ID(), video: videoUrl, caption }),
        });
        if (!res.ok) console.warn('[TG] sendVideo no ok:', await res.text());
        return res.ok;
    } catch (e) { console.error('[TG] sendVideo error:', e.message); return false; }
}

// ─── Helpers Telegram v2 ────────────────────────────────────────────────────
const TIPO_LABEL = {
    cambio: 'Cambio de huéspedes',
    cambio_huespedes: 'Cambio de huéspedes',
    revision_rapida: 'Revisión rápida',
    revision: 'Revisión rápida',
    actuacion_mantenimiento: 'Actuación / mantenimiento',
    'post-incidencia': 'Post-incidencia',
};
const URG_ICON = { Urgente: '⚡', Alta: '🔴', Media: '🟡', Baja: '🟢' };
const PRIO_ICON = { Urgente: '🆘', Alta: '🔴', Media: '🟠', Baja: '🟡' };

function _emojiConsumible(nombre) {
    if (!nombre) return '📦';
    const n = nombre.toLowerCase();
    if (/bolsa|basura/.test(n)) return '🗑️';
    if (/gel|champu|champú|jabón|jabon/.test(n)) return '🧴';
    if (/papel|higién|higien|wc|toilet/.test(n)) return '🧻';
    if (/café|cafe|coffee/.test(n)) return '☕';
    if (/leña|lena/.test(n)) return '🪵';
    if (/pellet/.test(n)) return '🔥';
    if (/toall/.test(n)) return '🧺';
    if (/sában|saban|cama|bed/.test(n)) return '🛏️';
    if (/lavav|vajill|dish/.test(n)) return '🍽️';
    if (/detergent|lavad/.test(n)) return '👕';
    if (/fregona|mop|suelo/.test(n)) return '🧹';
    if (/escoba|barr/.test(n)) return '🧹';
    if (/suavizante|freganola/.test(n)) return '🫧';
    if (/aceite|oil/.test(n)) return '🫙';
    if (/agua|bebid|vino/.test(n)) return '🍶';
    if (/bombill|led/.test(n)) return '💡';
    return '📦';
}

function contarFotos(fotosJson) {
    try {
        if (!fotosJson) return 0;
        const p = JSON.parse(fotosJson);
        if (Array.isArray(p)) return p.filter(Boolean).length;
        return Object.values(p).flat().filter(Boolean).length;
    } catch { return 0; }
}

/**
 * Extrae un array plano de paths limpios desde fotos_cierre_urls_json.
 * Soporta los formatos reales conocidos:
 *   - ["MIRADOR/.../foto.jpg"]                   (array de strings)
 *   - { "cierre": ["MIRADOR/.../foto.jpg"] }     (objeto con arrays de strings)
 *   - { "cierre": [{ path, id, fullPath }] }     (objeto con arrays de objetos)
 *   - mezclas razonables de los anteriores
 */
function extraerPathsFotos(fotosJson) {
    if (!fotosJson) return [];
    let parsed;
    try { parsed = JSON.parse(fotosJson); } catch { return []; }

    const BUCKET_PREFIX = (process.env.SUPABASE_BUCKET_PARTES || 'partes-fotos') + '/';

    function normalizarItem(item) {
        if (!item) return null;
        if (typeof item === 'string') {
            // Limpiar prefijo del bucket si viene en el string
            return item.startsWith(BUCKET_PREFIX) ? item.slice(BUCKET_PREFIX.length) : item;
        }
        if (typeof item === 'object') {
            // Preferir `path`; fallback a `fullPath` limpiando el prefijo del bucket
            if (item.path) return normalizarItem(item.path);
            if (item.fullPath) return normalizarItem(item.fullPath);
        }
        return null;
    }

    const items = Array.isArray(parsed)
        ? parsed
        : Object.values(parsed).flat();

    return items.map(normalizarItem).filter(Boolean);
}

/**
 * Genera signed URLs temporales (7 días) para un array de paths.
 * Devuelve array de objetos { path, url }.
 * Los paths que fallen se omiten sin romper los demás.
 */
async function crearSignedUrlsFotos(paths) {
    const sb = getSupabase();
    if (!sb || !paths.length) return [];
    const bucket = process.env.SUPABASE_BUCKET_PARTES || 'partes-fotos';
    const EXPIRY = 60 * 60 * 24 * 7; // 7 días en segundos
    const resultados = [];
    for (const path of paths) {
        try {
            const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, EXPIRY);
            if (error || !data?.signedUrl) {
                console.warn(`[TG] signed URL fallida para ${path}:`, error?.message);
                continue;
            }
            resultados.push({ path, url: data.signedUrl });
        } catch (e) {
            console.warn(`[TG] excepción signed URL para ${path}:`, e.message);
        }
    }
    return resultados;
}

function _hhmm(ts) {
    if (!ts) return '';
    try {
        return new Date(ts).toLocaleTimeString('es-ES', {
            hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid',
        });
    } catch { return ''; }
}

function _fechaCorta(ts) {
    if (!ts) return '';
    try {
        return new Date(ts).toLocaleDateString('es-ES', {
            day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Europe/Madrid',
        });
    } catch { return ''; }
}

function _formatDur(min) {
    if (!min) return null;
    const m = Math.round(Number(min));
    if (isNaN(m) || m <= 0) return null;
    if (m < 60) return `${m} min`;
    const h = Math.floor(m / 60);
    const rem = m % 60;
    return `${h} h${rem > 0 ? ` ${String(rem).padStart(2, '0')} min` : ''}`;
}

// Mensaje completo v2 al cerrar parte
// Compatibilidad: campos v2 opcionales — si están vacíos, su línea se omite
async function notificarParte({
    casa, tipo_limpieza, usuario_nombre,
    inicio_ts, fin_ts, duracion_min, tiempo_efectivo_min,
    suciedad_1a5, casa_lista, casa_lista_falta_texto,
    tareas_realizadas, limpieza_profunda_texto, observaciones,
    fotos_cierre_urls_json, checklist_json,
    drive_folder_url, tareas_periodicas_json,
    consumibles = [], incidencias = [],
}) {
    const listaOk = casa_lista === 'Sí';
    const lines = [];

    // Cabecera
    lines.push(`${listaOk ? '✅' : '⚠️'} *Parte cerrado*`);
    lines.push('────────────────────');

    // Identidad
    lines.push(`👤 ${usuario_nombre || '—'}`);
    lines.push(`📍 Casa: ${casa}`);
    lines.push(`🧾 Tipo: ${TIPO_LABEL[tipo_limpieza] || tipo_limpieza || '—'}`);

    // Tiempo
    const fecha = _fechaCorta(inicio_ts || fin_ts);
    const ini = _hhmm(inicio_ts);
    const fin = _hhmm(fin_ts);
    if (fecha) lines.push(`📅 ${fecha}${ini ? ` · ${ini} → ${fin}` : ''}`);

    const durStr = _formatDur(tiempo_efectivo_min || duracion_min);
    if (durStr) lines.push(`⏱ ${durStr}`);

    lines.push('');

    // Suciedad
    if (suciedad_1a5) lines.push(`🟡 Suciedad: ${suciedad_1a5}/5`);

    // Casa lista
    if (casa_lista) {
        lines.push(listaOk ? '✅ Casa lista' : '⚠️ Casa no lista');
        if (!listaOk && casa_lista_falta_texto) {
            lines.push(`   Motivo: ${casa_lista_falta_texto}`);
        }
    }

    // Consumibles
    if (consumibles.length > 0) {
        lines.push('');
        lines.push('🧴 Consumibles:');
        consumibles.forEach(c => {
            const nombre = (c.item === 'Otro' && c.item_otro) ? c.item_otro : (c.item || 'Otro');
            const icon = _emojiConsumible(nombre);
            lines.push(`  ${icon} ${nombre}${c.urgencia ? ` (${c.urgencia})` : ''}`);
        });
    }

    // Incidencias
    if (incidencias.length > 0) {
        lines.push('');
        lines.push('⚠️ Incidencias:');
        incidencias.forEach(i => {
            const icon = PRIO_ICON[i.prioridad] || '🔴';
            const lugar = i.ubicacion ? `${i.ubicacion} — ` : '';
            lines.push(`  ${icon} ${lugar}${i.categoria}${i.prioridad ? ` (${i.prioridad})` : ''}`);
        });
    }

    // Campos texto opcionales
    if (tareas_realizadas) {
        lines.push('');
        lines.push(`🧹 Tareas realizadas: ${tareas_realizadas}`);
    }
    if (limpieza_profunda_texto) {
        lines.push(`📝 No previsto: ${limpieza_profunda_texto}`);
    }
    if (observaciones) {
        lines.push(`💬 Obs.: ${observaciones}`);
    }

    // Checklist incompleto
    if (checklist_json) {
        try {
            const cl = JSON.parse(checklist_json);
            const incompletos = Object.entries(cl)
                .filter(([, v]) => !v)
                .map(([k]) => LABEL_MAP[k] || k); // label legible, fallback al ID
            if (incompletos.length) {
                lines.push('');
                lines.push('⚠️ Checklist incompleto:');
                incompletos.forEach(lbl => lines.push(`  - ${lbl}`));
            }
        } catch { /* JSON inválido — ignorar */ }
    }

    // Tareas periódicas
    if (tareas_periodicas_json) {
        try {
            const tp = JSON.parse(tareas_periodicas_json);
            if (tp.length > 0) {
                lines.push('');
                lines.push('🛠️ Tareas periódicas:');
                tp.forEach(t => lines.push(`  ${t.done ? '✅' : '❌'} ${t.nombre}`));
            }
        } catch { /* JSON inválido — ignorar */ }
    }

    // ─── Fotos ──────────────────────────────────────────────────
    const nFotos = contarFotos(fotos_cierre_urls_json);
    lines.push('');
    lines.push(nFotos > 0 ? `📷 Fotos: ${nFotos}` : '📷 Sin fotos');

    // Compatibilidad legacy: enlace Drive si existe
    if (drive_folder_url) lines.push(`📁 [Ver carpeta Drive](${drive_folder_url})`);

    // Si hay fotos Supabase, indicar que llegan a continuación (sin URLs en el texto)
    let signedFotos = [];
    if (nFotos > 0) {
        try {
            const paths = extraerPathsFotos(fotos_cierre_urls_json);
            if (paths.length > 0) {
                signedFotos = await crearSignedUrlsFotos(paths.slice(0, 10));
                if (signedFotos.length > 0) {
                    lines.push('📎 Fotos enviadas a continuación');
                }
            }
        } catch (e) {
            console.error('[TG] error generando signed URLs:', e.message);
        }
    }

    // 1. Enviar el resumen del parte
    const okResumen = await sendMessage(lines.join('\n'));

    // 2. Enviar las fotos como mensajes visuales separados (sin URLs en el texto)
    if (signedFotos.length === 1) {
        await sendPhoto(signedFotos[0].url, '\ud83d\udcf7 Foto del parte');
    } else if (signedFotos.length > 1) {
        const okAlbum = await sendMediaGroup(signedFotos.map(s => s.url), '\ud83d\udcf7 Fotos del parte');
        if (!okAlbum) {
            console.warn('[TG] Fallback partes: enviando fotos individualmente');
            for (let i = 0; i < signedFotos.length; i++) {
                await sendPhoto(signedFotos[i].url, i === 0 ? '\ud83d\udcf7 Fotos del parte' : '');
            }
        }
    }

    return okResumen;
}

// Incidencia
async function notificarIncidencia({ casa, categoria, ubicacion, prioridad, descripcion, limpiador, fotoUrls = [], videoUrl = null }) {
    const icons = { Urgente: '🆘', Alta: '🔴', Baja: '🟡' };
    
    // Fallback legacy por si acaso se llama con fotoUrl singular antiguo
    const fotos = arguments[0].fotoUrl ? [arguments[0].fotoUrl, ...fotoUrls].filter(Boolean) : fotoUrls;

    const t = `${icons[prioridad] || '🔴'} *INCIDENCIA ${prioridad?.toUpperCase()} — ${casa}*
📍 ${ubicacion} · 🏷 ${categoria}
👤 ${limpiador}
📝 ${descripcion}`;

    // 1. Enviar el resumen de la incidencia
    const okResumen = await sendMessage(t);

    // 2. Enviar las fotos
    if (fotos.length === 1) {
        await sendPhoto(fotos[0], '\ud83d\udcf7 Foto de la incidencia');
    } else if (fotos.length > 1) {
        const okAlbum = await sendMediaGroup(fotos, '\ud83d\udcf7 Fotos de la incidencia');
        if (!okAlbum) {
            console.warn('[TG] Fallback incidencias: enviando fotos individualmente');
            for (let i = 0; i < fotos.length; i++) {
                await sendPhoto(fotos[i], i === 0 ? '\ud83d\udcf7 Fotos de la incidencia' : '');
            }
        }
    }

    // 3. Enviar el vídeo
    if (videoUrl) {
        await sendVideo(videoUrl);
    }

    return okResumen;
}

// Recordatorio diario — incidencias abiertas
async function recordatorioDiario(incidencias) {
    if (!incidencias.length) return;
    const urgentes = incidencias.filter(i => i.prioridad === 'Urgente');
    const resto = incidencias.filter(i => i.prioridad !== 'Urgente');
    let t = `🔔 *Recordatorio diario — Incidencias abiertas*\n`;
    if (urgentes.length) {
        t += `\n🆘 *URGENTES (${urgentes.length}):*\n` +
            urgentes.map(i => `  • ${i.casa} · ${i.ubicacion} · ${i.descripcion.slice(0, 60)}`).join('\n');
    }
    if (resto.length) {
        t += `\n🟡 Otras: ${resto.length}\n` +
            resto.slice(0, 5).map(i => `  • ${i.casa} · ${i.descripcion.slice(0, 50)}`).join('\n');
    }
    return sendMessage(t);
}

// Resumen semanal — jueves
async function resumenSemanal({ incidencias, consumibles }) {
    const abiertas = incidencias.filter(i => ['Pendiente', 'Abierta', 'En curso'].includes(i.estado));
    const pendCons = consumibles.filter(c => c.estado === 'Pendiente');
    const t = `📊 *Resumen semanal — DG Limpiezas*

🔴 Incidencias abiertas/en curso: *${abiertas.length}*
${abiertas.slice(0, 5).map(i => `  • ${i.casa} · ${i.prioridad} · ${i.descripcion.slice(0, 50)}`).join('\n')}

🧴 Consumibles pendientes: *${pendCons.length}*
${pendCons.slice(0, 8).map(c => `  • ${c.casa} · ${c.item}`).join('\n')}`;
    return sendMessage(t);
}

// Resumen mensual — último día del mes
async function resumenMensual({ mes, empleadas }) {
    const totalCoste = empleadas.reduce((a, e) => a + parseFloat(e.coste || 0), 0).toFixed(2);
    const t = `📅 *Resumen mensual ${mes}*

${empleadas.map(e =>
        `👤 *${e.nombre}*: ${e.horas}h → ${e.coste}€`
    ).join('\n')}

💰 *Total mes: ${totalCoste}€*`;
    return sendMessage(t);
}

// Consumibles rápidos — alta sin parte
async function notificarConsumiblesRapidos({ casa, usuario, items }) {
    const urgIcon = { Urgente: '🆘', Alta: '🔴', Media: '🟡', Baja: '🟢' };
    const lista = items.map(it => {
        const nombre = it.item === 'Otro' ? (it.item_otro || 'Otro') : it.item;
        return `  ${urgIcon[it.urgencia] || '🟡'} ${nombre} (${it.urgencia || 'Media'})`;
    }).join('\n');
    const t = `🧴 *Consumibles — Alta rápida*\n🏠 ${casa}\n👤 ${usuario}\n\n${lista}`;
    return sendMessage(t);
}

// alias usado en admin.js para envíos directos de texto
const enviarMensaje = sendMessage;

module.exports = { sendMessage, enviarMensaje, notificarParte, notificarIncidencia, notificarConsumiblesRapidos, recordatorioDiario, resumenSemanal, resumenMensual };
