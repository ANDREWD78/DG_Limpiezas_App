// ─── Cambio de huéspedes — P4 Fotos de cierre (slots por casa) ──────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { headerHTML, bindHeader } from '../../components/partHeader.js';
import { CASA_ICON } from '../../utils/casas.js';
import { t, currentLang } from '../../i18n/index.js';



function getSlotsForCasa(casa, temporada) {
  const base = {
    GRATAL: [
      { id: 'cocina',         label: '🍳 Cocina',                    labelRu: '🍳 Кухня', min: 1 },
      { id: 'salon',          label: '🛋 Salón',                     labelRu: '🛋 Гостиная', min: 1 },
      { id: 'bano',           label: '🚿 Baño',                      labelRu: '🚿 Ванная', min: 1 },
      { id: 'hab_principal',  label: '🛏 Habitación principal',       labelRu: '🛏 Осн. спальня', min: 1 },
      { id: 'hab_nido',       label: '🛏 Habitación nido',            labelRu: '🛏 Комната Нидо', min: 1 },
      { id: 'hab_2camas',     label: '🛏 Habitación 2 camas',        labelRu: '🛏 Ком. 2 кровати', min: 1 },
      { id: 'hab_literas',    label: '🛏 Habitación literas',        labelRu: '🛏 Ком. ярус', min: 1 },
      { id: 'jardin_trasero', label: '🌳 Jardín trasero',            labelRu: '🌳 Задний сад', min: 1 },
      { id: 'barbacoa',       label: '🔥 Barbacoa',                  labelRu: '🔥 Мангал', min: 1 },
      { id: 'sala_juegos',    label: '🎮 Sala de juegos',            labelRu: '🎮 Игровая', min: 1 },
      { id: 'patio',          label: '🌿 Patio delantero',           labelRu: '🌿 Передний сад', min: 1 },
    ],
    MIRADOR: [
      { id: 'cocina',       label: '🍳 Cocina',                                                         labelRu: '🍳 Кухня', min: 1 },
      { id: 'salon',        label: '🛋 Salón',                                                          labelRu: '🛋 Гостиная', min: 1 },
      { id: 'habitaciones', label: '🛏 Habitaciones (mín. 1 foto de cada una del estado general)',      labelRu: '🛏 Комнаты (мин. 1 фото каждой)', min: 1 },
      { id: 'banos',        label: '🚿 Baños',                                                          labelRu: '🚿 Ванные', min: 1 },
      { id: 'sala_juegos',  label: '🎮 Sala de juegos',                                                 labelRu: '🎮 Игровая', min: 1 },
      { id: 'exterior',     label: '🚪 Jardín/Exterior',                                                labelRu: '🚪 Сад/улица', min: 1 },
      { id: 'despensa',     label: '📦 Despensa',                                                       labelRu: '📦 Кладовая', min: 1 },
    ],
    CASON: [
      { id: 'cocina',       label: '🍳 Cocina',                                                         labelRu: '🍳 Кухня', min: 1 },
      { id: 'salon',        label: '🛋 Salón',                                                          labelRu: '🛋 Гостиная', min: 1 },
      { id: 'hogar',        label: '🪵 Hogar (chimenea)',                                               labelRu: '🪵 Камин', min: 1 },
      { id: 'banos_arriba', label: '🚿 Baños arriba',                                                   labelRu: '🚿 Ванные (верх)', min: 1 },
      { id: 'habitaciones', label: '🛏 Habitaciones (mín. 1 foto de cada una del estado general)',      labelRu: '🛏 Комнаты (мин. 1 фото каждой)', min: 1 },
      { id: 'bano_abajo',   label: '🚿 Baño abajo',                                                    labelRu: '🚿 Ванная (низ)', min: 1 },
      { id: 'exterior',     label: '🚪 Exterior',                                                       labelRu: '🚪 Улица', min: 1 },
    ],
  };
  const slots = base[casa] ? [...base[casa]] : [];
  if (temporada === 'verano' && (casa === 'MIRADOR' || casa === 'GRATAL')) {
    slots.push({ id: 'piscina', label: '🏊 Piscina', labelRu: '🏊 Бассейн', min: 1 });
  }
  return slots;
}

