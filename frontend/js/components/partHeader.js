// ─── Shared Part Header — Volver + Salir + Botón global Añadir incidencia ────
import { api } from '../api.js';
import { goBack, salirSinLogout } from '../app.js';
import { toast } from './toast.js';
import { CASA_ICON } from '../utils/casas.js';
import { CATEGORIAS_INCIDENCIA, getUbicaciones, tCat, tUbi } from '../utils/incidencias.js';
import { t } from '../i18n/index.js';

// Acepta state opcional para mostrar el contador de incidencias
export function headerHTML(title, casa, state = null, showReservas = false) {
  // Limpiar título: tomar solo la parte antes del separador '·'.
  // NO aplicar regex de caracteres, para no romper cirílico ni emojis intencionales.
  let cleanTitle = title.split('·')[0].trim();
  const lower = cleanTitle.toLowerCase();
  if (lower === 'cambio' || lower === 'cambio de huéspedes') cleanTitle = t('tipo.cambio');
  else if (lower === 'revisión' || lower === 'revisión rápida') cleanTitle = t('revision.titulo_p1');
  else if (lower === 'checklist') cleanTitle = t('checklist.titulo');
  else if (lower.includes('foto')) cleanTitle = t('fotos.paso').split('—')[1]?.trim() || t('fotos.paso');
  else if (lower === 'cierre') cleanTitle = t('cierre.paso').split('—')[1]?.trim() || t('cierre.paso');
  
  // Formatear casa (De MIRADOR a Mirador)
  const cleanCasa = casa ? casa.charAt(0).toUpperCase() + casa.slice(1).toLowerCase() : '';

  const nInc = state?.parte?._incidenciasCount || 0;
  const hasParteId = !!state?.parte?.id;
  const incBtn = hasParteId
    ? `<button class="hdr-btn btn-incidencia-global" id="hdr-incidencia"
              style="color:var(--warning);font-size:.74rem;white-space:nowrap;padding:6px 8px;">
         ${t('header.incidencia')}${nInc > 0 ? ` (${nInc})` : ''}
       </button>`
    : '';

  const reservasBtn = showReservas 
    ? `<button class="hdr-btn" id="hdr-reservas" style="color:var(--info);font-size:.74rem;padding:6px 8px;">${t('header.reservas')}</button>`
    : '';

  return `
    <div style="position: sticky; top: 0; z-index: 100; background: var(--bg-surface); border-bottom: 1px solid var(--border); display: flex; flex-direction: column;">
      <!-- LÍNEA 1: Navegación Global -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 10px 16px; border-bottom: 1px solid var(--bg);">
        <div style="flex: 1;"><button class="btn-back" id="hdr-back" style="margin: 0; padding: 4px 8px;">${t('header.volver')}</button></div>
        <div style="flex: 1; display: flex; justify-content: center;">
          <img src="img/logo-dg-icono.svg" alt="DG" width="38" height="38" style="display:block;">
        </div>
        <div style="flex: 1; display: flex; justify-content: flex-end;">
          <button class="hdr-btn" id="hdr-logout" style="color: var(--text); font-weight: 600; opacity: 0.85; padding: 4px 8px;">${t('header.salir')}</button>
        </div>
      </div>
      
      <!-- LÍNEA 2: Acciones en extremos y Contexto puro al centro -->
      <div style="display: grid; grid-template-columns: 1fr minmax(0, auto) 1fr; align-items: center; padding: 10px 16px; gap: 8px;">
        <!-- Izquierda: Reservas -->
        <div style="display: flex; justify-content: flex-start; overflow: hidden;">
          ${reservasBtn}
        </div>
        
        <!-- Centro: Contexto (Fase + Casa) -->
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; min-width: 0;">
          <span style="font-size: 1.05rem; font-weight: 800; color: var(--text); line-height: 1.2; text-align: center; display: block; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%;">${cleanTitle}</span>
          <span style="font-size: 0.85rem; font-weight: 600; color: var(--text-muted); line-height: 1.2; margin-top: 2px;">${cleanCasa}</span>
        </div>
        
        <!-- Derecha: Incidencia -->
        <div style="display: flex; justify-content: flex-end; overflow: hidden;">
          ${incBtn}
        </div>
      </div>
    </div>
  `;
}

