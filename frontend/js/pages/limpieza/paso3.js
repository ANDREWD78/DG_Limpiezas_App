// ─── Paso 3: Resumen + Confirmar + Enviar ──────────────────────────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { resetLimpieza } from '../../app.js';
import { timeMadrid } from '../../utils/time.js';

export function renderPaso3(navigate, state) {
    const container = document.getElementById('page-container');
    const { piso, tipo, personas, horaInicio, tiempoObjetivo, checklist, fotos, consumibles, incidencia } = state.limpieza;

    const horaFin = timeMadrid();
    const [hI, mI] = horaInicio.split(':').map(Number);
    const [hF, mF] = horaFin.split(':').map(Number);
    const tiempoReal = Math.max(1, (hF * 60 + mF) - (hI * 60 + mI));
    const dentroTiempo = tiempoReal <= tiempoObjetivo;
    const doneCount = checklist.filter(t => t.done).length;
    const pctDone = Math.round((doneCount / checklist.length) * 100);

    const consUsados = Object.entries(consumibles).filter(([, v]) => v > 0);

    container.innerHTML = `
    <div class="app-header">
      <div class="logo">
        <span style="font-size:1.3rem">${piso === 'MIRADOR' ? '🏔️' : piso === 'CASON' ? '🏡' : '🌿'}</span>
        <span>Resumen · ${piso}</span>
      </div>
    </div>

    <div class="page" style="padding-bottom:90px;">
      <div class="step-progress">
        <div class="step-dot done"></div>
        <div class="step-dot done"></div>
        <div class="step-dot active"></div>
        <span class="step-label">Paso 3 de 3 — Confirmar</span>
      </div>

      <!-- Resumen principal -->
      <div class="card">
        <div class="card-title">Resumen de la limpieza</div>
        <div class="resumen-stat">
          <span class="label">Alojamiento</span>
          <strong class="value">${piso}${personas ? ` · ${personas}p` : ''}</strong>
        </div>
        <div class="resumen-stat">
          <span class="label">Tipo</span>
          <strong class="value">${tipo.charAt(0).toUpperCase() + tipo.slice(1)}</strong>
        </div>
        <div class="resumen-stat">
          <span class="label">Horario</span>
          <span class="value">${horaInicio} → ${horaFin}</span>
        </div>
        <div class="resumen-stat">
          <span class="label">Tiempo real</span>
          <span class="tiempo-badge ${dentroTiempo ? 'tiempo-ok' : 'tiempo-mal'}">
            ${dentroTiempo ? '✅' : '⚠️'} ${tiempoReal} min
            ${dentroTiempo ? '' : `(+${tiempoReal - tiempoObjetivo} min sobre objetivo)`}
          </span>
        </div>
        <div class="resumen-stat">
          <span class="label">Tareas completadas</span>
          <span class="value">${doneCount}/${checklist.length} (${pctDone}%)</span>
        </div>
        <div class="resumen-stat">
          <span class="label">Fotos</span>
          <span class="value">${fotos.length} foto${fotos.length !== 1 ? 's' : ''}</span>
        </div>
        ${consUsados.length > 0 ? `
        <div class="resumen-stat" style="flex-direction:column;align-items:flex-start;gap:4px;">
          <span class="label">Consumibles usados</span>
          <span class="value" style="font-size:.85rem;color:var(--text-muted)">
            ${consUsados.map(([k, v]) => `${k}: ${v}`).join(' · ')}
          </span>
        </div>` : ''}
      </div>

      ${incidencia ? `
      <div class="card" style="border-color:rgba(239,68,68,0.4);">
        <div class="card-title">🔴 Incidencia reportada</div>
        <p style="font-size:.9rem;">${incidencia.descripcion}</p>
      </div>` : ''}

      <!-- Fotos preview -->
      ${fotos.length > 0 ? `
      <div class="card">
        <div class="card-title">📷 Fotos adjuntas</div>
        <div class="foto-grid">
          ${fotos.map((f, i) => `<img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="foto ${i + 1}"/>`).join('')}
        </div>
      </div>` : ''}

      <!-- Notas -->
      <div class="card">
        <div class="card-title">📝 Notas adicionales (opcional)</div>
        <textarea class="notas" id="notas-input" placeholder="Algún comentario extra..." rows="3">${state.limpieza.notas || ''}</textarea>
      </div>
    </div>

    <div class="bottom-actions">
      <button class="btn btn-secondary" id="btn-back" style="max-width:100px;">← Atrás</button>
      <button class="btn btn-success w-full" id="btn-enviar">
        <span id="btn-enviar-text">✅ Confirmar y enviar</span>
      </button>
    </div>
  `;

    container.querySelector('#btn-back').addEventListener('click', () => navigate('paso2'));

    container.querySelector('#btn-enviar').addEventListener('click', async () => {
        const notas = container.querySelector('#notas-input').value.trim();
        state.limpieza.notas = notas;
        const btn = container.querySelector('#btn-enviar');
        const txt = container.querySelector('#btn-enviar-text');
        btn.disabled = true;
        txt.textContent = '⏳ Enviando...';

        try {
            const fd = new FormData();
            fd.append('piso', piso);
            fd.append('tipo', tipo);
            fd.append('personas', personas || '');
            fd.append('horaInicio', horaInicio);
            fd.append('horaFin', horaFin);
            fd.append('tiempoObjetivo', tiempoObjetivo);
            fd.append('notas', notas);
            fotos.forEach(f => fd.append('fotos', f));

            await api.crearLimpieza(fd);

            // Incidencia por separado si existe
            if (incidencia) {
                const fdInc = new FormData();
                fdInc.append('piso', piso);
                fdInc.append('descripcion', incidencia.descripcion);
                await api.crearIncidencia(fdInc);
            }

            // Consumibles
            const consUsados = Object.entries(consumibles).filter(([, v]) => v > 0);
            await Promise.all(consUsados.map(([producto, cantidad]) =>
                api.registrarConsumo({ piso, producto, cantidad })
            ));

            toast('¡Limpieza registrada con éxito! 🎉', 'success', 4000);
            resetLimpieza();

            // Pantalla de éxito
            container.innerHTML = `
        <div style="display:flex;flex-direction:column;align-items:center;justify-content:center;min-height:100dvh;padding:32px;text-align:center;gap:24px;">
          <div style="font-size:4rem;">🎉</div>
          <h2 style="font-size:1.5rem;font-weight:800;">¡Limpieza registrada!</h2>
          <p style="color:var(--text-muted);">Los datos se han guardado en Google Sheets${fotos.length > 0 ? ' y las fotos en Drive' : ''}.</p>
          ${incidencia ? '<p style="color:var(--danger);">⚠️ Incidencia notificada al equipo.</p>' : ''}
          <button class="btn btn-primary" id="btn-nueva" style="max-width:280px;">✨ Nueva Limpieza</button>
        </div>
      `;
            container.querySelector('#btn-nueva').addEventListener('click', () => navigate('paso1'));
        } catch (err) {
            toast('Error al enviar: ' + err.message, 'error', 5000);
            btn.disabled = false;
            txt.textContent = '✅ Confirmar y enviar';
        }
    });
}
