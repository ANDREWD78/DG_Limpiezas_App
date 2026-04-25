// ─── Pantalla de éxito final v2 ────────────────────────────────────────────
import { api } from '../../api.js';
import { resetParte, salirSinLogout } from '../../app.js';
import { DG_ICON } from '../login.js';
import { t } from '../../i18n/index.js';

// El tipo interno se usa para lookup de etiqueta visual traducida
const TIPO_LABEL_KEY = {
  revision: 'exito.tipo.revision',
  cambio: 'exito.tipo.cambio',
  profunda: 'exito.tipo.profunda',
  'post-incidencia': 'exito.tipo.post_incidencia',
};

export function renderExito(navigate, state) {
  const container = document.getElementById('page-container');

  // ── Leer resumen: sessionStorage (fuente principal) con fallback a state ──
  let resumen = {};
  try {
    const stored = sessionStorage.getItem('dg_last_parte_resumen');
    if (stored) resumen = JSON.parse(stored);
  } catch { /* ignore */ }

  const casa = resumen.casa || state.parte?.casa || '—';
  const tipo = resumen.tipo || state.parte?.tipo || '—';
  const limpiador = resumen.limpiador_nombre || state.user?.nombre || '—';
  const casaLista = resumen.casaLista || state.parte?.casaLista || '';
  const fotosCount = resumen.fotosCount ?? state.parte?._fotosCount ?? -1;

  const tipoLabel = t(TIPO_LABEL_KEY[tipo] || '') || tipo;

  // Texto dinámico según fotos
  const driveMsg = fotosCount > 0
    ? `${fotosCount} foto${fotosCount > 1 ? 's' : ''} guardadas en Drive. `
    : '';  // 0 o desconocido → no mencionar Drive

  const casaListaBadge = casaLista
    ? `<div class="resumen-stat">
         <span class="label">${t('exito.casa_lista')}</span>
         <span class="badge ${casaLista === 'S\u00ed' ? 'badge-ok' : 'badge-error'}">
           ${casaLista === 'S\u00ed' ? t('exito.si') : t('exito.no')}
         </span>
       </div>`
    : '';

  container.innerHTML = `
    <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;
                min-height:100dvh;padding:24px 24px 32px;text-align:center;gap:16px;">

      <div style="width:130px; margin-bottom:4px;">
        <img src="/img/logo-dg-cuadrado.svg" alt="Destino Guara" style="width:100%; height:auto; display:block; margin:0 auto;" />
      </div>
      <div style="font-size:2.5rem; margin-bottom:-4px; animation:pulse 1.2s ease infinite;">\uD83C\uDF89</div>
      <h2 style="font-size:1.6rem; font-weight:800; margin:0 0 12px; color:var(--text);">${t('exito.titulo')}</h2>

      <div class="card" style="width:100%;max-width:340px;text-align:left;">
        <div class="card-title">${t('exito.resumen')}</div>
        <div class="resumen-stat">
          <span class="label">${t('exito.casa')}</span>
          <strong>${casa}</strong>
        </div>
        <div class="resumen-stat">
          <span class="label">${t('exito.tipo')}</span>
          <strong>${tipoLabel}</strong>
        </div>
        <div class="resumen-stat">
          <span class="label">${t('exito.limpiador')}</span>
          <strong>${limpiador}</strong>
        </div>
        ${casaListaBadge}
      </div>

      <div style="display:flex;flex-direction:column;gap:10px;width:100%;max-width:340px;">
        <button class="btn btn-primary" id="btn-nuevo">${t('exito.btn_nuevo')}</button>
        <button class="btn btn-secondary" id="btn-salir">${t('exito.btn_salir')}</button>
      </div>
    </div>
  `;

  container.querySelector('#btn-nuevo').addEventListener('click', () => {
    sessionStorage.removeItem('dg_last_parte_resumen');
    resetParte();          // ← Phase 6 fix: limpia el estado del parte antes de ir al selector
    navigate('selector');
  });

  container.querySelector('#btn-salir').addEventListener('click', () => {
    sessionStorage.removeItem('dg_last_parte_resumen');
    resetParte();
    if (state.user?.rol === 'admin') {
      navigate('admin');
    } else {
      navigate('selector');
    }
  });
}
