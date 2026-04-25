// ─── Cambio de huéspedes — P3 Checklist por casa ─────────────────────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { headerHTML, bindHeader } from '../../components/partHeader.js';
import { CASA_ICON } from '../../utils/casas.js';
import { t, currentLang } from '../../i18n/index.js';

// Traducciones visuales de ítems de checklist.
// c.id (guardado en Sheets) NUNCA cambia. Solo traducimos la etiqueta mostrada.
const CHECKLIST_LABEL_RU = {
  // Comunes
  'cocina': 'Кухня', 'banos': 'Ванные', 'bano': 'Ванная',
  'habitaciones': 'Комнаты', 'salon': 'Гостиная', 'consumibles': 'Расходники',
  // CASON
  'lena': 'Наполнить дрова', 'hab_banos': 'Комнаты и ванные',
  // GRATAL
  'salon_cocina': 'Гостиная/кухня', 'literas': 'Ярусные кровати',
  'sala_juegos': 'Игровая', 'exterior': 'Улица/сад',
  'pintura': 'Осмотр стен', 'piscina': 'Бассейн',
  // Acciones genéricas
  'basura': 'Вынести мусор', 'limpiar': 'Уборка',
  'revisar': 'Проверка', 'check_general': 'Общая проверка',
};

/**
 * Devuelve la etiqueta visual de un ítem de checklist en el idioma activo.
 * Si no hay traducción al ruso para ese id, devuelve el label original del backend.
 */
function tCheckItem(id, label) {
  if (currentLang() === 'ru') return CHECKLIST_LABEL_RU[id] || label;
  return label;
}


const CHECKLIST_FALLBACK = {
  MIRADOR: [
    { id: 'cocina', label: 'Cocina' }, { id: 'banos', label: 'Baños' },
    { id: 'habitaciones', label: 'Habitaciones' }, { id: 'salon', label: 'Salón' },
    { id: 'consumibles', label: 'Revisar consumibles' },
  ],
  CASON: [
    { id: 'lena', label: 'Rellenar leña' }, { id: 'cocina', label: 'Cocina' },
    { id: 'hab_banos', label: 'Habitaciones y baños' }, { id: 'salon', label: 'Salón' },
    { id: 'consumibles', label: 'Revisar consumibles' },
  ],
  GRATAL: [
    { id: 'cocina', label: 'Cocina' }, { id: 'habitaciones', label: 'Habitaciones' },
    { id: 'bano', label: 'Baño' }, { id: 'salon', label: 'Salón' },
    { id: 'consumibles', label: 'Revisar consumibles' },
  ],
};

