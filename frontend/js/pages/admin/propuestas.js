// ─── Admin: Propuestas de Consumibles ─────────────────────────────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { CASA_ICON } from '../../utils/casas.js';

export async function renderPropuestas(container) {
    container.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;"><div class="loading-spinner"></div></div>';

    let pendientes = [];
    try {
        pendientes = await api.propuestas({ estado: 'PENDIENTE' });
    } catch (e) {
        container.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Error cargando propuestas: ${e.message}</p></div>`;
        return;
    }

    const fieldStyle = 'background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:10px; padding:10px 12px; color:#f8fafc; outline:none; box-sizing:border-box; width:100%; font-size:.85rem; margin-bottom:12px; display:block; transition:border-color .2s, box-shadow .2s;';
    const focusShadow = '0 0 0 2px rgba(99,102,241,.35), inset 0 1px 0 rgba(255,255,255,.03)';

    const applyFocusBlur = (el) => {
        el.addEventListener('focus', () => { el.style.borderColor = 'rgba(99,102,241,.8)'; el.style.boxShadow = focusShadow; });
        el.addEventListener('blur', () => { el.style.borderColor = 'rgba(148,163,184,.35)'; el.style.boxShadow = 'none'; });
    };

    const render = () => {
        if (!pendientes.length) {
            container.innerHTML = `
                <div class="section-header"><h2>💡 Propuestas pendientes (0)</h2></div>
                <div class="empty-state"><div class="icon">✅</div><p>No hay propuestas pendientes por revisar.</p></div>`;
            return;
        }

        container.innerHTML = `
            <div class="section-header" style="margin-bottom:16px;">
                <h2>💡 Propuestas pendientes (${pendientes.length})</h2>
            </div>
            
            <div class="data-list" style="padding-bottom:100px;">
                ${pendientes.map(p => `
                    <div class="card prop-form" data-id="${p.prop_id}" style="border-color:rgba(148,163,184,.15); margin-bottom:16px; padding:16px;">
                        
                        <div style="display:flex;justify-content:space-between;margin-bottom:8px;">
                            <strong>${CASA_ICON[p.casa] || '🏠'} ${p.casa || 'Desconocida'}</strong>
                            <span class="badge ${p.urgencia === 'Urgente' ? 'badge-urgente' : 'badge-normal'}">${p.urgencia || 'Normal'}</span>
                        </div>
                        
                        <p style="font-size:0.82rem; color:var(--text-muted); margin-bottom:12px;">
                            Propuesto por <strong style="color:var(--text);">${p.usuario_nombre}</strong> el ${p.fecha}
                        </p>
                        
                        <div style="background:var(--bg-body); padding:10px; border-radius:8px; margin-bottom:16px;">
                            <label style="font-size:0.75rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:2px;">Texto Solicitado:</label>
                            <div style="font-size:1.05rem; font-weight:700; color:var(--primary);">${p.propuesta_texto}</div>
                        </div>

                        <label style="font-size:0.78rem; font-weight:600; margin-bottom:6px; display:block;">Nombre final para catálogo</label>
                        <input type="text" class="prop-name" value="${p.propuesta_texto}" style="${fieldStyle}" placeholder="Editar antes de aceptar">
                        
                        <label style="font-size:0.78rem; font-weight:600; margin-bottom:6px; display:block;">Observaciones (Opcional)</label>
                        <textarea class="prop-obs" style="${fieldStyle} min-height:64px; resize:none;" placeholder="Ej: Ya se compró / No procede / Añadido..."></textarea>
                        
                        <div style="display:flex; gap:10px; margin-top:8px;">
                            <button class="btn btn-secondary btn-rechazar" style="flex:1;">❌ Rechazar</button>
                            <button class="btn btn-primary btn-aprobar" style="flex:1.5;">✅ Aprobar y Catalogar</button>
                        </div>
                    </div>
                `).join('')}
            </div>
        `;

        // ── Listeners Operativos ──
        container.querySelectorAll('.prop-form').forEach(form => {
            const id = form.dataset.id;
            const btnApr = form.querySelector('.btn-aprobar');
            const btnRech = form.querySelector('.btn-rechazar');
            const inName = form.querySelector('.prop-name');
            const inObs = form.querySelector('.prop-obs');

            applyFocusBlur(inName);
            applyFocusBlur(inObs);

            btnApr.addEventListener('click', async () => {
                btnApr.disabled = true; btnRech.disabled = true; btnApr.textContent = '⏳...';
                try {
                    const res = await api.aprobarPropuesta(id, { 
                        nombre_final: inName.value.trim(), 
                        observaciones: inObs.value.trim() 
                    });
                    toast(res.ya_existia ? 'Aprobada (Ya estaba en catálogo)' : '✅ Aprobada y añadida al catálogo', 'success');
                    pendientes = pendientes.filter(x => x.prop_id !== id);
                    render();
                } catch (e) {
                    toast('Error aprobando: ' + e.message, 'error');
                    btnApr.disabled = false; btnRech.disabled = false; btnApr.textContent = '✅ Aprobar y Catalogar';
                }
            });

            btnRech.addEventListener('click', async () => {
                btnApr.disabled = true; btnRech.disabled = true; btnRech.textContent = '⏳...';
                try {
                    await api.rechazarPropuesta(id, { observaciones: inObs.value.trim() });
                    toast('❌ Propuesta rechazada', 'success');
                    pendientes = pendientes.filter(x => x.prop_id !== id);
                    render();
                } catch (e) {
                    toast('Error rechazando: ' + e.message, 'error');
                    btnApr.disabled = false; btnRech.disabled = false; btnRech.textContent = '❌ Rechazar';
                }
            });
        });
    };

    render();
}
