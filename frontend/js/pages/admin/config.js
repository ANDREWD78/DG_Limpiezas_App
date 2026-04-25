// ─── Admin: Config ─────────────────────────────────────────────────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';

export async function renderConfigPage(container, state) {
    const cfg = state.config || await api.config().catch(() => ({}));

    const objetivos = cfg.objetivos_json || {};
    const pisos = Object.keys(objetivos);

    container.innerHTML = `
    <div class="section-header"><h2>Configuración actual</h2></div>
    <div class="card">
      <div class="resumen-stat">
        <span class="label">Temporada activa</span>
        <strong class="value" style="text-transform:capitalize;">${cfg.temporada || '—'}</strong>
      </div>
      <div class="resumen-stat">
        <span class="label">Umbral de tiempo (factor)</span>
        <strong class="value">×${cfg.umbral_factor || '1.3'}</strong>
      </div>
      <div class="resumen-stat">
        <span class="label">Consumibles catalogados</span>
        <span class="value" style="font-size:.8rem;text-align:right;max-width:55%;">
          ${Array.isArray(cfg.consumibles_catalogo) ? cfg.consumibles_catalogo.join(' · ') : '—'}
        </span>
      </div>
    </div>

    <div class="section-header mt-16"><h2>Tiempos objetivo (min)</h2></div>
    ${pisos.map(piso => {
        const obj = objetivos[piso];
        return `
        <div class="card">
          <div class="card-title">${piso}</div>
          ${obj.cambio ? Object.entries(obj.cambio).map(([k, v]) =>
            `<div class="resumen-stat"><span class="label">Cambio ${k}</span><strong class="value">${v} min</strong></div>`
        ).join('') : ''}
          ${obj.revision ? `<div class="resumen-stat"><span class="label">Revisión</span><strong class="value">${obj.revision} min</strong></div>` : ''}
          ${obj.profunda ? `<div class="resumen-stat"><span class="label">Profunda</span><strong class="value">${obj.profunda} min</strong></div>` : ''}
        </div>
      `;
    }).join('')}

    <div class="card mt-16" style="border-color:rgba(59,130,246,0.3);">
      <div class="card-title">ℹ️ Cómo modificar la configuración</div>
      <p style="font-size:.85rem;color:var(--text-muted);line-height:1.6;">
        Abre la pestaña <strong style="color:var(--text)">Config</strong> en Google Sheets y edita los valores directamente.
        La app los cargará automáticamente en el siguiente inicio de sesión.
      </p>
      <a href="https://docs.google.com/spreadsheets/d/${cfg._sheetId || '1nfhWbsIpLpdOD75XLZY4XR7SUWrtukfW06GBHEWNuY4'}"
         target="_blank" class="btn btn-secondary btn-sm mt-12" style="width:auto;display:inline-flex;">
        📊 Abrir Google Sheets
      </a>
    </div>

    <button class="btn btn-primary mt-16" id="btn-reload-config">🔄 Recargar configuración</button>
  `;

    container.querySelector('#btn-reload-config').addEventListener('click', async () => {
        try {
            state.config = await api.config();
            toast('Configuración actualizada ✅', 'success');
            renderConfigPage(container, state);
        } catch (err) {
            toast('Error al cargar: ' + err.message, 'error');
        }
    });
}
