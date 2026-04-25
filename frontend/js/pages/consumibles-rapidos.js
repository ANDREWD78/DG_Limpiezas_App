// ─── Consumibles Rápidos — sin parte ──────────────────────────────────────────
// Permite apuntar faltas de consumibles desde la selector, sin crear parte.
// Guarda en Consumibles con parte_id='RAPIDO-{casa}' para diferenciar.
import { api } from '../api.js';
import { toast } from '../components/toast.js';
import { CASA_ICON } from '../utils/casas.js';



// Emoji por consumible — búsqueda substring case-insensitive
function emojiConsumible(nombre) {
    const n = (nombre || '').toLowerCase();
    if (n.includes('papel') || n.includes('wc') || n.includes('higiéni') || n.includes('higieni')) return '🧻';
    if (n.includes('jabón') || n.includes('jabon') || n.includes('gel') || n.includes('champú') || n.includes('champu')) return '🧴';
    if (n.includes('bayeta') || n.includes('fregona') || n.includes('estropajo') || n.includes('esponja')) return '🧽';
    if (n.includes('lejía') || n.includes('lejia')) return '🧪';
    if (n.includes('lavavajillas') || n.includes('vajillas') || n.includes('detergente') || n.includes('suavizante')) return '🫧';
    if (n.includes('café') || n.includes('cafe')) return '☕';
    if (n.includes('azúcar') || n.includes('azucar')) return '🍬';
    if (n.includes('sal ') || n === 'sal') return '🧂';
    if (n.includes('aceite')) return '🫙';
    if (n.includes('leña') || n.includes('lena')) return '🪵';
    if (n.includes('pellet')) return '⚫';
    if (n.includes('ambientador') || n.includes('desodor') || n.includes('aromatiz')) return '🌸';
    if (n.includes('bolsa') || n.includes('basura')) return '🗑️';
    if (n.includes('guante')) return '🧤';
    if (n.includes('alcohol') || n.includes('desinfect')) return '🩺';
    if (n.includes('toalla') || n.includes('servilleta')) return '🧸';
    if (n.includes('escoba') || n.includes('recogedor') || n.includes('mopa')) return '🧹';
    return '📦';
}

