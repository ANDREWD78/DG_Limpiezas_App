// ─── Cambio de huéspedes — P1 Suciedad ───────────────────────────────────────
// Selecciona nivel de suciedad 1-5 y navega directamente al checklist.
// Las incidencias se registran en cualquier momento con el botón ⚠ del header.
import { toast } from '../../components/toast.js';
import { headerHTML, bindHeader } from '../../components/partHeader.js';
import { CASA_ICON } from '../../utils/casas.js';
import { t } from '../../i18n/index.js';



export function renderInicio(navigate, state) {
  // Si el parte ya tiene suciedad guardada (reanudado tras logout), saltar P1
  if (state.parte.suciedad) { navigate('checklist'); return; }

  const container = document.getElementById('page-container');
  const { casa } = state.parte;
  const icon = CASA_ICON[casa] || '🏠';
  const suc = state.parte.suciedad;

  container.innerHTML = `
    ${headerHTML(`${icon} ✨ Cambio · ${casa}`, casa, state, true)}
    <div class="page" style="padding-bottom:120px;">

      <div class="step-progress" style="margin:16px 0;">
        <div class="step-dot active"></div>
        <div class="step-dot"></div><div class="step-dot"></div><div class="step-dot"></div>
        <span class="step-label">${t('inicio.paso')}</span>
      </div>

      <div class="section-header"><h2>${t('inicio.titulo')}</h2></div>
      <div class="card" style="text-align:center;">
        <p style="color:var(--text-muted);font-size:.85rem;margin-bottom:16px;">
          ${t('inicio.escala')}
        </p>
        <div style="display:flex;gap:10px;justify-content:center;">
          ${[1, 2, 3, 4, 5].map(n => `
            <button class="btn suc-btn ${suc === n ? 'btn-primary' : 'btn-secondary'}"
                    data-suc="${n}"
                    style="width:52px;height:52px;font-size:1.2rem;font-weight:700;
                           border-radius:50%;padding:0;flex-shrink:0;">
              ${n}
            </button>
          `).join('')}
        </div>
      </div>
    </div>

    <div class="bottom-actions">
      <button class="btn btn-primary w-full" id="btn-comenzar" ${suc ? '' : 'disabled'}>
        ${t('inicio.btn_comenzar')}
      </button>
    </div>
  `;
  bindHeader(container, navigate, state);

  container.querySelector('.card').addEventListener('click', e => {
    const btn = e.target.closest('.suc-btn');
    if (!btn) return;
    state.parte.suciedad = parseInt(btn.dataset.suc);
    container.querySelectorAll('.suc-btn').forEach(b => {
      b.className = `btn suc-btn ${parseInt(b.dataset.suc) === state.parte.suciedad ? 'btn-primary' : 'btn-secondary'}`;
    });
    container.querySelector('#btn-comenzar').disabled = false;
  });

  container.querySelector('#btn-comenzar').addEventListener('click', () => {
    if (!state.parte.suciedad) { toast(t('inicio.error_suciedad'), 'error'); return; }
    navigate('checklist');
  });
}
