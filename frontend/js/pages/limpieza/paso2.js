// ─── Paso 2: Checklist + Fotos + Consumibles + Incidencia ──────────────────
import { toast } from '../../components/toast.js';

const CHECKLISTS = {
    cambio: [
        'Retirar y contar ropa de cama sucia',
        'Hacer camas con ropa limpia',
        'Cambiar toallas (baño + cocina)',
        'Limpiar y desinfectar baño completo',
        'Limpiar cocina y electrodomésticos',
        'Fregar suelos de toda la casa',
        'Vaciar papeleras',
        'Revisar y reponer consumibles',
        'Ventilación de todas las habitaciones',
        'Revisar desperfectos y comunicar',
    ],
    revision: [
        'Revisar limpieza general',
        'Limpiar baño',
        'Fregar suelos si necesario',
        'Vaciar papeleras',
        'Reponer consumibles si falta',
        'Ordenar espacios comunes',
    ],
    profunda: [
        'Retirar ropa de cama y toallas',
        'Limpiar ventanas por dentro y fuera',
        'Limpiar detrás de muebles y electrodomésticos',
        'Desinfección completa de baños',
        'Limpieza profunda de cocina (horno, nevera)',
        'Fregar y encerar suelos',
        'Limpiar paredes, rodapiés y zócalos',
        'Revisar y documentar todos los desperfectos',
        'Inventario de consumibles',
        'Dejar documentación en regla',
        'Fotografiar el estado final del alojamiento',
    ],
};