export async function renderChecklist(navigate, state) {
  const container = document.getElementById('page-container');
  const { casa } = state.parte;
  const icon = CASA_ICON[casa] || '🏠';
  const temporada = state.config?.temporada || 'entretiempo';

  const allItems = state.config?.checklist?.[casa] || CHECKLIST_FALLBACK[casa] || [];
  const items = allItems.filter(item => !item.cond || item.cond === temporada);
  const prev = state.parte.checklistCambio || {};

  // Cargar tareas periódicas (silencioso si falla)
  let tareasP = [];
  try {
    const res = await api.getTareasPeriodicasByCasa(casa);
    tareasP = res.tareas || [];
  } catch (e) {
    console.warn('[TP] Error cargando tareas periódicas:', e.message);
  }
  const prevTP = state.parte.tareasPeriodicasSeleccion || [];
  const prevTPMap = Object.fromEntries(prevTP.map(t => [t.task_id, t.done]));

  container.innerHTML = `
    ${headerHTML(`${icon} \u2705 Checklist \u00b7 ${casa}`, casa, state, true)}
    <div class="page" style="padding-bottom:120px;">

      <div class="step-progress" style="margin:16px 0;">
        <div class="step-dot done"></div>
        <div class="step-dot active"></div><div class="step-dot"></div><div class="step-dot"></div>
        <span class="step-label">${t('checklist.paso')}</span>
      </div>

      <div class="card" style="background:rgba(34,197,94,.07);border-color:rgba(34,197,94,.3);padding:12px 14px;margin-bottom:2px;">
        <p style="font-size:.83rem;line-height:1.5;color:var(--text);margin:0;">
          ${t('checklist.aviso')}
        </p>
      </div>

      <div class="section-header" style="margin-top:14px;"><h2>${t('checklist.titulo')}</h2></div>
      <p style="font-size:.8rem;color:var(--text-muted);margin:0 0 10px;padding:0 2px;">
        ${t('checklist.desc')}
      </p>

      <div class="card" id="checklist-card">
        ${items.map(c => `
          <label style="display:flex;align-items:center;gap:12px;padding:10px 0;
                         border-bottom:1px solid var(--border);cursor:pointer;">
            <input type="checkbox" class="room-check" data-id="${c.id}"
                   ${prev[c.id] ? 'checked' : ''}
                   style="width:20px;height:20px;accent-color:var(--success);flex-shrink:0;"/>
            <span style="font-size:.88rem;">${tCheckItem(c.id, c.label)}</span>
          </label>
        `).join('')}
      </div>

      <p id="check-counter"
         style="text-align:center;font-size:.78rem;color:var(--text-muted);margin-top:8px;"></p>

      ${tareasP.length > 0 ? `
      <div class="section-header" style="margin-top:20px;"><h2>${t('checklist.tareas_periodicas')}</h2></div>
      <p style="font-size:.78rem;color:var(--text-muted);margin:0 0 8px;padding:0 2px;">
        ${t('checklist.tareas_desc')}
      </p>
      <div class="card" id="tp-card">
        ${tareasP.map(t => `
          <label style="display:flex;align-items:center;gap:12px;padding:12px 0;
                         border-bottom:1px solid var(--border);cursor:pointer;min-height:48px;">
            <input type="checkbox" class="tp-check" data-id="${t.id}"
                   ${prevTPMap[t.id] ? 'checked' : ''}
                   style="width:22px;height:22px;accent-color:var(--warning);flex-shrink:0;"/>
            <span style="font-size:.88rem;">
              ${t.nombre}
              ${t.zona ? `<span style="font-size:.75rem;color:var(--text-muted);display:block;">${t.zona}</span>` : ''}
              ${t.descripcion ? `<span style="font-size:.75rem;color:var(--text-muted);display:block;">${t.descripcion}</span>` : ''}
            </span>
          </label>
        `).join('')}
      </div>
      ` : ''}

    </div>

    <div class="bottom-actions">
      <button class="btn btn-primary w-full" id="btn-fotos">${t('checklist.btn_fotos')}</button>
    </div>
  `;
  bindHeader(container, navigate, state);

  function updateCounter() {
    const total = items.length;
    const checked = container.querySelectorAll('.room-check:checked').length;
    const el = container.querySelector('#check-counter');
    if (!el) return;
    if (checked === total) {
      el.textContent = t('checklist.todo_completado', { n: checked, total });
      el.style.color = 'var(--success)';
    } else {
      el.textContent = t('checklist.completadas', { n: checked, total });
      el.style.color = 'var(--text-muted)';
    }
  }
  updateCounter();
  container.querySelector('#checklist-card').addEventListener('change', updateCounter);

  container.querySelector('#btn-fotos').addEventListener('click', () => {
    // Checklist normal
    const checkObj = {};
    container.querySelectorAll('.room-check').forEach(cb => {
      checkObj[cb.dataset.id] = cb.checked;
    });
    state.parte.checklistCambio = checkObj;
    if (checkObj.lena !== undefined) state.parte.lena = checkObj.lena ? 'Sí' : 'No';
    if (checkObj.pellets !== undefined) state.parte.pellets = checkObj.pellets ? 'Sí' : 'No';

    // Tareas periódicas
    state.parte.tareasPeriodicasSeleccion = tareasP.map(t => ({
      task_id: t.id,
      nombre: t.nombre,
      done: container.querySelector(`.tp-check[data-id="${t.id}"]`)?.checked ?? false,
    }));

    navigate('fotos');
  });
}