export function bindHeader(container, navigate, state) {
  container.querySelector('#hdr-back')?.addEventListener('click', () => goBack());
  container.querySelector('#hdr-logout')?.addEventListener('click', () => {
    // No hace logout real: lleva a reanudar si hay partes abiertos, o al selector
    salirSinLogout(navigate);
  });
  container.querySelector('#hdr-incidencia')?.addEventListener('click', () => {
    openModalIncidencia(state);
  });
  container.querySelector('#hdr-reservas')?.addEventListener('click', () => {
    navigate('calendario');
  });
}

// ─── Modal global de incidencia — disponible en todo el flujo ─────────────────
export function openModalIncidencia(state, onClose) {
  const parteId = state?.parte?.id || '';
  const sessionId = state?.parte?.session_id || '';
  const casa = state?.parte?.casa;
  
  if (!casa) { toast('Error: no se ha identificado la casa', 'error'); return; }

  const ubicaciones = getUbicaciones(casa);

  const fieldStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08); outline:none; width:100%; display:block; box-sizing:border-box; -webkit-appearance:none; appearance:none; font-size:.85rem; height:56px; min-height:56px; transition:border-color .2s, box-shadow .2s;`;
  const areaStyle  = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; box-shadow: inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08); outline:none; width:100%; display:block; box-sizing:border-box; font-size:.85rem; min-height:96px; resize:none; transition:border-color .2s, box-shadow .2s;`;

  const overlay = document.createElement('div');
  overlay.style.cssText = [
    'position:fixed;inset:0;z-index:500;',
    'display:flex;align-items:flex-end;justify-content:center;',
    'background:rgba(0,0,0,.6);',
  ].join('');

  overlay.innerHTML = `
    <div style="background:var(--bg-surface);border-radius:20px 20px 0 0;
                padding:24px 20px 44px;width:100%;max-width:480px;
                border-top:1px solid var(--border);max-height:90dvh;overflow-y:auto;">

      <h3 style="font-size:1rem;font-weight:800;color:var(--primary);margin:0 0 18px;">${t('inc.titulo', { casa })}</h3>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;margin-bottom:6px;">${t('inc.categoria')}</label>
        <select class="form-input" id="inc-m-cat" style="${fieldStyle}">
          <option value="">${t('inc.selecciona')}</option>
          ${CATEGORIAS_INCIDENCIA.map(c => `<option value="${c}">${tCat(c)}</option>`).join('')}
        </select>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;margin-bottom:6px;">${t('inc.ubicacion')}</label>
        <select class="form-input" id="inc-m-ubi" style="${fieldStyle}">
          <option value="">${t('inc.selecciona')}</option>
          ${ubicaciones.map(u => `<option value="${u}">${tUbi(u)}</option>`).join('')}
          <option value="Otro">${t('inc.otro')}</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;margin-bottom:6px;">${t('inc.prioridad')}</label>
        <select class="form-input" id="inc-m-prioridad" style="${fieldStyle} font-weight:600;">
          <option value="Normal">🟡 Normal</option>
          <option value="Urgente">🔴 Urgente</option>
        </select>
      </div>

      <div class="form-group" style="margin-bottom:14px;">
        <label class="form-label" style="font-weight:600;margin-bottom:6px;">${t('inc.desc')}</label>
        <textarea class="form-input" id="inc-m-desc"
          placeholder="${t('inc.desc_placeholder')}"
          style="${areaStyle}"></textarea>
      </div>

      <div class="form-group" style="margin-bottom:20px;">
        <label class="form-label" style="font-weight:600;margin-bottom:6px;">${t('inc.foto')}</label>
        <div class="foto-grid" id="inc-m-grid">
          <label class="foto-add-btn" for="inc-m-foto0">
            <span class="plus">+</span><span>${t('inc.btn_foto')}</span>
          </label>
          <input type="file" id="inc-m-foto0" accept="image/*,video/*" multiple style="display:none"/>
        </div>
      </div>

      <div style="display:flex;gap:12px;margin-top:4px;">
        <button class="btn btn-secondary" id="inc-m-cancel" style="flex:1;">${t('inc.btn_cancelar')}</button>
        <button class="btn btn-primary" id="inc-m-save" style="flex:1.5;">${t('inc.btn_guardar')}</button>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  let fotos = [];   // solo imágenes
  let video = null;  // un único vídeo (File)
  let nextFotoIdx = 1;

  function esVideo(f) { return f.type.startsWith('video/'); }

  function refreshGrid() {
    const grid = overlay.querySelector('#inc-m-grid');
    const idx = nextFotoIdx++;
    const fotosThumb = fotos.map((f, i) =>
      `<img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="${i}"/>`
    ).join('');
    const videoThumb = video
      ? `<div class="foto-thumb" style="display:flex;align-items:center;justify-content:center;background:#1e293b;font-size:1.8rem;" title="${video.name}">🎬</div>`
      : '';
    const puedeAnadirFotos = fotos.length < 5;
    const puedeAnadirVideo = !video;
    const addBtn = (puedeAnadirFotos || puedeAnadirVideo) ? `
      <label class="foto-add-btn" for="inc-m-foto${idx}">
        <span class="plus">+</span><span>${t('inc.btn_mas')}</span>
      </label>
      <input type="file" id="inc-m-foto${idx}" accept="image/*,video/*"
             ${puedeAnadirFotos ? 'multiple' : ''} style="display:none"/>
    ` : '';
    grid.innerHTML = fotosThumb + videoThumb + addBtn;
    if (puedeAnadirFotos || puedeAnadirVideo) bindFotoInput(`inc-m-foto${idx}`);
  }

  function bindFotoInput(id) {
    overlay.querySelector(`#${id}`)?.addEventListener('change', e => {
      Array.from(e.target.files).forEach(f => {
        if (esVideo(f)) {
          if (!video) video = f; // solo 1 vídeo
        } else {
          if (fotos.length < 5) fotos.push(f);
        }
      });
      refreshGrid();
    });
  }

  bindFotoInput('inc-m-foto0');


  // ── Focus / Blur ──────────────────────────────────────────────────────────
  const focusShadow = '0 0 0 2px rgba(99,102,241,.35), inset 0 1px 0 rgba(255,255,255,.03)';
  const blurShadow  = 'inset 0 1px 0 rgba(255,255,255,.03), 0 0 0 1px rgba(0,0,0,.08)';
  ['#inc-m-cat', '#inc-m-ubi', '#inc-m-prioridad', '#inc-m-desc'].forEach(sel => {
    const f = overlay.querySelector(sel);
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

  overlay.querySelector('#inc-m-cancel').onclick = () => {
    overlay.remove();
    if (onClose) onClose(false);
  };

  overlay.querySelector('#inc-m-save').onclick = async () => {
    const cat = overlay.querySelector('#inc-m-cat').value;
    const ubi = overlay.querySelector('#inc-m-ubi').value;
    const prioridad = overlay.querySelector('#inc-m-prioridad').value;
    const desc = overlay.querySelector('#inc-m-desc').value.trim();

    if (!cat || !ubi) { toast(t('inc.error_cat_ubi'), 'error'); return; }
    if (!desc) { toast(t('inc.error_desc'), 'error'); return; }
    if (!fotos.length && !video) { toast(t('inc.error_foto'), 'error'); return; }

    const btn = overlay.querySelector('#inc-m-save');
    btn.disabled = true; btn.textContent = t('inc.guardando');

    try {
      const fd = new FormData();
      if (parteId) fd.append('parte_id', parteId);
      if (sessionId) fd.append('session_id', sessionId);
      fd.append('casa', casa);
      fd.append('categoria', cat);
      fd.append('ubicacion', ubi);
      fd.append('prioridad', prioridad);
      fd.append('descripcion', desc);
      fotos.forEach(f => fd.append('fotos', f));
      if (video) fd.append('video', video);

      await api.crearIncidencia(fd);

      // Si hay un parte activo, actualizamos el contador en el DOM
      if (parteId) {
        state.parte._incidenciasCount = (state.parte._incidenciasCount || 0) + 1;
        document.querySelectorAll('.btn-incidencia-global').forEach(el => {
          const n = state.parte._incidenciasCount;
          el.textContent = `🛠️${n > 0 ? ` (${n})` : ''}`;
        });
      }

      toast(t('inc.ok'), 'success');
      overlay.remove();
      if (onClose) onClose(true);
    } catch (err) {
      toast(t('inc.error_guardar') + err.message, 'error');
      btn.disabled = false; btn.textContent = t('inc.btn_guardar');
    }
  };
}
