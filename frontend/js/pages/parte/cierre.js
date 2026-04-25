// ─── Cambio de huéspedes — P5 Cierre (casa lista + consumibles + enviar) ────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { resetParte } from '../../app.js';
import { headerHTML, bindHeader } from '../../components/partHeader.js';
import { CASA_ICON } from '../../utils/casas.js';
import { t } from '../../i18n/index.js';
import { tConsumible } from '../../utils/incidencias.js';

const URG_LABEL = () => ({
  Normal:  t('urgencia.normal'),
  Urgente: t('urgencia.urgente'),
});



export function renderCierre(navigate, state) {
  const container = document.getElementById('page-container');
  const { casa, tipo, id, session_id, inicio_ts, suciedad,
    fotosCierre, fotosAntes, checklistCambio } = state.parte;
  const temporada = state.config?.temporada || 'entretiempo';
  const icon = CASA_ICON[casa] || '🏠';
  const fotoCount = Object.values(fotosCierre).reduce((a, arr) => a + arr.length, 0);
  const nInc = state.parte._incidenciasCount || 0;

  let casaLista = null;
  let consActivo = false;
  let consLoaded = false;

  container.innerHTML = `
    ${headerHTML(`${icon} \uD83D\uDEAA Cierre \u00b7 ${casa}`, casa, state)}
    <div class="page" style="padding-bottom:120px;">

      <div class="step-progress" style="margin:16px 0;">
        <div class="step-dot done"></div><div class="step-dot done"></div>
        <div class="step-dot done"></div><div class="step-dot active"></div>
        <span class="step-label">${t('cierre.paso')}</span>
      </div>

      <!-- Resumen rápido -->
      <div class="card" style="margin-bottom:16px;">
        <div class="card-title">${t('cierre.resumen')}</div>
        <div class="resumen-stat"><span class="label">${t('cierre.resumen.tipo')}</span><strong>${t('cierre.tipo_cambio')}</strong></div>
        <div class="resumen-stat"><span class="label">${t('cierre.resumen.suciedad')}</span><strong>${suciedad || '\u2014'}/5</strong></div>
        <div class="resumen-stat"><span class="label">${t('cierre.resumen.fotos')}</span><strong>${fotoCount}</strong></div>
        ${nInc > 0 ? `<div class="resumen-stat"><span class="label">${t('cierre.resumen.incidencias')}</span><span style="color:var(--warning);">${t(nInc !== 1 ? 'cierre.resumen.incidencias_n_plural' : 'cierre.resumen.incidencias_n', { n: nInc })}</span></div>` : ''}
      </div>

      <!-- A) Casa lista -->
      <div class="section-header"><h2>${t('cierre.estado_final')}</h2></div>
      <div class="card">
        <div class="form-group">
          <label class="form-label">${t('cierre.casa_lista')}</label>
          <div style="display:flex;gap:10px;">
            <button class="btn btn-secondary btn-sm" id="cl-si" style="flex:1;">${t('cierre.si_lista')}</button>
            <button class="btn btn-secondary btn-sm" id="cl-no" style="flex:1;">${t('cierre.no_lista')}</button>
          </div>
        </div>
        <p id="no-lista-aviso" style="display:none;font-size:.78rem;color:var(--text-muted);
                                       margin-top:8px;line-height:1.4;">
          ${t('cierre.aviso_no_lista')}
        </p>
      </div>

      <!-- B) Consumibles -->
      <div class="section-header mt-16"><h2>${t('cierre.consumibles')}</h2></div>
      <div class="card">
        <label class="form-label">${t('cierre.falta_consumible')}</label>
        <div style="display:flex;gap:10px;margin-bottom:12px;">
          <button class="btn btn-secondary btn-sm" id="cons-no" style="flex:1;">${t('cierre.cons_no')}</button>
          <button class="btn btn-secondary btn-sm" id="cons-si" style="flex:1;">${t('cierre.cons_si')}</button>
        </div>
        <div id="cons-lista" class="hidden">
          <div id="cons-items"><div class="loading-spinner" style="margin:8px auto;"></div></div>
        </div>
      </div>

      <!-- C) Observaciones -->
      <div class="section-header mt-16"><h2>${t('cierre.observaciones')}</h2></div>
      <div class="card">
        <textarea class="notas" id="observaciones" rows="3"
          placeholder="${t('cierre.obs_placeholder')}">${state.parte.resumen || ''}</textarea>
      </div>

    </div>

    <div class="bottom-actions">
      <button class="btn btn-success w-full" id="btn-enviar" style="font-size:1.05rem;" disabled>
        ${t('cierre.btn_enviar')}
      </button>
    </div>
  `;
  bindHeader(container, navigate, state);

  // Casa lista toggles
  container.querySelector('#cl-si').addEventListener('click', () => {
    casaLista = 'Sí';
    container.querySelector('#cl-si').className = 'btn btn-success btn-sm'; container.querySelector('#cl-si').style.flex = '1';
    container.querySelector('#cl-no').className = 'btn btn-secondary btn-sm'; container.querySelector('#cl-no').style.flex = '1';
    container.querySelector('#falta-wrap')?.classList.add('hidden');
    container.querySelector('#no-lista-aviso').style.display = 'none';
    container.querySelector('#btn-enviar').disabled = false;
  });
  container.querySelector('#cl-no').addEventListener('click', () => {
    casaLista = 'No';
    container.querySelector('#cl-si').className = 'btn btn-secondary btn-sm'; container.querySelector('#cl-si').style.flex = '1';
    container.querySelector('#cl-no').className = 'btn btn-danger btn-sm'; container.querySelector('#cl-no').style.flex = '1';
    container.querySelector('#no-lista-aviso').style.display = '';
    container.querySelector('#btn-enviar').disabled = false;
  });

  // Scroll automático al textare de Observaciones al recibir foco (evita que el teclado lo tape)
  const obsEl = container.querySelector('#observaciones');
  if (obsEl) obsEl.addEventListener('focus', () => obsEl.scrollIntoView({ behavior: 'smooth', block: 'center' }));

  // Consumibles toggles
  function markConsBtn(si) {
    container.querySelector('#cons-no').className = si ? 'btn btn-secondary btn-sm' : 'btn btn-success btn-sm';
    container.querySelector('#cons-no').style.flex = '1';
    container.querySelector('#cons-si').className = si ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
    container.querySelector('#cons-si').style.flex = '1';
  }
  container.querySelector('#cons-no').addEventListener('click', () => {
    consActivo = false; markConsBtn(false);
    container.querySelector('#cons-lista').classList.add('hidden');
  });
  container.querySelector('#cons-si').addEventListener('click', () => {
    consActivo = true; markConsBtn(true);
    container.querySelector('#cons-lista').classList.remove('hidden');
    if (!consLoaded) {
      consLoaded = true;
      api.catalogoConsumo(casa).then(list => {
        const catalogoHTML = list.map(item => `
          <div style="display:flex;align-items:center;justify-content:space-between;
                      padding:8px 0;border-bottom:1px solid var(--border);">
            <label style="display:flex;align-items:center;gap:10px;cursor:pointer;flex:1;">
              <input type="checkbox" class="cons-check" data-item="${item}"
                     style="width:18px;height:18px;accent-color:var(--primary);flex-shrink:0;"/>
              <span style="font-size:.88rem;">${tConsumible(item)}</span>
            </label>
            <select class="form-select" data-urg="${item}"
                    style="width:90px;padding:4px 8px;font-size:.78rem;margin-left:8px;">
              ${['Normal', 'Urgente'].map(u =>
          `<option value="${u}" ${u === 'Normal' ? 'selected' : ''}>${URG_LABEL()[u]}</option>`).join('')}
            </select>
          </div>
        `).join('');

        // Bloque multi-Otro
        const otroSecHTML = `
          <div id="otro-wrap" style="padding:10px 0 0;border-top:1px solid var(--border);margin-top:6px;">
            <div style="font-size:.8rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;">${t('cierre.no_catalogados')}</div>
            <div id="otro-list"></div>
            <button type="button" id="btn-add-otro" class="btn btn-secondary btn-sm"
                    style="width:100%;margin-top:8px;font-size:.82rem;">
              ${t('cierre.btn_add_otro')}
            </button>
          </div>`;

        container.querySelector('#cons-items').innerHTML =
          (catalogoHTML || `<p class="text-muted">${t('cierre.no_catalogo')}</p>`) + otroSecHTML;
        // Mejorar tap-target de checkboxes y selects de urgencia en el catálogo
        container.querySelectorAll('.cons-check').forEach(cb => {
          cb.style.width = '22px'; cb.style.height = '22px'; cb.style.minWidth = '22px';
        });
        container.querySelectorAll('[data-urg]').forEach(sel => {
          sel.style.fontSize = '.85rem'; sel.style.padding = '7px 8px';
        });

        container.querySelector('#btn-add-otro').addEventListener('click', () => addOtroRow());
      }).catch(err => {
        console.error('[cierre] error cargando catálogo:', err);
        container.querySelector('#cons-items').innerHTML = '<p class="text-muted">—</p>';
      });
    }
  });

  /** Añade una fila dinámica de consumible "Otro" */
  let _otroIdx = 0;
  function addOtroRow(defaultText = '', defaultUrg = 'Normal') {
    const idx = _otroIdx++;
    const row = document.createElement('div');
    row.className = 'otro-row';
    row.dataset.idx = idx;
    row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
    row.innerHTML =
      '<input type="text" class="form-input otro-txt" placeholder="' + t('cierre.que_falta_placeholder') + '" value="' + defaultText + '"' +
      ' style="flex:1;font-size:.82rem;padding:6px 10px;"/>' +
      '<select class="form-select otro-urg" style="width:80px;padding:4px 6px;font-size:.78rem;">' +
      ['Normal', 'Urgente'].map(u =>
        `<option value="${u}" ${u === defaultUrg ? 'selected' : ''}>${URG_LABEL()[u]}</option>`
      ).join('') +
      '</select>' +
      '<button type="button" class="btn btn-danger btn-sm otro-del" style="width:32px;padding:0;flex-shrink:0;font-size:1rem;">&#x2715;</button>';
    row.querySelector('.otro-del').addEventListener('click', () => row.remove());
    container.querySelector('#otro-list')?.appendChild(row);
  }

  // ENVIAR
  container.querySelector('#btn-enviar').addEventListener('click', async () => {
    const btn = container.querySelector('#btn-enviar');

    // Validaciones
    if (!casaLista) { toast(t('cierre.error_casa_lista'), 'error'); return; }
    const faltaText = '';

    btn.disabled = true; btn.textContent = t('cierre.enviando');

    try {
      // 1. (Las incidencias ya se registraron en tiempo real vía modal global)

      // 2. Consumibles del catálogo
      const consumiblesItems = consActivo
        ? [...container.querySelectorAll('.cons-check:checked')].map(cb => ({
          item: cb.dataset.item,
          urgencia: container.querySelector('[data-urg="' + cb.dataset.item + '"]')?.value || 'Normal',
        }))
        : [];

      // Consumibles "Otro" múltiples
      const otroItems = [];
      if (consActivo) {
        const seenTexts = new Set();
        container.querySelectorAll('#otro-list .otro-row').forEach(row => {
          const txt = row.querySelector('.otro-txt')?.value.trim();
          const urg = row.querySelector('.otro-urg')?.value || 'Normal';
          if (!txt) return;
          if (seenTexts.has(txt.toLowerCase())) {
            toast('"' + txt + t('cierre.duplicado_ignorado'), 'warning', 3500);
            return;
          }
          seenTexts.add(txt.toLowerCase());
          otroItems.push({ txt, urg });
          consumiblesItems.push({ item: 'Otro', item_otro: txt, urgencia: urg });
        });
      }

      if (consumiblesItems.length) {
        await api.registrarConsumo({ parte_id: id, session_id, casa, items: consumiblesItems });
      }

      // Propuestas para cada Otro (no bloquea el parte, pero informa si falla)
      if (otroItems.length) {
        const tipo_limpieza = tipo || state.parte.tipo || '';
        const propErrors = [];
        await Promise.all(otroItems.map(async ({ txt, urg }) => {
          try {
            await api.crearPropuesta({ propuesta_texto: txt, casa, tipo_limpieza, urgencia: urg });
          } catch (propErr) {
            console.error('[cierre] crearPropuesta falló para "' + txt + '":', propErr);
            propErrors.push(txt);
          }
        }));
        if (propErrors.length) {
          toast(t('cierre.propuesta_warning', { items: propErrors.join(', ') }), 'warning', 7000);
        }
      }

      // 3. Finalizar parte
      const obs = container.querySelector('#observaciones').value.trim();
      const resumen = obs || (casaLista === 'Sí' ? 'Cambio completado. Casa lista.' : `Casa no lista: ${faltaText}`);
      const checkJson = JSON.stringify(checklistCambio || {});

      const fd = new FormData();
      fd.append('resumen', resumen);
      fd.append('pendiente', faltaText || 'Ninguno');
      fd.append('ropa_sucia_estado', '');
      fd.append('lena_rellenada', state.parte.lena || '');
      fd.append('pellets_rellenado', state.parte.pellets || '');
      fd.append('casa_lista', casaLista);
      fd.append('casa_lista_falta_texto', faltaText);
      fd.append('tiene_incidencia', (state.parte._incidenciasCount || 0) > 0 ? 'true' : 'false');
      fd.append('suciedad_1a5', suciedad || '');
      fd.append('checklist_json', checkJson);
      fd.append('tareas_realizadas', '');
      fd.append('tareas_periodicas_json',
        JSON.stringify(state.parte.tareasPeriodicasSeleccion || []));

      // Fotos cierre por slot
      Object.entries(fotosCierre).forEach(([zona, files]) => {
        files.forEach(f => fd.append('fotos_cierre', new File([f], `${zona}_${f.name}`, { type: f.type })));
      });
      (fotosAntes || []).forEach(f => fd.append('fotos_antes', f));

      await api.finalizarParte(id, fd);

      // 4. Guardar resumen para exito.js
      const totalFotos = fotoCount;
      sessionStorage.setItem('dg_last_parte_resumen', JSON.stringify({
        casa, tipo: tipo || 'cambio',
        limpiador_nombre: state.user?.nombre || '',
        casaLista,
        fotosCount: totalFotos,
      }));

      state.parte._fotosCount = totalFotos;
      resetParte();
      navigate('exito');

    } catch (err) {
      toast(t('cierre.error_enviar') + err.message, 'error', 6000);
      btn.disabled = false; btn.textContent = t('cierre.btn_enviar');
    }
  });
}