export function renderPaso2(navigate, state) {
    const container = document.getElementById('page-container');
    const { piso, tipo, personas, tiempoObjetivo, horaInicio } = state.limpieza;
    const tareas = CHECKLISTS[tipo] || CHECKLISTS.revision;

    // Init state
    if (!state.limpieza.checklist.length) {
        state.limpieza.checklist = tareas.map(t => ({ texto: t, done: false }));
    }
    if (!Object.keys(state.limpieza.consumibles).length) {
        const cats = state.config?.consumibles_catalogo || ['Papel higiénico', 'Jabón', 'Gel ducha', 'Champú', 'Lejía'];
        cats.forEach(c => { state.limpieza.consumibles[c] = 0; });
    }
    if (!state.limpieza.fotos) state.limpieza.fotos = [];

    const pisoItems = state.limpieza.checklist;
    const consumibles = state.limpieza.consumibles;

    // Filtrar consumibles por piso (Café solo para Gratal)
    const consKeys = Object.keys(consumibles).filter(k => {
        if (k.toLowerCase().includes('café') && piso !== 'GRATAL') return false;
        return true;
    });

    // Timer
    let timerInterval = null;

    function getElapsedMin() {
        if (!horaInicio) return 0;
        const [hI, mI] = horaInicio.split(':').map(Number);
        const now = new Date();
        return Math.max(0, Math.floor((now.getHours() * 60 + now.getMinutes()) - (hI * 60 + mI)));
    }

    function timerClass(mins) {
        if (mins <= tiempoObjetivo * 0.8) return 'timer-ok';
        if (mins <= tiempoObjetivo) return 'timer-warn';
        return 'timer-over';
    }

    function renderChecklist() {
        return pisoItems.map((t, i) => `
      <div class="checklist-item ${t.done ? 'done' : ''}" data-idx="${i}">
        <div class="checklist-check"></div>
        <div class="checklist-text">${t.texto}</div>
      </div>
    `).join('');
    }

    function renderConsumo() {
        return consKeys.length === 0 ? '<p class="text-muted">Sin consumibles configurados</p>' :
            consKeys.map(k => `
        <div class="consumible-row">
          <span style="font-size:.85rem;">${k}</span>
          <div class="qty-ctrl">
            <button class="qty-btn" data-con="${k}" data-op="-">−</button>
            <span class="qty-num" id="qty-${k.replace(/\s/g, '_')}">${consumibles[k]}</span>
            <button class="qty-btn" data-con="${k}" data-op="+">+</button>
          </div>
        </div>
      `).join('');
    }

    const donePct = () => Math.round((pisoItems.filter(t => t.done).length / pisoItems.length) * 100);

    container.innerHTML = `
    <div class="app-header">
      <div class="logo">
        <span style="font-size:1.3rem">${piso === 'MIRADOR' ? '🏔️' : piso === 'CASON' ? '🏡' : '🌿'}</span>
        <span>${piso} · ${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</span>
      </div>
      <div class="timer-label" style="text-align:right;">
        Inicio: ${horaInicio}<br/><small>Obj: ${tiempoObjetivo} min</small>
      </div>
    </div>

    <div class="page" style="padding-bottom:90px;">
      <div class="step-progress">
        <div class="step-dot done"></div>
        <div class="step-dot active"></div>
        <div class="step-dot"></div>
        <span class="step-label">Paso 2 de 3 — Tareas</span>
      </div>

      <!-- Timer -->
      <div class="timer-display">
        <div>
          <div class="timer-label">Tiempo transcurrido</div>
          <div class="timer-value ${timerClass(getElapsedMin())}" id="timer-val">${getElapsedMin()} min</div>
        </div>
        <div style="text-align:right;">
          <div class="timer-label">Completado</div>
          <div style="font-weight:700;font-size:1.2rem;" id="pct-val">${donePct()}%</div>
        </div>
      </div>

      <!-- Progreso -->
      <div class="progress-bar-wrap">
        <div class="progress-bar" id="progress-bar" style="width:${donePct()}%"></div>
      </div>

      <!-- Checklist -->
      <div class="section-header"><h2>✅ Tareas</h2></div>
      <div id="checklist-list">${renderChecklist()}</div>

      <hr class="divider"/>

      <!-- Incidencia rápida -->
      <div class="incidencia-toggle" id="incidencia-toggle">
        <span>🔴 Reportar incidencia</span>
        <div class="toggle-switch ${state.limpieza.incidencia ? 'on' : ''}" id="toggle-sw"></div>
      </div>
      <div id="incidencia-form" class="${state.limpieza.incidencia ? '' : 'hidden'}">
        <div class="card">
          <textarea class="notas" id="incidencia-desc" placeholder="Describe la incidencia..." rows="3">${state.limpieza.incidencia?.descripcion || ''}</textarea>
        </div>
      </div>

      <hr class="divider"/>

      <!-- Fotos -->
      <div class="section-header"><h2>📷 Fotos</h2></div>
      <div class="foto-grid" id="foto-grid">
        ${state.limpieza.fotos.map((f, i) => `
          <img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="foto ${i + 1}"/>
        `).join('')}
        <label class="foto-add-btn" for="foto-input">
          <span class="plus">+</span>
          <span>Foto</span>
        </label>
        <input type="file" id="foto-input" accept="image/*" multiple style="display:none"/>
      </div>

      <hr class="divider"/>

      <!-- Consumibles -->
      <div class="section-header"><h2>🛒 Consumibles usados</h2></div>
      <div class="card">
        <div id="consumibles-list">${renderConsumo()}</div>
      </div>
    </div>

    <div class="bottom-actions">
      <button class="btn btn-secondary w-full" id="btn-back" style="max-width:100px;">← Atrás</button>
      <button class="btn btn-primary w-full" id="btn-siguiente">Revisar →</button>
    </div>
  `;

    // Timer loop
    timerInterval = setInterval(() => {
        const mins = getElapsedMin();
        const el = container.querySelector('#timer-val');
        if (el) {
            el.textContent = `${mins} min`;
            el.className = `timer-value ${timerClass(mins)}`;
        }
    }, 30000);

    // Checklist toggle
    container.querySelector('#checklist-list').addEventListener('click', (e) => {
        const item = e.target.closest('.checklist-item');
        if (!item) return;
        const idx = parseInt(item.dataset.idx);
        pisoItems[idx].done = !pisoItems[idx].done;
        item.classList.toggle('done', pisoItems[idx].done);
        const pct = donePct();
        container.querySelector('#progress-bar').style.width = pct + '%';
        container.querySelector('#pct-val').textContent = pct + '%';
    });

    // Incidencia toggle
    container.querySelector('#incidencia-toggle').addEventListener('click', () => {
        const toggle = container.querySelector('#toggle-sw');
        const form = container.querySelector('#incidencia-form');
        const on = toggle.classList.toggle('on');
        form.classList.toggle('hidden', !on);
        if (!on) state.limpieza.incidencia = null;
    });

    // Fotos
    container.querySelector('#foto-input').addEventListener('change', (e) => {
        const files = Array.from(e.target.files);
        files.forEach(f => {
            if (state.limpieza.fotos.length < 5) state.limpieza.fotos.push(f);
        });
        // Re-render foto grid
        const grid = container.querySelector('#foto-grid');
        grid.innerHTML = state.limpieza.fotos.map((f, i) => `
      <img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="foto ${i + 1}"/>
    `).join('') + `
      <label class="foto-add-btn" for="foto-input">
        <span class="plus">+</span><span>Foto</span>
      </label>
      <input type="file" id="foto-input" accept="image/*" multiple style="display:none"/>
    `;
        grid.querySelector('#foto-input').addEventListener('change', arguments.callee);
    });

    // Consumibles
    container.querySelector('#consumibles-list').addEventListener('click', (e) => {
        const btn = e.target.closest('.qty-btn');
        if (!btn) return;
        const k = btn.dataset.con;
        const op = btn.dataset.op;
        consumibles[k] = Math.max(0, (consumibles[k] || 0) + (op === '+' ? 1 : -1));
        const idSafe = k.replace(/\s/g, '_');
        const el = container.querySelector(`#qty-${idSafe}`);
        if (el) el.textContent = consumibles[k];
    });

    // Siguiente
    container.querySelector('#btn-siguiente').addEventListener('click', () => {
        clearInterval(timerInterval);
        const incDesc = container.querySelector('#incidencia-desc')?.value?.trim();
        const toggleOn = container.querySelector('#toggle-sw').classList.contains('on');
        if (toggleOn && incDesc) {
            state.limpieza.incidencia = { descripcion: incDesc };
        } else if (!toggleOn) {
            state.limpieza.incidencia = null;
        }
        navigate('paso3');
    });

    container.querySelector('#btn-back').addEventListener('click', () => {
        clearInterval(timerInterval);
        navigate('paso1');
    });
}