export async function renderConsumiblesRapidos(navigate, state) {
    const container = document.getElementById('page-container');
    const { casa } = state.parte;

    if (!casa) {
        toast('Selecciona una casa primero', 'error');
        navigate('selector');
        return;
    }

    const icon = CASA_ICON[casa] || '🏠';

    // ── Estilos visuales coherentes con la app ─────────────────────────────────
    const txStyle = 'flex:1; background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:10px; padding:10px 12px; color:#f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08); outline:none; box-sizing:border-box; font-size:.85rem; transition:border-color .2s, box-shadow .2s;';
    const ugStyle = 'background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:8px; padding:6px 10px; color:#f8fafc; outline:none; box-sizing:border-box; font-size:.78rem; cursor:pointer; transition:border-color .2s, box-shadow .2s; width:82px; flex-shrink:0;';
    const focusShadow = '0 0 0 2px rgba(99,102,241,.35), inset 0 1px 0 rgba(255,255,255,.03)';
    const blurShadow  = 'inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08)';
    function applyFocusBlur(el) {
        if (!el) return;
        el.addEventListener('focus', () => { el.style.borderColor = 'rgba(99,102,241,.8)'; el.style.boxShadow = focusShadow; });
        el.addEventListener('blur',  () => { el.style.borderColor = 'rgba(148,163,184,.35)'; el.style.boxShadow = blurShadow; });
    }

    container.innerHTML =
        '<div style="display:flex;align-items:center;gap:12px;padding:16px 16px 8px;border-bottom:1px solid var(--border);">' +
        '<button id="btn-back" class="btn-back">Volver</button>' +
        '<span style="font-weight:800;font-size:1.1rem;">' + icon + ' 🛒 Consumibles — ' + casa + '</span>' +
        '</div>' +
        '<div class="page" style="padding-bottom:100px;">' +

        '<div class="card" style="background:rgba(59,130,246,.07);border-color:rgba(59,130,246,.25);margin-bottom:8px;">' +
        '<p style="font-size:.82rem;color:var(--text-muted);line-height:1.5;">' +
        '📋 Apunta aquí lo que falta <strong>sin crear un parte de limpieza</strong>. ' +
        'Quedará en la lista de compra y el admin recibirá la notificación.' +
        '</p>' +
        '</div>' +

        '<div class="section-header"><h2>🛒 Lista actual pendiente</h2></div>' +
        '<div id="lista-pendiente" class="card">' +
        '<div class="loading-spinner" style="margin:12px auto;"></div>' +
        '</div>' +

        '<div class="section-header mt-16"><h2>🛒 Añadir consumibles</h2></div>' +
        '<div class="card">' +
        '<div id="cat-items"><div class="loading-spinner" style="margin:8px auto;"></div></div>' +
        '<div id="otro-rapido-wrap" style="padding:10px 0 0;border-top:1px solid var(--border);margin-top:8px;">' +
        '<div style="font-size:.8rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;">Consumibles no catalogados</div>' +
        '<div id="otro-rapido-list"></div>' +
        '<button type="button" id="btn-add-otro-rap" class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;font-size:.82rem;">➕ Añadir consumible…</button>' +
        '</div>' +
        '</div>' +

        '</div>' +

        '<div class="bottom-actions">' +
        '<button id="btn-enviar-rap" class="btn btn-primary w-full" style="margin-top:12px;font-size:1rem;height:52px;">🛒 Añadir a la lista de compra</button>' +
        '</div>';

    // ── Cargar lista pendiente ──────────────────────────────────────────────────
    try {
        const pendientes = await api.consumibles({ casa, estado: 'Pendiente' });
        const pEl = container.querySelector('#lista-pendiente');
        if (!pendientes.length) {
            pEl.innerHTML = '<p style="font-size:.82rem;color:var(--text-muted);">✅ Nada pendiente actualmente</p>';
        } else {
            pEl.innerHTML = pendientes.slice(0, 20).map(p => {
                const nombre = p.item === 'Otro' ? (p.item_otro || p.item) : p.item;
                return '<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border);font-size:.82rem;">' +
                    '<span>' + emojiConsumible(nombre) + ' ' + nombre + '</span>' +
                    '<span class="badge badge-pending" style="font-size:.68rem;">' + (p.urgencia || 'Normal') + '</span>' +
                    '</div>';
            }).join('');
        }
    } catch (e) {
        container.querySelector('#lista-pendiente').innerHTML = '<p class="text-muted">—</p>';
        console.error('[consumibles-rapidos] pendientes:', e);
    }

    // ── Cargar catálogo ────────────────────────────────────────────────────────
    try {
        const list = await api.catalogoConsumo(casa);
        container.querySelector('#cat-items').innerHTML = list.map(item =>
            '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);">' +
            '<label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;">' +
            '<input type="checkbox" class="cat-chk" data-item="' + item + '" style="width:22px;height:22px;accent-color:var(--primary);flex-shrink:0;"/>' +
            '<span style="font-size:.88rem;">' + emojiConsumible(item) + ' ' + item + '</span>' +
            '</label>' +
            '<select class="form-select cat-urg" data-urg="' + item + '" style="' + ugStyle + '">' +
            ['Normal', 'Urgente'].map(u =>
                '<option ' + (u === 'Normal' ? 'selected' : '') + '>' + u + '</option>').join('') +
            '</select>' +
            '</div>'
        ).join('') || '<p class="text-muted">Sin catálogo</p>';
        container.querySelectorAll('.cat-urg').forEach(sel => applyFocusBlur(sel));
    } catch (e) {
        container.querySelector('#cat-items').innerHTML = '<p class="text-muted">—</p>';
        console.error('[consumibles-rapidos] catalogo:', e);
    }

    // ── Otro rows ──────────────────────────────────────────────────────────────
    let _rapIdx = 0;
    function addOtroRap(defaultText, defaultUrg) {
        defaultText = defaultText || ''; defaultUrg = defaultUrg || 'Normal';
        const row = document.createElement('div');
        row.className = 'otro-row';
        row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
        row.innerHTML =
            '<input type="text" class="form-input otro-txt" placeholder="¿Qué falta?" value="' + defaultText + '"' +
            ' style="' + txStyle + '"/>' +
            '<select class="form-select otro-urg" style="' + ugStyle + '">' +
            ['Normal', 'Urgente'].map(u =>
                '<option ' + (u === defaultUrg ? 'selected' : '') + '>' + u + '</option>').join('') +
            '</select>' +
            '<button type="button" class="btn btn-danger btn-sm otro-del" style="width:32px;padding:0;flex-shrink:0;font-size:1rem;">&#x2715;</button>';
        row.querySelector('.otro-del').addEventListener('click', () => row.remove());
        applyFocusBlur(row.querySelector('.otro-txt'));
        applyFocusBlur(row.querySelector('.otro-urg'));
        container.querySelector('#otro-rapido-list').appendChild(row);
        _rapIdx++;
    }

    container.querySelector('#btn-add-otro-rap').addEventListener('click', () => addOtroRap());
    container.querySelector('#btn-back').addEventListener('click', () => navigate('selector'));

    // ── Enviar ─────────────────────────────────────────────────────────────────
    container.querySelector('#btn-enviar-rap').addEventListener('click', async () => {
        const btn = container.querySelector('#btn-enviar-rap');
        const items = [];
        const seenTexts = new Set();

        // Catálogo
        container.querySelectorAll('.cat-chk:checked').forEach(cb => {
            const urg = container.querySelector('[data-urg="' + cb.dataset.item + '"]')?.value || 'Normal';
            items.push({ item: cb.dataset.item, urgencia: urg });
        });

        // Otros
        container.querySelectorAll('#otro-rapido-list .otro-row').forEach(row => {
            const txt = row.querySelector('.otro-txt')?.value.trim();
            const urg = row.querySelector('.otro-urg')?.value || 'Normal';
            if (!txt) return;
            if (seenTexts.has(txt.toLowerCase())) {
                toast('"' + txt + '" está duplicado — se ignora', 'warning', 3000);
                return;
            }
            seenTexts.add(txt.toLowerCase());
            items.push({ item: 'Otro', item_otro: txt, urgencia: urg });
        });

        if (!items.length) { toast('Selecciona al menos un consumible', 'error'); return; }

        btn.disabled = true; btn.textContent = '⏳ Guardando…';
        try {
            await api.registrarConsumo({
                parte_id: 'RAPIDO-' + casa, // distinguible en Sheets
                session_id: '',
                casa,
                items,
                fuente: 'alta_rapida',
            });

            // Propuestas para cada Otro
            const otros = items.filter(i => i.item === 'Otro');
            if (otros.length) {
                const propErrors = [];
                await Promise.all(otros.map(async ({ item_otro, urgencia }) => {
                    try {
                        await api.crearPropuesta({ propuesta_texto: item_otro, casa, tipo_limpieza: 'rapido', urgencia });
                    } catch (propErr) {
                        console.error('[cons-rapidos] crearPropuesta:', propErr);
                        propErrors.push(item_otro);
                    }
                }));
                if (propErrors.length) {
                    toast('Guardado, pero la propuesta de "' + propErrors.join(', ') + '" no se pudo guardar.', 'warning', 6000);
                }
            }

            toast('✅ Faltas guardadas', 'success');
            navigate('selector');
        } catch (err) {
            console.error('[cons-rapidos] enviar:', err);
            toast('Error al guardar: ' + err.message, 'error', 6000);
            btn.disabled = false; btn.textContent = '🛒 Añadir a la lista de compra';
        }
    });
}
