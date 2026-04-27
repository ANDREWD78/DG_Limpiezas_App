// ─── Paso 1: Selección de piso, tipo y personas ────────────────────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { timeMadrid } from '../../utils/time.js';

const PISOS = [
    { id: 'MIRADOR', icon: '🏔️', desc: 'El Mirador del Guara', maxPersonas: 3 },
    { id: 'CASON', icon: '🏡', desc: 'El Casón de Sieso', maxPersonas: 2 },
    { id: 'GRATAL', icon: '🌿', desc: 'Casa del Gratal', maxPersonas: 2 },
];

const TIPOS = [
    { id: 'cambio', icon: '🔄', label: 'Cambio', desc: 'Entre huéspedes' },
    { id: 'revision', icon: '🔍', label: 'Revisión', desc: 'Estancia larga' },
    { id: 'profunda', icon: '✨', label: 'Profunda', desc: 'Temporada/fondo' },
];

export function renderPaso1(navigate, state) {
    const container = document.getElementById('page-container');

    container.innerHTML = `
    <div class="app-header">
      <div class="logo">
        <img src="img/logo-dg-icono.svg" alt="DG" width="32" height="32" style="display:block;">
        <span>Nueva Limpieza</span>
      </div>
      <div>
        <div class="header-user"><strong>${state.user?.nombre || ''}</strong>limpiador/a</div>
      </div>
    </div>

    <div class="page" style="padding-bottom:80px;">
      <div class="step-progress">
        <div class="step-dot active"></div>
        <div class="step-dot"></div>
        <div class="step-dot"></div>
        <span class="step-label">Paso 1 de 3 — Selección</span>
      </div>

      <div class="section-header"><h2>¿Qué alojamiento?</h2></div>
      <div class="piso-grid" id="piso-grid">
        ${PISOS.map(p => `
          <div class="piso-card piso-${p.id}" data-piso="${p.id}">
            <div class="piso-icon">${p.icon}</div>
            <div class="piso-info">
              <h3>${p.id}</h3>
              <p>${p.desc}</p>
            </div>
          </div>
        `).join('')}
      </div>

      <div class="section-header mt-24"><h2>¿Tipo de limpieza?</h2></div>
      <div class="tipo-grid" id="tipo-grid">
        ${TIPOS.map(t => `
          <div class="tipo-card" data-tipo="${t.id}">
            <div class="tipo-icon">${t.icon}</div>
            <span>${t.label}</span>
            <small>${t.desc}</small>
          </div>
        `).join('')}
      </div>

      <div id="personas-section" class="hidden">
        <div class="section-header mt-24"><h2>¿Nº de personas?</h2></div>
        <div class="personas-row" id="personas-row"></div>
      </div>

      <div id="objetivo-section" class="hidden mt-16">
        <div class="tiempo-objetivo">
          <div>
            <div class="label">⏱ Tiempo objetivo</div>
            <div class="label" id="objetivo-detalle" style="margin-top:2px;font-size:0.7rem;opacity:.7;"></div>
          </div>
          <div class="value" id="objetivo-valor">— min</div>
        </div>
      </div>
    </div>

    <div class="bottom-actions">
      <button class="btn btn-primary" id="btn-siguiente" disabled>Siguiente →</button>
    </div>
  `;

    let pisoSel = null, tipoSel = null, personasSel = null;

    function calcObjetivo() {
        if (!pisoSel || !tipoSel) return null;
        const cfg = state.config?.objetivos_json || {};
        const temp = state.config?.temporada || 'entretiempo';
        const factor = parseFloat(state.config?.umbral_factor || 1.3);
        const obj = cfg[pisoSel];
        if (!obj) return null;
        let min;
        if (tipoSel === 'cambio' && personasSel) {
            const map = obj.cambio || {};
            const key = `${personasSel}p`;
            min = map[key] || Object.values(map)[0];
        } else {
            min = obj[tipoSel];
        }
        if (!min) return null;
        // Ajuste por temporada
        const mult = temp === 'verano' ? 1.1 : temp === 'invierno' ? 0.9 : 1;
        return { base: Math.round(min * mult), umbral: Math.round(min * mult * factor) };
    }

    function updateUI() {
        const t = calcObjetivo();
        const objetivoSec = container.querySelector('#objetivo-section');
        const objetivoVal = container.querySelector('#objetivo-valor');
        const objetivoDet = container.querySelector('#objetivo-detalle');
        if (t) {
            objetivoSec.classList.remove('hidden');
            objetivoVal.textContent = `${t.base} min`;
            objetivoDet.textContent = `Umbral: ${t.umbral} min · temp. ${state.config?.temporada || ''}`;
        } else {
            objetivoSec.classList.add('hidden');
        }
        const ok = pisoSel && tipoSel && (tipoSel !== 'cambio' || personasSel);
        container.querySelector('#btn-siguiente').disabled = !ok;
    }

    // Selección piso
    container.querySelector('#piso-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.piso-card');
        if (!card) return;
        pisoSel = card.dataset.piso;
        container.querySelectorAll('.piso-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        // Mostrar selector personas
        const piso = PISOS.find(p => p.id === pisoSel);
        const sec = container.querySelector('#personas-section');
        const row = container.querySelector('#personas-row');
        if (tipoSel === 'cambio') {
            sec.classList.remove('hidden');
            row.innerHTML = Array.from({ length: piso.maxPersonas }, (_, i) => i + 1)
                .map(n => `<button class="personas-btn ${personasSel == n ? 'selected' : ''}" data-n="${n}">${n}p</button>`).join('');
        }
        updateUI();
    });

    // Selección tipo
    container.querySelector('#tipo-grid').addEventListener('click', (e) => {
        const card = e.target.closest('.tipo-card');
        if (!card) return;
        tipoSel = card.dataset.tipo;
        container.querySelectorAll('.tipo-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');

        const sec = container.querySelector('#personas-section');
        const row = container.querySelector('#personas-row');
        if (tipoSel === 'cambio' && pisoSel) {
            const piso = PISOS.find(p => p.id === pisoSel);
            sec.classList.remove('hidden');
            row.innerHTML = Array.from({ length: piso.maxPersonas }, (_, i) => i + 1)
                .map(n => `<button class="personas-btn ${personasSel == n ? 'selected' : ''}" data-n="${n}">${n}p</button>`).join('');
        } else {
            sec.classList.add('hidden');
            personasSel = null;
        }
        updateUI();
    });

    // Selección personas
    container.querySelector('#personas-row').addEventListener('click', (e) => {
        const btn = e.target.closest('.personas-btn');
        if (!btn) return;
        personasSel = parseInt(btn.dataset.n);
        container.querySelectorAll('.personas-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        updateUI();
    });

    // Siguiente
    container.querySelector('#btn-siguiente').addEventListener('click', () => {
        const t = calcObjetivo();
        state.limpieza.piso = pisoSel;
        state.limpieza.tipo = tipoSel;
        state.limpieza.personas = personasSel;
        state.limpieza.tiempoObjetivo = t ? t.base : 60;
        state.limpieza.horaInicio = timeMadrid();
        navigate('paso2');
    });
}