export async function renderFotos(navigate, state) {
  const container = document.getElementById('page-container');
  const { casa, id: parteId } = state.parte;
  const icon = CASA_ICON[casa] || '🏠';
  const temporada = state.config?.temporada || 'entretiempo';

  // ── Check "soy el último" — si hay otros partes abiertos con el mismo cleaning_session_id
  let isLast = true;
  let hasPhotos = false;
  try {
    const csid = state.parte.cleaning_session_id || '';
    const res = await api.openPartsByCasa(casa, parteId, csid);
    isLast = res.isLast;
    hasPhotos = res.hasPhotos || false;
  } catch { /* si falla, asumir restricciones máximas (safe default) */ }

  const isAdmin = state.user?.rol === 'admin';
  const fotosObligatorias = isLast && !hasPhotos;

  const slots = getSlotsForCasa(casa, temporada).map(s => ({ ...s, min: fotosObligatorias ? 1 : 0 }));

  // Init fotosCierre si no existe
  slots.forEach(s => { if (!state.parte.fotosCierre[s.id]) state.parte.fotosCierre[s.id] = []; });

  function isComplete() {
    if (isAdmin) return true; // admin puede continuar sin fotos
    return slots.every(s => (state.parte.fotosCierre[s.id]?.length || 0) >= s.min);
  }

  function renderSlots() {
    return slots.map(s => {
      const fotos = state.parte.fotosCierre[s.id] || [];
      const ok = fotos.length >= s.min;
      // Etiqueta visual: ruso si procede, sin cambiar s.id (clave interna)
      const displayLabel = (currentLang() === 'ru' && s.labelRu) ? s.labelRu : s.label;
      const thumbsHTML = fotos.map((f, i) => `
        <div style="position:relative;display:inline-block;">
          <img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="${i}"/>
          <button class="foto-del-btn" data-slot="${s.id}" data-idx="${i}"
            style="position:absolute;top:3px;right:3px;width:22px;height:22px;
                   border-radius:50%;background:rgba(0,0,0,.75);border:none;
                   color:#fff;font-size:.7rem;cursor:pointer;
                   display:flex;align-items:center;justify-content:center;
                   padding:0;touch-action:manipulation;">✕</button>
        </div>
      `).join('');
      return `
        <div class="card" style="border-color:${ok ? 'var(--success)' : 'var(--border)'};margin-bottom:12px;">
          <div class="card-title" style="display:flex;justify-content:space-between;align-items:center;">
            <span>${displayLabel}</span>
            <span style="color:${ok ? 'var(--success)' : 'var(--text-muted)'};">  
              ${fotos.length}/${s.min} ${ok ? '✅' : ''}
            </span>
          </div>
          <div class="foto-grid" id="grid-${s.id}">
            ${thumbsHTML}
            ${fotos.length < 6 ? `
              <label class="foto-add-btn" for="input-${s.id}">
                <span class="plus">+</span><span>${t('fotos.btn_foto')}</span>
              </label>
              <input type="file" id="input-${s.id}" accept="image/*"
                     multiple data-slot="${s.id}" style="display:none;" class="slot-input"/>
            ` : ''}
          </div>
        </div>
      `;
    }).join('');
  }

  function render() {
    container.innerHTML = `
      ${headerHTML(`${icon} 📸 Fotos · ${casa}`, casa, state)}
      <div class="page" style="padding-bottom:100px;">

        <div class="step-progress" style="margin:16px 0;">
          <div class="step-dot done"></div><div class="step-dot done"></div>
          <div class="step-dot done"></div><div class="step-dot active"></div>
          <span class="step-label">${t('fotos.paso')}</span>
        </div>

        <div class="card" style="background:rgba(59,130,246,.07);border-color:rgba(59,130,246,.25);margin-bottom:8px;">
          ${!isLast ? `
            <p style="font-size:.85rem;text-align:center;color:var(--text);margin-bottom:0;font-weight:600;">
              Hay otros compañeros activos. Puedes omitir las fotos o subirlas tú ahora.
            </p>
          ` : (isLast && hasPhotos) ? `
            <p style="font-size:.85rem;text-align:center;color:var(--success);margin-bottom:0;font-weight:600;">
              Tus compañeros ya han subido fotos válidas. Puedes cerrar directamente.
            </p>
          ` : `
            <p style="font-size:.85rem;text-align:center;color:var(--warning);margin-bottom:0;font-weight:600;">
              Eres la última persona. Debes subir las fotos finales obligatoriamente para cerrar la casa.
            </p>
          `}
        </div>

        ${isAdmin ? `
        <div style="background:rgba(234,179,8,.1);border:1px solid rgba(234,179,8,.4);
                    border-radius:10px;padding:10px 14px;margin-bottom:8px;font-size:.78rem;
                    color:var(--warning);text-align:center;">
          ${t('fotos.modo_admin')}
        </div>` : ''}
        <div id="slots-container">${renderSlots()}</div>
        <p id="foto-total-counter" style="text-align:center;font-size:.8rem;color:var(--text-muted);margin-top:4px;">
          ${(() => { const _n = Object.values(state.parte.fotosCierre).reduce((s, a) => s + a.length, 0); return _n === 1 ? t('fotos.total_1') : t('fotos.total', { n: _n }); })()}
        </p>
      </div>

      <div class="bottom-actions">
        <button class="btn btn-primary w-full" id="btn-cierre" ${isComplete() ? '' : 'disabled'}>
          ${(() => {
            const _n = Object.values(state.parte.fotosCierre).reduce((s, a) => s + a.length, 0);
            if (_n === 0 && !fotosObligatorias && !isAdmin) return "Cerrar sin subir fotos";
            if (_n === 0) return t('fotos.btn_cierre');
            return `Cerrar y subir ${_n} foto${_n > 1 ? 's' : ''}`;
          })()}
        </button>
      </div>
    `;
    bindHeader(container, navigate, state);
    bindEvents();
  }

  function bindEvents() {
    // ── Borrar foto individual ────────────────────────────────────────────
    container.querySelector('#slots-container').addEventListener('click', e => {
      const delBtn = e.target.closest('.foto-del-btn');
      if (!delBtn) return;
      const slot = delBtn.dataset.slot;
      const idx = parseInt(delBtn.dataset.idx, 10);

      state.parte.fotosCierre[slot].splice(idx, 1);

      const slotDef = slots.find(s => s.id === slot);
      const fotosSlot = state.parte.fotosCierre[slot];
      const ok = fotosSlot.length >= slotDef.min;

      const card = container.querySelector(`#grid-${slot}`).closest('.card');
      card.style.borderColor = ok ? 'var(--success)' : 'var(--border)';
      card.querySelector('.card-title span:last-child').textContent = `${fotosSlot.length}/${slotDef.min} ${ok ? '\u2705' : ''}`;
      card.querySelector('.card-title span:last-child').style.color = ok ? 'var(--success)' : 'var(--text-muted)';

      const grid = card.querySelector(`#grid-${slot}`);
      const inputId = `input-${slot}-x${fotosSlot.length}`;
      grid.innerHTML = fotosSlot.map((f, i) => `
        <div style="position:relative;display:inline-block;">
          <img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="${i}"/>
          <button class="foto-del-btn" data-slot="${slot}" data-idx="${i}"
            style="position:absolute;top:3px;right:3px;width:22px;height:22px;
                   border-radius:50%;background:rgba(0,0,0,.75);border:none;
                   color:#fff;font-size:.7rem;cursor:pointer;
                   display:flex;align-items:center;justify-content:center;
                   padding:0;touch-action:manipulation;">✕</button>
        </div>
      `).join('') + (fotosSlot.length < 6 ? `
        <label class="foto-add-btn" for="${inputId}">
          <span class="plus">+</span><span>${t('fotos.btn_foto')}</span>
        </label>
        <input type="file" id="${inputId}" accept="image/*"
               multiple data-slot="${slot}" style="display:none;" class="slot-input"/>
      ` : '');

      const total = Object.values(state.parte.fotosCierre).reduce((s, a) => s + a.length, 0);
      const btn = container.querySelector('#btn-cierre');
      if (btn) {
          btn.disabled = !isComplete();
          if (total === 0 && !fotosObligatorias && !isAdmin) btn.textContent = "Cerrar sin subir fotos";
          else if (total === 0) btn.textContent = t('fotos.btn_cierre');
          else btn.textContent = `Cerrar y subir ${total} foto${total > 1 ? 's' : ''}`;
      }
      
      const counter = container.querySelector('#foto-total-counter');
      if (counter) counter.textContent = total === 1 ? t('fotos.total_1') : t('fotos.total', { n: total });
    });

    // ── Añadir foto ───────────────────────────────────────────────────────
    container.querySelector('#slots-container').addEventListener('change', e => {
      const input = e.target.closest('.slot-input');
      if (!input) return;
      const slot = input.dataset.slot;
      state.parte.fotosCierre[slot].push(...Array.from(e.target.files));

      // Re-render solo esa tarjeta
      const slotDef = slots.find(s => s.id === slot);
      const fotos = state.parte.fotosCierre[slot];
      const ok = fotos.length >= slotDef.min;
      const card = container.querySelector(`#grid-${slot}`).closest('.card');
      card.style.borderColor = ok ? 'var(--success)' : 'var(--border)';
      card.querySelector('.card-title span:last-child').textContent = `${fotos.length}/${slotDef.min} ${ok ? '✅' : ''}`;
      card.querySelector('.card-title span:last-child').style.color = ok ? 'var(--success)' : 'var(--text-muted)';
      const grid = card.querySelector(`#grid-${slot}`);
      const inputId2 = `input-${slot}-x${fotos.length}`;
      grid.innerHTML = fotos.map((f, i) => `
        <div style="position:relative;display:inline-block;">
          <img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="${i}"/>
          <button class="foto-del-btn" data-slot="${slot}" data-idx="${i}"
            style="position:absolute;top:3px;right:3px;width:22px;height:22px;
                   border-radius:50%;background:rgba(0,0,0,.75);border:none;
                   color:#fff;font-size:.7rem;cursor:pointer;
                   display:flex;align-items:center;justify-content:center;
                   padding:0;touch-action:manipulation;">✕</button>
        </div>
      `).join('') + (fotos.length < 6 ? `
        <label class="foto-add-btn" for="${inputId2}">
          <span class="plus">+</span><span>${t('fotos.btn_foto')}</span>
        </label>
        <input type="file" id="${inputId2}" accept="image/*"
               multiple data-slot="${slot}" style="display:none;" class="slot-input"/>
      ` : '');

      // Actualizar contador global y botón
      const total = Object.values(state.parte.fotosCierre).reduce((s, a) => s + a.length, 0);
      const btn = container.querySelector('#btn-cierre');
      if (btn) {
          btn.disabled = !isComplete();
          if (total === 0 && !fotosObligatorias && !isAdmin) btn.textContent = "Cerrar sin subir fotos";
          else if (total === 0) btn.textContent = t('fotos.btn_cierre');
          else btn.textContent = `Cerrar y subir ${total} foto${total > 1 ? 's' : ''}`;
      }

      const counter = container.querySelector('#foto-total-counter');
      if (counter) counter.textContent = total === 1 ? t('fotos.total_1') : t('fotos.total', { n: total });
    });

    container.querySelector('#btn-cierre').addEventListener('click', () => {
      if (!isComplete()) {
        const falta = slots.find(s => (state.parte.fotosCierre[s.id]?.length || 0) < s.min);
        const faltaLabel = (currentLang() === 'ru' && falta?.labelRu) ? falta.labelRu : falta?.label;
        toast(t('fotos.falta', { label: faltaLabel }), 'error');
        return;
      }
      navigate('cierre');
    });
  }

  render();
}
