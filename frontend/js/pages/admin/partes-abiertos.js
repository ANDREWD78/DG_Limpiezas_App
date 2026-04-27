// ─── Admin: Partes sin cerrar — UI completa con modales — FASE 4 ─────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { CASA_ICON } from '../../utils/casas.js';
import { formatDateTimeMadrid, toDatetimeLocalMadrid } from '../../utils/time.js';

const TIPO_LABEL = {
  cambio: 'Cambio', revision: 'Revisión', profunda: 'Profunda',
  CAMBIO: 'Cambio', REVISION: 'Revisión', PROFUNDA: 'Profunda'
};


// Badge de estado según status del parte
function statusBadge(status) {
  if (status === 'PAUSADO') {
    return `<span class="badge" style="background:rgba(245,158,11,.18);color:#f59e0b;font-size:.7rem;">⏸ PAUSADO</span>`;
  }
  return `<span class="badge" style="background:rgba(239,68,68,.15);color:#f87171;font-size:.7rem;">🔴 ABIERTO</span>`;
}

function toDatetimeLocal(iso) { return toDatetimeLocalMadrid(iso); }
function toISO(dlt) { return dlt ? new Date(dlt).toISOString() : ''; }
function durStr(inicio, fin) {
  const ms = (fin ? new Date(fin) : new Date()) - new Date(inicio);
  const m = Math.max(0, Math.round(ms / 60000));
  return m < 60 ? `${m}m` : `${Math.floor(m / 60)}h ${m % 60}m`;
}
function durPreview(isoA, isoB) {
  if (!isoA || !isoB) return '—';
  const m = Math.round((new Date(isoB) - new Date(isoA)) / 60000);
  if (m < 0) return '⚠️ fin < inicio';
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

// ── Modal genérico ───────────────────────────────────────────────────────────
function modal(html) {
  const wrap = document.createElement('div');
  wrap.style.cssText = `position:fixed;inset:0;z-index:1000;display:flex;align-items:flex-end;
    justify-content:center;background:rgba(0,0,0,.7);padding:0 0 0 0;`;
  wrap.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:20px 20px 0 0;padding:24px 20px 40px;
                width:100%;max-width:520px;border-top:1px solid var(--border);">
      ${html}
    </div>`;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', e => { if (e.target === wrap) wrap.remove(); });
  return wrap;
}

// ── Componente principal ─────────────────────────────────────────────────────
export async function renderPartesAbiertos(el) {
  const container = el || document.getElementById('page-container');
  container.innerHTML = `<div class="loading-spinner" style="margin:80px auto;display:block;"></div>`;

  let partes = [];
  try { partes = await api.partesAbiertos(); }
  catch (err) {
    container.innerHTML = `<p class="text-muted" style="text-align:center;padding:40px;">Error: ${err.message}</p>`;
    return;
  }

  function render() {
    container.innerHTML = `
      <div class="page" style="padding-top:8px;padding-bottom:40px;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;gap:8px;">
          <h2 style="font-size:.95rem;font-weight:800;color:var(--warning);">
            ▶️ Partes sin cerrar (${partes.length})
            ${partes.some(p => p.status === 'PAUSADO') ? `<span style="font-size:.75rem;font-weight:600;color:#f59e0b;margin-left:6px;">· ${partes.filter(p => p.status === 'PAUSADO').length} en pausa</span>` : ''}
          </h2>
          <div style="display:flex;gap:8px;">
            <button class="btn btn-primary btn-sm" id="btn-crear-manual" style="width:auto;font-size:0.75rem;padding:6px 10px;">+ Crear parte manual</button>
            <button class="btn btn-secondary btn-sm" id="btn-refresh" style="width:auto;">🔄</button>
          </div>
        </div>

        ${partes.length === 0 ? `
          <div class="empty-state"><div class="icon">✅</div><p>Ningún parte abierto</p></div>
        ` : partes.map((p, idx) => `
          <div class="card" style="border-color:rgba(245,158,11,.4);margin-bottom:16px;" id="card-${p.id}">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:10px;">
              <div>
                <span style="font-size:1.1rem;">${CASA_ICON[p.casa] || '🏠'}</span>
                <strong style="margin-left:6px;">${p.casa}</strong>
                <span class="badge badge-pending" style="margin-left:6px;font-size:.68rem;">
                  ${TIPO_LABEL[p.tipo_limpieza] || p.tipo_limpieza || ''}
                </span>
              </div>
              ${statusBadge(p.status)}
            </div>
            <div class="resumen-stat">
              <span class="label">👤 Empleada</span>
              <strong>${p.usuario_nombre || '—'}</strong>
            </div>
            <div class="resumen-stat">
              <span class="label">🕐 Inicio</span>
              <span>${formatDateTimeMadrid(p.inicio_ts)}</span>
            </div>
            <div class="resumen-stat" style="margin-bottom:14px;">
              <span class="label">⏱ En curso</span>
              <strong style="color:var(--warning);">${durStr(p.inicio_ts, null)}</strong>
            </div>
            <div style="display:flex;gap:8px;">
              <button class="btn btn-secondary btn-sm btn-edit" data-idx="${idx}"
                      style="flex:1;">✏️ Editar horas</button>
              <button class="btn btn-danger btn-sm btn-force" data-idx="${idx}"
                      style="flex:1;">🔴 Cerrar forzado</button>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    // Refresh
    container.querySelector('#btn-refresh')?.addEventListener('click', async () => {
      container.innerHTML = `<div class="loading-spinner" style="margin:80px auto;display:block;"></div>`;
      try {
        partes = await api.partesAbiertos();
        render();
        if (window.setAdminNavBadge) window.setAdminNavBadge('abiertos', partes.length);
      }
      catch (e) { toast('Error al cargar', 'error'); }
    });

    // ── Editar horas ─────────────────────────────────────────────────────────
    container.querySelectorAll('.btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = partes[parseInt(btn.dataset.idx)];
        const fieldStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08); outline:none; width:100%; display:block; box-sizing:border-box; -webkit-appearance:none; appearance:none; font-size:.85rem; height:56px; min-height:56px; transition:border-color .2s, box-shadow .2s;`;

        const m = modal(`
          <h3 style="font-weight:800;color:var(--primary);margin-bottom:16px;">
            ✏️ Editar horas — ${p.casa}
          </h3>
          <form id="formEditarHoras" style="margin:0;display:flex;flex-direction:column;">

            <div class="card" style="margin-bottom:20px;border-color:rgba(99,102,241,.25);">
              <div class="resumen-stat"><span class="label">Empleada:</span>
                <strong>${p.usuario_nombre}</strong></div>
              <div class="resumen-stat"><span class="label">Casa:</span>
                <strong>${p.casa}</strong></div>
              <div class="resumen-stat"><span class="label">En curso:</span>
                <strong style="color:var(--warning);">${durStr(p.inicio_ts, null)}</strong></div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:600; margin-bottom:6px;">🕐 Hora inicio</label>
              <input type="datetime-local" id="m-inicio" required
                     value="${toDatetimeLocal(p.inicio_ts)}"
                     class="form-input" style="${fieldStyle}"/>
            </div>

            <div class="form-group" style="margin-bottom:20px;">
              <label class="form-label" style="font-weight:600; margin-bottom:6px;">
                🕑 Hora fin <span class="text-muted" style="font-weight:400;">(vacío = mantener abierto)</span>
              </label>
              <input type="datetime-local" id="m-fin"
                     value="${toDatetimeLocal(p.fin_ts)}"
                     class="form-input" style="${fieldStyle}"/>
            </div>

            <div class="form-group" style="margin-bottom:16px; background:rgba(99,102,241,.1); border-radius:8px; padding:12px;">
              <label class="form-label" style="margin-bottom:4px; font-weight:600;">⏱ Duración resultante</label>
              <div id="m-dur" style="font-size:1.2rem;font-weight:800;color:var(--primary);">
                ${durStr(p.inicio_ts, null)}
              </div>
            </div>

            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label" style="font-weight:600; margin-bottom:6px;">
                📝 Motivo del cambio <span style="color:var(--danger);">*</span>
              </label>
              <textarea id="m-motivo" required
                        placeholder="Ej: Error de marcaje"
                        class="form-input"
                        style="${fieldStyle} min-height:96px; resize:none;"></textarea>
            </div>

            <div style="display:flex;gap:12px;margin-top:10px;">
              <button type="button" class="btn btn-secondary" id="m-cancel" style="flex:1;">Cancelar</button>
              <button type="submit" class="btn btn-primary" id="m-save" style="flex:1.5;">💾 Guardar cambios</button>
            </div>
          </form>
        `);

        // ── Focus / Blur ──────────────────────────────────────────────────
        const focusShadow = '0 0 0 2px rgba(99,102,241,.35), inset 0 1px 0 rgba(255,255,255,.03)';
        const blurShadow  = 'inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08)';

        ['#m-inicio', '#m-fin', '#m-motivo'].forEach(sel => {
          const f = m.querySelector(sel);
          if (!f) return;
          f.addEventListener('focus', () => {
            f.style.borderColor = 'rgba(99,102,241,.8)';
            f.style.boxShadow = focusShadow;
          });
          f.addEventListener('blur', () => {
            f.style.borderColor = 'rgba(148,163,184,.35)';
            f.style.boxShadow = blurShadow;
          });
        });

        // ── Preview duración ──────────────────────────────────────────────
        function updatePreview() {
          const a = m.querySelector('#m-inicio').value;
          const b = m.querySelector('#m-fin').value;
          m.querySelector('#m-dur').textContent = durPreview(toISO(a), toISO(b));
        }
        m.querySelector('#m-inicio').addEventListener('input', updatePreview);
        m.querySelector('#m-fin').addEventListener('input', updatePreview);
        updatePreview();

        m.querySelector('#m-cancel').addEventListener('click', () => m.remove());
        m.querySelector('#formEditarHoras').addEventListener('submit', async (e) => {
          e.preventDefault();
          const inicio = m.querySelector('#m-inicio').value;
          const fin    = m.querySelector('#m-fin').value;
          const motivo = m.querySelector('#m-motivo').value.trim();

          if (!inicio) { toast('Hora de inicio requerida', 'error'); return; }
          if (!motivo) { toast('El motivo es obligatorio', 'error'); return; }
          if (fin && new Date(fin) <= new Date(inicio)) {
            toast('La hora fin debe ser posterior a la de inicio', 'error'); return;
          }
          if (fin && new Date(fin) > new Date()) {
            toast('La hora fin no puede ser en el futuro', 'error'); return;
          }

          const savBtn = m.querySelector('#m-save');
          savBtn.disabled = true; savBtn.textContent = '⏳ Guardando…';
          try {
            await api.editTimestamps(p.id, {
              inicio_ts: toISO(inicio),
              ...(fin ? { fin_ts: toISO(fin) } : {}),
              motivo,
            });
            toast('✅ Horas actualizadas', 'success');
            m.remove();
            partes = await api.partesAbiertos();
            render();
            if (window.setAdminNavBadge) window.setAdminNavBadge('abiertos', partes.length);
          } catch (e) {
            toast('Error: ' + e.message, 'error');
            savBtn.disabled = false; savBtn.textContent = '💾 Guardar cambios';
          }
        });
      });
    });

    // ── Cierre forzado ───────────────────────────────────────────────────────
    container.querySelectorAll('.btn-force').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = partes[parseInt(btn.dataset.idx)];
        const fieldStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08); outline:none; width:100%; display:block; box-sizing:border-box; -webkit-appearance:none; appearance:none; font-size:.85rem; transition:border-color .2s, box-shadow .2s;`;

        const m = modal(`
          <h3 style="font-weight:800;color:var(--danger);margin-bottom:16px;">
            🔴 Cerrar parte forzosamente
          </h3>
          <form id="formCerrarParte" style="margin:0;display:flex;flex-direction:column;">
            <div class="card" style="margin-bottom:20px;border-color:rgba(239,68,68,.25);">
              <div class="resumen-stat"><span class="label">Empleada:</span>
                <strong>${p.usuario_nombre}</strong></div>
              <div class="resumen-stat"><span class="label">Casa:</span>
                <strong>${p.casa}</strong></div>
              <div class="resumen-stat"><span class="label">En curso:</span>
                <strong style="color:var(--warning);">${durStr(p.inicio_ts, null)}</strong></div>
            </div>

            <div class="form-group" style="margin-bottom:16px;">
              <label class="form-label" style="font-weight:600; margin-bottom:6px;">Inicio</label>
              <input type="datetime-local" id="c-inicio" value="${toDatetimeLocal(p.inicio_ts)}" required class="form-input" style="${fieldStyle}"/>
            </div>

            <div class="form-group" style="margin-bottom:20px;">
              <label class="form-label" style="font-weight:600; margin-bottom:6px;">Fin</label>
              <input type="datetime-local" id="c-fin" value="${toDatetimeLocal(new Date().toISOString())}" required class="form-input" style="${fieldStyle}"/>
            </div>

            <div class="form-group" style="margin-bottom:16px; background:rgba(239,68,68,.1); border-radius:8px; padding:12px;">
              <label class="form-label" style="margin-bottom:4px; font-weight:600;">⏱ Duración resultante</label>
              <div id="c-dur" style="font-size:1.2rem;font-weight:800;color:var(--danger);">
                ${durStr(p.inicio_ts, null)}
              </div>
            </div>

            <div class="form-group" style="margin-bottom:24px;">
              <label class="form-label" style="font-weight:600; margin-bottom:6px;">📝 Motivo de cierre forzoso <span style="color:var(--danger);">*</span></label>
              <textarea id="c-motivo" required class="form-input"
                        placeholder="Ej: Se olvidó cerrar el parte" style="${fieldStyle} min-height:96px; resize:none;"></textarea>
            </div>

            <div style="display:flex;gap:12px;margin-top:10px;">
              <button type="button" class="btn btn-secondary" id="c-cancel" style="flex:1;">Cancelar</button>
              <button type="submit" class="btn btn-danger" id="c-confirm" style="flex:1.5;">🔴 Confirmar cierre</button>
            </div>
          </form>
        `);

        // FOCUS / BLUR
        const fieldStyleFocus = '0 0 0 2px rgba(239,68,68,.28), inset 0 1px 0 rgba(255,255,255,.03)';
        const fieldStyleBlur = 'inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08)';

        ['#c-inicio', '#c-fin', '#c-motivo'].forEach(sel => {
          const f = m.querySelector(sel);
          if (!f) return;
          f.addEventListener('focus', () => {
            f.style.borderColor = 'rgba(239,68,68,.8)';
            f.style.boxShadow = fieldStyleFocus;
          });
          f.addEventListener('blur', () => {
            f.style.borderColor = 'rgba(148,163,184,.35)';
            f.style.boxShadow = fieldStyleBlur;
          });
        });

        // PREVIEW
        function updatePreview() {
          const a = m.querySelector('#c-inicio').value;
          const b = m.querySelector('#c-fin').value;
          m.querySelector('#c-dur').textContent = durPreview(toISO(a), toISO(b));
        }
        m.querySelector('#c-inicio').addEventListener('input', updatePreview);
        m.querySelector('#c-fin').addEventListener('input', updatePreview);
        updatePreview();

        m.querySelector('#c-cancel').addEventListener('click', () => m.remove());
        m.querySelector('#formCerrarParte').addEventListener('submit', async (e) => {
          e.preventDefault();
          const finVal = m.querySelector('#c-fin').value;
          const inicioVal = m.querySelector('#c-inicio').value;
          const motivo = m.querySelector('#c-motivo').value.trim();

          if (!inicioVal) { toast('Hora de inicio requerida', 'error'); return; }
          if (!motivo) { toast('El motivo de cierre forzoso es obligatorio', 'error'); return; }

          if (finVal && new Date(finVal) <= new Date(inicioVal)) {
            toast('La hora de finalización debe ser posterior a la de inicio', 'error');
            return;
          }
          if (finVal && new Date(finVal) > new Date()) {
            toast('La hora de finalización no puede establecerse en el futuro', 'error');
            return;
          }

          const cfm = m.querySelector('#c-confirm');
          cfm.disabled = true; cfm.textContent = '⏳ Cerrando…';
          try {
            await api.forceClose(p.id, {
              fin_ts: finVal ? toISO(finVal) : undefined,
              inicio_ts: inicioVal ? toISO(inicioVal) : undefined,
              motivo,
            });
            toast('✅ Parte cerrado forzosamente', 'success');
            m.remove();
            partes = await api.partesAbiertos();
            render();
            if (window.setAdminNavBadge) window.setAdminNavBadge('abiertos', partes.length);
          } catch (e) {
            toast('Error: ' + e.message, 'error');
            cfm.disabled = false; cfm.textContent = '🔴 Confirmar cierre';
          }
        });
      });
    });

    // ── Crear parte manual ───────────────────────────────────────────────────
    container.querySelector('#btn-crear-manual')?.addEventListener('click', async () => {
      const fieldStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08); outline:none; width:100%; display:block; box-sizing:border-box; -webkit-appearance:none; appearance:none; font-size:.85rem; height:56px; min-height:56px; transition:border-color .2s, box-shadow .2s;`;
      const areaStyle  = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08); outline:none; width:100%; display:block; box-sizing:border-box; font-size:.85rem; min-height:80px; resize:none; transition:border-color .2s, box-shadow .2s;`;

      const modalWrap = modal(`
        <h3 style="font-weight:800;color:var(--primary);margin-bottom:16px;">➕ Crear parte manual</h3>

        <div id="m-manual-loading" style="text-align:center;padding:20px;color:var(--text-muted);font-size:0.9rem;">
          Cargando configuración...
        </div>

        <form id="form-manual" style="display:none;flex-direction:column;max-height:70vh;overflow-y:auto;padding-right:4px;">

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;margin-bottom:6px;">
              👤 Trabajador/a <span style="color:var(--danger);">*</span>
            </label>
            <select name="user_id" required class="form-input" style="${fieldStyle}">
              <option value="">— Selecciona —</option>
            </select>
          </div>

          <div style="display:flex;gap:10px;margin-bottom:14px;">
            <div class="form-group" style="flex:1;margin-bottom:0;">
              <label class="form-label" style="font-weight:600;margin-bottom:6px;">
                🏠 Casa <span style="color:var(--danger);">*</span>
              </label>
              <select name="casa" required class="form-input" style="${fieldStyle}">
                <option value="MIRADOR">MIRADOR</option>
                <option value="CASON">CASON</option>
                <option value="GRATAL">GRATAL</option>
              </select>
            </div>
            <div class="form-group" style="flex:1;margin-bottom:0;">
              <label class="form-label" style="font-weight:600;margin-bottom:6px;">
                🧹 Tipo <span style="color:var(--danger);">*</span>
              </label>
              <select name="tipo_limpieza" required class="form-input" style="${fieldStyle}">
                <option value="Cambio de huéspedes">Cambio de huéspedes</option>
                <option value="Revisión rápida">Revisión rápida</option>
              </select>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;margin-bottom:6px;">
              📅 Fecha <span style="color:var(--danger);">*</span>
            </label>
            <input type="date" name="fecha" required class="form-input" style="${fieldStyle}"/>
          </div>

          <div style="display:flex;gap:10px;margin-bottom:8px;">
            <div class="form-group" style="flex:1;margin-bottom:0;">
              <label class="form-label" style="font-weight:600;margin-bottom:6px;">
                🕐 Inicio <span style="color:var(--danger);">*</span>
              </label>
              <input type="time" name="hora_inicio" required class="form-input" style="${fieldStyle}"/>
            </div>
            <div class="form-group" style="flex:1;margin-bottom:0;">
              <label class="form-label" style="font-weight:600;margin-bottom:6px;">
                🕑 Fin <span style="color:var(--danger);">*</span>
              </label>
              <input type="time" name="hora_fin" required class="form-input" style="${fieldStyle}"/>
            </div>
          </div>

          <div class="form-group" style="margin-bottom:14px; background:rgba(99,102,241,.1); border-radius:8px; padding:12px;">
            <label class="form-label" style="margin-bottom:4px;font-weight:600;">⏱ Duración resultante</label>
            <div id="m-manual-dur" style="font-size:1.2rem;font-weight:800;color:var(--primary);">— min</div>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;margin-bottom:6px;">
              📝 Motivo alta manual <span style="color:var(--danger);">*</span>
            </label>
            <textarea name="motivo_manual" required class="form-input"
                      placeholder="Ej: Olvido de fichaje"
                      style="${areaStyle}"></textarea>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;margin-bottom:6px;">
              ✅ ¿Casa lista? <span style="color:var(--danger);">*</span>
            </label>
            <select name="casa_lista" required class="form-input" style="${fieldStyle}">
              <option value="Sí">Sí, todo perfecto</option>
              <option value="No">No, falta algo</option>
            </select>
          </div>

          <div class="form-group" style="margin-bottom:14px;">
            <label class="form-label" style="font-weight:600;margin-bottom:6px;">📋 Tareas realizadas</label>
            <textarea name="tareas_realizadas" class="form-input" style="${areaStyle}"></textarea>
          </div>

          <div class="form-group" style="margin-bottom:20px;">
            <label class="form-label" style="font-weight:600;margin-bottom:6px;">💬 Observaciones adicionales</label>
            <textarea name="observaciones" class="form-input" style="${areaStyle}"></textarea>
          </div>

          <div style="display:flex;gap:12px;padding-bottom:10px;">
            <button type="button" class="btn btn-secondary" id="m-manual-cancel" style="flex:1;">Cancelar</button>
            <button type="submit" class="btn btn-primary" id="m-manual-save" style="flex:1.5;">💾 Crear parte manual</button>
          </div>
        </form>
      `);

      const form = modalWrap.querySelector('#form-manual');
      const load = modalWrap.querySelector('#m-manual-loading');

      modalWrap.querySelector('#m-manual-cancel').onclick = () => modalWrap.remove();

      // ── Focus / Blur ──────────────────────────────────────────────────────
      const focusShadow = '0 0 0 2px rgba(99,102,241,.35), inset 0 1px 0 rgba(255,255,255,.03)';
      const blurShadow  = 'inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08)';

      function applyFocusBlur(el) {
        if (!el) return;
        el.addEventListener('focus', () => {
          el.style.borderColor = 'rgba(99,102,241,.8)';
          el.style.boxShadow = focusShadow;
        });
        el.addEventListener('blur', () => {
          el.style.borderColor = 'rgba(148,163,184,.35)';
          el.style.boxShadow = blurShadow;
        });
      }

      try {
        const users = await api.usuarios();
        const activeUsers = users.filter(u => (u.activo || u.Activo)?.toLowerCase() !== 'no');

        const selWorker = form.querySelector('[name="user_id"]');
        activeUsers.forEach(u => {
          const opt = document.createElement('option');
          opt.value = u.user_id;
          opt.textContent = [u.nombre || u.Nombre, u.apellidos].filter(Boolean).join(' ');
          selWorker.appendChild(opt);
        });

        // Today default
        const todayStr = new Date().toISOString().split('T')[0];
        form.querySelector('[name="fecha"]').value = todayStr;

        load.style.display = 'none';
        form.style.display = 'flex';
        form.style.flexDirection = 'column';

        // Aplicar focus/blur a todos los campos interactivos
        ['[name="user_id"]','[name="casa"]','[name="tipo_limpieza"]','[name="fecha"]',
         '[name="hora_inicio"]','[name="hora_fin"]','[name="motivo_manual"]',
         '[name="casa_lista"]','[name="tareas_realizadas"]','[name="observaciones"]'
        ].forEach(sel => applyFocusBlur(form.querySelector(sel)));

        // Calc duration preview
        const updateDur = () => {
          const h1 = form.querySelector('[name="hora_inicio"]').value;
          const h2 = form.querySelector('[name="hora_fin"]').value;
          if (h1 && h2) {
            const m1 = parseInt(h1.split(':')[0]) * 60 + parseInt(h1.split(':')[1]);
            const m2 = parseInt(h2.split(':')[0]) * 60 + parseInt(h2.split(':')[1]);
            const diff = m2 - m1;
            const durE = modalWrap.querySelector('#m-manual-dur');
            if (diff <= 0) {
              durE.textContent = '⚠️ Fin ≤ Inicio';
              durE.style.color = 'var(--danger)';
            } else {
              durE.textContent = diff < 60 ? `${diff} min` : `${Math.floor(diff / 60)}h ${diff % 60}m (${diff} min)`;
              durE.style.color = 'var(--primary)';
            }
          }
        };
        form.querySelector('[name="hora_inicio"]').oninput = updateDur;
        form.querySelector('[name="hora_fin"]').oninput = updateDur;
        updateDur();

        // Submit
        form.onsubmit = async (e) => {
          e.preventDefault();
          const fd = new FormData(form);
          const data = Object.fromEntries(fd.entries());

          if (data.hora_fin <= data.hora_inicio) {
            toast('La hora de fin debe ser posterior a la de inicio', 'error');
            return;
          }

          const btn = form.querySelector('#m-manual-save');
          btn.disabled = true; btn.textContent = '⏳ Creando…';

          try {
            await api.adminCrearParteManual(data);
            toast('✅ Parte manual creado con éxito', 'success');
            modalWrap.remove();
            partes = await api.partesAbiertos();
            render();
          } catch (err) {
            toast('Error: ' + err.message, 'error');
            btn.disabled = false; btn.textContent = '💾 Crear parte manual';
          }
        };

      } catch (err) {
        load.textContent = 'Error al cargar usuarias: ' + err.message;
      }
    });
  } // fin render()

  render();
}
