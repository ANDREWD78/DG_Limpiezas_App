// ─── Shared Utilities para Reservas (Admin & Trabajadoras) ───────────────────

import { CASA_ICON } from './casas.js';

/**
 * Formatea fecha ISO (YYYY-MM-DD) a "Vie 20/03/2026 11:00"
 */
export function formatFechaCompleta(fecha, hora = '') {
  if (!fecha) return '-';
  const dias = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
  const [y, m, d] = fecha.split('-').map(Number);
  const dateObj = new Date(y, m - 1, d);
  const abrev = dias[dateObj.getDay()];
  const fStr = `${abrev} ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${y}`;
  const hStr = hora ? ` ${hora.slice(0, 5)}` : '';
  return fStr + hStr;
}

/**
 * Renderiza el bloque de una reserva con criterio de visibilidad (Trabajadora vs Admin)
 */
export function renderReservaHTML(r, dateContext = null, isAdmin = true) {
  const isCheckin = dateContext && r.fecha_entrada === dateContext;
  const isCheckout = dateContext && r.fecha_salida === dateContext;
  
  let estadoStr = 'En estancia';
  let estadoColor = 'var(--text-muted)';
  if (isCheckin && isCheckout) { estadoStr = 'Entra y Sale'; estadoColor = 'var(--warning)'; }
  else if (isCheckin) { estadoStr = 'Entrada'; estadoColor = 'var(--info)'; }
  else if (isCheckout) { estadoStr = 'Salida'; estadoColor = 'var(--danger)'; }

  const fEntrada = formatFechaCompleta(r.fecha_entrada, r.hora_entrada);
  const fSalida = formatFechaCompleta(r.fecha_salida, r.hora_salida);

  const tagCuna = r.cuna === 'Sí' ? `<span class="badge badge-warning">Cuna (${r.num_cunas || 1})</span>` : '';
  const tagLate = r.late_checkout === 'Sí' ? `<span class="badge badge-info">Late check out (${r.late_checkout_hora || 'Sí'})</span>` : '';

  let html = `
    <div class="reserva-card-wrapper" style="border:1px solid var(--border);border-radius:8px;padding:12px;" data-res-id="${r.reserva_id}">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:8px;">
        <h4 style="margin:0;font-size:1rem;">${CASA_ICON[r.casa] || '🏠'} ${r.casa} ${isAdmin ? `<span style="font-size:0.8rem;color:var(--text-muted);font-weight:normal;">#${r.external_id || r.reserva_id}</span>` : ''}</h4>
        ${isAdmin ? `<span style="font-size:0.8rem;font-weight:600;color:${estadoColor}">${estadoStr}</span>` : ''}
      </div>`;

  if (isAdmin) {
    html += `<p style="margin:0 0 4px 0;font-size:0.9rem;"><strong>${r.viajero_nombre || 'Desconocido'}</strong> · ${r.huespedes} pax</p>`;
  } else {
    html += `<p style="margin:0 0 4px 0;font-size:0.9rem;">${r.huespedes} pax</p>`;
  }

  html += `
    <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:8px; display:flex; flex-direction:column; gap:2px;">
      <div><strong>Entrada:</strong> ${fEntrada}</div>
      <div><strong>Salida:</strong> ${fSalida}</div>
    </div>`;

  html += `
    <div class="tags-container" style="display:flex;gap:4px;flex-wrap:wrap;margin-bottom:8px;">
      ${tagCuna}${tagLate}
      ${(isAdmin && r.canal) ? `<span class="badge" style="background:var(--bg);color:var(--text-muted);">${r.canal}</span>` : ''}
    </div>`;

  // Datos Económicos (Solo Admin y Reservas Reales)
  if (isAdmin && r.origen !== 'MANUAL_BLOCK' && r.estado_reserva !== 'BLOCKED') {
    const total = Number(r.importe_total || 0);
    const comision = Number(r.comision_total || 0);
    const neto = Number(r.importe_neto || 0);

    if (total > 0) {
      const f = (n) => (n || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      html += `
        <div style="margin-bottom:12px; font-size:0.8rem; color:var(--text-muted); padding:6px 0; border-top:1px dashed var(--border); border-bottom:1px dashed var(--border);">
          <span>Total: <strong>${f(total)} €</strong></span> · 
          <span>Comisión: ${f(comision)} €</span> · 
          <span style="color:var(--text); font-weight:700;">Neto: <span style="font-size:0.9rem; color:var(--primary);">${f(neto)} €</span></span>
        </div>`;
    }
  }

  // Notas
  if (r.nota_equipo || (isAdmin && r.nota_interna)) {
    html += `<div class="notas-container" style="background:var(--bg-surface);padding:10px;border-radius:8px;font-size:0.85rem;color:var(--text);border:1px solid var(--border);margin-top:4px;">`;
    if (isAdmin && r.nota_interna) {
      html += `<div style="margin-bottom:2px;"><strong>Nota Int:</strong> ${r.nota_interna}</div>`;
    }
    if (r.nota_equipo) {
      html += `<div><strong>Nota Eq:</strong> ${r.nota_equipo}</div>`;
    }
    html += `</div>`;
  }

  if (isAdmin) {
    html += `
      <div style="margin-top:12px;border-top:1px dashed var(--border);padding-top:8px;">
        <button class="btn btn-sm btn-secondary btn-toggle-override" style="font-size:0.75rem; padding:4px 10px; width:auto;">✏️ Editar Overrides</button>
        
        <div class="override-form hidden" style="margin-top:12px;background:var(--bg);padding:12px;border-radius:8px;border:1px solid var(--border);">
          <form class="frm-override">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px;">Cuna</label>
                <select name="cuna" class="input-cuna" style="width:100%;padding:6px;border-radius:6px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);">
                  <option value="No" ${r.cuna !== 'Sí' ? 'selected' : ''}>No</option>
                  <option value="Sí" ${r.cuna === 'Sí' ? 'selected' : ''}>Sí</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px;">Nº Cunas</label>
                <input type="number" name="num_cunas" class="input-num-cunas" min="0" max="3" value="${r.num_cunas || 0}" ${r.cuna !== 'Sí' ? 'disabled' : ''} style="width:100%;padding:6px;border-radius:6px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);">
              </div>
            </div>
            
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:12px;">
              <div>
                <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px;">Late check out</label>
                <select name="late_checkout" class="input-late" style="width:100%;padding:6px;border-radius:6px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);">
                  <option value="No" ${r.late_checkout !== 'Sí' ? 'selected' : ''}>No</option>
                  <option value="Sí" ${r.late_checkout === 'Sí' ? 'selected' : ''}>Sí</option>
                </select>
              </div>
              <div>
                <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px;">Hora Late check out</label>
                <input type="time" name="late_checkout_hora" class="input-late-hora" value="${r.late_checkout_hora || ''}" ${r.late_checkout !== 'Sí' ? 'disabled' : ''} style="width:100%;padding:6px;border-radius:6px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);">
              </div>
            </div>
            
            <div style="margin-bottom:12px;">
              <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px;">Nota Interna (Admin)</label>
              <textarea name="nota_interna" rows="2" style="width:100%;padding:6px;border-radius:6px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);resize:vertical;">${r.nota_interna || ''}</textarea>
            </div>
            
            <div style="margin-bottom:12px;">
              <label style="font-size:0.75rem;color:var(--text-muted);display:block;margin-bottom:4px;">Nota Equipo (Visible limpiezas)</label>
              <textarea name="nota_equipo" rows="2" style="width:100%;padding:6px;border-radius:6px;background:var(--bg-card);color:var(--text);border:1px solid var(--border);resize:vertical;">${r.nota_equipo || ''}</textarea>
            </div>
            
            <button type="submit" class="btn btn-primary btn-sm w-full btn-save-override">💾 Guardar Overrides</button>
          </form>
        </div>
      </div>`;
  }

  html += `</div>`;
  return html;
}
