// ─── Revisión rápida v4 — 3 pantallas ultra-simple ───────────────────────────
// Pantalla 1: Pregunta principal (Todo OK / Falta algo)
// Pantalla 2: Extras combinados (consumibles + incidencia + qué falta si procede)
// Pantalla 3: Confirmación final → Enviar parte (1 toque)
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { headerHTML, bindHeader } from '../../components/partHeader.js';
import { CASA_ICON } from '../../utils/casas.js';
import { CATEGORIAS_INCIDENCIA, getUbicaciones, tCat, tUbi, tConsumible } from '../../utils/incidencias.js';
import { t, currentLang } from '../../i18n/index.js';

// Urgencia visual (value guardado = español estable)
const URG_LABEL = () => ({ Normal: t('urgencia.normal'), Urgente: t('urgencia.urgente') });


// ─── Estado local del flujo (no tocar state.parte hasta envío) ───────────────
// casaLista: true | false | null
// consumibles: [{item, urgencia}]
// incidencia: {cat, ubi, desc, fotos[]} | null
// queFlata: string

// ─── Componente ──────────────────────────────────────────────────────────────
export function renderRevision(navigate, goBack, state) {
  const container = document.getElementById('page-container');
  const { casa, id, session_id, inicio_ts } = state.parte;
  const icon = CASA_ICON[casa] || '✨';

  // Flujo local — persistido entre pantallas (no se pierde con goBack)
  const flujo = {
    casaLista: null,          // true / false
    incFotos: [],             // solo imágenes
    incVideo: null,           // un único vídeo (File)
    incPrioridad: null,
    consumiblesSeleccionados: [], // [{item, urgencia}]
    queFlataText: '',
    observaciones: '',
  };

  // ─── Pantalla 1: Pregunta principal ─────────────────────────────────────────
  function showPantalla1() {
    container.innerHTML = `
      ${headerHTML(`\u26a1 ${t('revision.titulo_p1')} · ${casa}`, casa, state, true)}
      <div class="page" style="padding-bottom:32px;">
        <div class="card" style="border-color:var(--primary);background:rgba(59,130,246,.07);
             text-align:center;padding:32px 20px;margin-top:16px;">
          <div style="font-size:2.2rem;margin-bottom:16px;">\uD83D\uDD11</div>
          <p style="font-size:.95rem;color:var(--text);line-height:1.6;margin-bottom:28px;">
            ${t('revision.p1_pregunta')}
          </p>
          <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
            <button class="btn btn-success" id="btn-ok"
                    style="font-size:1rem;padding:14px 28px;width:auto;">${t('revision.btn_ok')}</button>
            <button class="btn btn-danger" id="btn-falta"
                    style="font-size:1rem;padding:14px 28px;width:auto;">${t('revision.btn_falta')}</button>
          </div>
        </div>
      </div>
    `;
    bindHeader(container, navigate, state);

    container.querySelector('#btn-ok').addEventListener('click', () => {
      flujo.casaLista = true;
      showPantalla2();
    });
    container.querySelector('#btn-falta').addEventListener('click', () => {
      flujo.casaLista = false;
      showPantalla2();
    });
  }

  // ─── Pantalla 2: Extras combinados ──────────────────────────────────────────
  function showPantalla2() {
    const casaNoLista = flujo.casaLista === false;

    container.innerHTML = `
      ${headerHTML(`\uD83D\uDD0D ${t('revision.titulo_p2')} · ${casa}`, casa, state, true)}
      <div class="page" style="padding-bottom:120px;">

        ${casaNoLista ? `
        <!-- A) Qué falta (obligatorio si casa_lista=false) -->
        <div class="section-header mt-16"><h2>${t('revision.estado_casa')}</h2></div>
        <div class="card" style="border-color:rgba(239,68,68,.3);">
          <div class="form-group">
            <label class="form-label">${t('revision.que_falta_label')}</label>
            <textarea class="notas" id="que-falta" rows="2"
              placeholder="${t('revision.que_falta_placeholder')}">${flujo.queFlataText}</textarea>
          </div>
          <div class="form-group">
            <label class="form-label">${t('revision.observaciones')} <span class="text-muted">${t('revision.obs_opcional')}</span></label>
            <textarea class="notas" id="observaciones" rows="2"
              placeholder="${t('revision.obs_falta_placeholder')}">${flujo.observaciones}</textarea>
          </div>
        </div>
        ` : `
        <!-- Observaciones opcionales si todo OK -->
        <div class="section-header mt-16"><h2>${t('revision.observaciones')}</h2></div>
        <div class="card">
          <div class="form-group">
            <label class="form-label">${t('revision.observaciones')} <span class="text-muted">${t('revision.obs_opcional')}</span></label>
            <textarea class="notas" id="observaciones" rows="2"
              placeholder="${t('revision.obs_ok_placeholder')}">${flujo.observaciones}</textarea>
          </div>
        </div>
        `}

        <!-- B) Consumibles -->
        <div class="section-header mt-16">
          <h2>${t('revision.consumibles')}</h2>
        </div>
        <div class="card">
          <label class="form-label">${t('revision.falta_consumible')}</label>
          <div style="display:flex;gap:10px;margin-bottom:12px;">
            <button class="btn btn-secondary btn-sm" id="cons-no" style="flex:1;">${t('revision.cons_no')}</button>
            <button class="btn btn-secondary btn-sm" id="cons-si" style="flex:1;">${t('revision.cons_si')}</button>
          </div>
          <div id="cons-lista" class="hidden">
            <div id="cons-items"><div class="loading-spinner" style="margin:8px auto;"></div></div>
          </div>
        </div>

        <!-- C) Incidencia de mantenimiento -->
        <div class="section-header mt-16">
          <h2>${t('revision.mantenimiento')}</h2>
        </div>
        <div class="card">
          <label class="form-label">${t('revision.hay_incidencia')}</label>
          <div style="display:flex;gap:10px;margin-bottom:12px;">
            <button class="btn btn-secondary btn-sm" id="mant-no" style="flex:1;">${t('revision.mant_no')}</button>
            <button class="btn btn-secondary btn-sm" id="mant-si" style="flex:1;">${t('revision.mant_si')}</button>
          </div>
          <div id="mant-form" class="hidden">
            <div class="form-group">
              <label class="form-label">${t('revision.inc_categoria')}</label>
              <select class="form-select" id="inc-cat">
                <option value="">${t('revision.inc_selecciona')}</option>
                ${CATEGORIAS_INCIDENCIA.map(c => `<option value="${c}">${tCat(c)}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('revision.inc_ubicacion')}</label>
              <select class="form-select" id="inc-ubi">
                <option value="">${t('revision.inc_selecciona')}</option>
                ${getUbicaciones(casa).map(u => `<option value="${u}">${tUbi(u)}</option>`).join('')}
                <option value="Otro">${t('revision.inc_otro')}</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label">${t('revision.inc_prioridad')}</label>
              <div style="display:flex;gap:8px;">
                ${['Normal', 'Urgente'].map(p =>
          `<button class="btn btn-secondary btn-sm prio-btn" data-p="${p}" style="flex:1;">${URG_LABEL()[p]}</button>`
        ).join('')}
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">${t('revision.inc_desc')}</label>
              <textarea class="notas" id="inc-desc" rows="2" placeholder="${t('revision.inc_desc_placeholder')}"></textarea>
            </div>
            <div class="form-group">
              <label class="form-label">${t('revision.inc_foto')}</label>
              <div class="foto-grid" id="inc-foto-grid">
                <label class="foto-add-btn" for="inc-foto-input">
                  <span class="plus">+</span><span>${t('revision.btn_foto')}</span>
                </label>
                <input type="file" id="inc-foto-input" accept="image/*,video/*"
                       multiple style="display:none"/>
              </div>
            </div>
          </div>
        </div>

      </div><!-- /page -->

      <div class="bottom-actions">
        <button class="btn btn-success w-full" id="btn-continuar" style="font-size:1.05rem;padding:18px;">${t('revision.btn_enviar')}</button>
      </div>
    `;
    bindHeader(container, navigate, state);

    // ── Estado local de pantalla 2 ────────────────────────────────────────────
    let consActivo = false;
    let mantActivo = false;
    let consItemsLoaded = false;

    // Restaurar urgencias de sesión anterior si existen
    const urgenciasGuardadas = {};
    flujo.consumiblesSeleccionados.forEach(c => { urgenciasGuardadas[c.item] = c.urgencia; });

    // ── Consumibles toggle ────────────────────────────────────────────────────
    function markConsBtn(si) {
      container.querySelector('#cons-no').className = si ? 'btn btn-secondary btn-sm' : 'btn btn-success btn-sm';
      container.querySelector('#cons-no').style.flex = '1';
      container.querySelector('#cons-si').className = si ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
      container.querySelector('#cons-si').style.flex = '1';
    }

    container.querySelector('#cons-no').addEventListener('click', () => {
      consActivo = false;
      markConsBtn(false);
      container.querySelector('#cons-lista').classList.add('hidden');
    });

    container.querySelector('#cons-si').addEventListener('click', () => {
      consActivo = true;
      markConsBtn(true);
      container.querySelector('#cons-lista').classList.remove('hidden');
      if (!consItemsLoaded) {
        consItemsLoaded = true;
        api.catalogoConsumo(casa).then(list => {
          const catalogoHTML = list.map(item => {
            const urg = urgenciasGuardadas[item] || 'Normal';
            return `
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
              `<option value="${u}" ${u === urg ? 'selected' : ''}>${URG_LABEL()[u]}</option>`).join('')}
                </select>
              </div>
            `;
          }).join('');
          // Multi-Otro
          const otroSecHTML = '<div id="otro-wrap" style="padding:10px 0 0;border-top:1px solid var(--border);margin-top:6px;">' +
            `<div style="font-size:.8rem;font-weight:700;color:var(--text-muted);margin-bottom:6px;">${t('revision.no_catalogados')}</div>` +
            '<div id="otro-list"></div>' +
            `<button type="button" id="btn-add-otro" class="btn btn-secondary btn-sm" style="width:100%;margin-top:8px;font-size:.82rem;">` +
            `${t('revision.btn_add_otro')}</button></div>`;
          container.querySelector('#cons-items').innerHTML =
            (catalogoHTML || `<p class="text-muted" style="font-size:.85rem;">${t('revision.no_catalogo')}</p>`) + otroSecHTML;
          container.querySelector('#btn-add-otro').addEventListener('click', () => addOtroRowRev());
        }).catch(err => {
          console.error('[revision] error cargando cat\u00e1logo:', err);
          container.querySelector('#cons-items').innerHTML = '<p class="text-muted">\u2014</p>';
        });
      }
    });

    // ── addOtroRow para revisión (igual que cierre, scope local) ────────────────────
    let _otroRevIdx = 0;
    function addOtroRowRev(defaultText, defaultUrg) {
      defaultText = defaultText || ''; defaultUrg = defaultUrg || 'Normal';
      const idx = _otroRevIdx++;
      const row = document.createElement('div');
      row.className = 'otro-row';
      row.dataset.idx = idx;
      row.style.cssText = 'display:flex;align-items:center;gap:6px;margin-bottom:6px;';
      row.innerHTML =
        '<input type="text" class="form-input otro-txt" placeholder="' + t('revision.que_falta_placeholder') + '" value="' + defaultText + '"' +
        ' style="flex:1;font-size:.82rem;padding:6px 10px;"/>' +
        '<select class="form-select otro-urg" style="width:80px;padding:4px 6px;font-size:.78rem;">' +
        ['Normal', 'Urgente'].map(u =>
          `<option value="${u}" ${u === defaultUrg ? 'selected' : ''}>${URG_LABEL()[u]}</option>`
        ).join('') +
        '</select>' +
        '<button type="button" class="btn btn-danger btn-sm otro-del" style="width:32px;padding:0;flex-shrink:0;font-size:1rem;">\u2715</button>';
      row.querySelector('.otro-del').addEventListener('click', () => row.remove());
      container.querySelector('#otro-list')?.appendChild(row);
    }

    // ── Mantenimiento toggle ──────────────────────────────────────────────────
    function markMantBtn(si) {
      container.querySelector('#mant-no').className = si ? 'btn btn-secondary btn-sm' : 'btn btn-success btn-sm';
      container.querySelector('#mant-no').style.flex = '1';
      container.querySelector('#mant-si').className = si ? 'btn btn-success btn-sm' : 'btn btn-secondary btn-sm';
      container.querySelector('#mant-si').style.flex = '1';
    }

    container.querySelector('#mant-no').addEventListener('click', () => {
      mantActivo = false;
      markMantBtn(false);
      container.querySelector('#mant-form').classList.add('hidden');
    });
    container.querySelector('#mant-si').addEventListener('click', () => {
      mantActivo = true;
      markMantBtn(true);
      container.querySelector('#mant-form').classList.remove('hidden');
    });

    // ── Prioridad ─────────────────────────────────────────────────────────────
    container.addEventListener('click', e => {
      const pb = e.target.closest('.prio-btn');
      if (!pb) return;
      flujo.incPrioridad = pb.dataset.p;
      container.querySelectorAll('.prio-btn').forEach(b => {
        b.className = 'btn btn-secondary btn-sm prio-btn'; b.style.flex = '1';
      });
      pb.className = 'btn btn-primary btn-sm prio-btn'; pb.style.flex = '1';
    });

    // ── Fotos/vídeo incidencia ────────────────────────────────────────────────
    function esVideoFile(f) { return f.type.startsWith('video/'); }

    function refreshIncGrid() {
      const grid = container.querySelector('#inc-foto-grid');
      if (!grid) return;
      const n = flujo.incFotos.length;
      const fotosThumb = flujo.incFotos.map((f, i) =>
        `<img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="${i}"/>`
      ).join('');
      const videoThumb = flujo.incVideo
        ? `<div class="foto-thumb" style="display:flex;align-items:center;justify-content:center;background:#1e293b;font-size:1.8rem;" title="${flujo.incVideo.name}">🎬</div>`
        : '';
      const puedeAnadirFotos = n < 5;
      const puedeAnadirVideo = !flujo.incVideo;
      const addBtn = (puedeAnadirFotos || puedeAnadirVideo) ? `
        <label class="foto-add-btn" for="inc-foto-extra${n}">
          <span class="plus">+</span><span>${t('revision.btn_mas_fotos')}</span>
        </label>
        <input type="file" id="inc-foto-extra${n}" accept="image/*,video/*"
               ${puedeAnadirFotos ? 'multiple' : ''} style="display:none"/>
      ` : '';
      grid.innerHTML = fotosThumb + videoThumb + addBtn;
      if (puedeAnadirFotos || puedeAnadirVideo) bindFotos(`inc-foto-extra${n}`);
    }

    function bindFotos(inputId) {
      container.querySelector(`#${inputId}`)?.addEventListener('change', e => {
        Array.from(e.target.files).forEach(f => {
          if (esVideoFile(f)) {
            if (!flujo.incVideo) flujo.incVideo = f;
          } else {
            if (flujo.incFotos.length < 5) flujo.incFotos.push(f);
          }
        });
        refreshIncGrid();
      });
    }
    bindFotos('inc-foto-input');
    refreshIncGrid();


    // ── Enviar directamente desde P2 ──────────────────────────────────────────
    const btnEnviar = container.querySelector('#btn-continuar');
    btnEnviar.textContent = t('revision.btn_enviar');
    btnEnviar.className = 'btn btn-success w-full';
    btnEnviar.style.cssText = 'font-size:1.05rem;padding:18px;';

    btnEnviar.addEventListener('click', async () => {
      // Validar qué falta (obligatorio si casa no lista)
      if (casaNoLista) {
        const qt = container.querySelector('#que-falta')?.value.trim();
        if (!qt) { toast(t('revision.error_que_falta'), 'error'); return; }
        flujo.queFlataText = qt;
      }
      flujo.observaciones = container.querySelector('#observaciones')?.value.trim() || '';

      // Validar incidencia de mantenimiento
      if (mantActivo) {
        const cat = container.querySelector('#inc-cat').value;
        const ubi = container.querySelector('#inc-ubi').value;
        const desc = container.querySelector('#inc-desc').value.trim();
        if (!cat || !ubi) { toast(t('revision.error_cat_ubi'), 'error'); return; }
        if (!desc) { toast(t('revision.error_desc'), 'error'); return; }
        if (!flujo.incFotos.length && !flujo.incVideo) { toast(t('revision.error_foto'), 'error'); return; }
        flujo.incidencia = {
          cat, ubi, desc,
          prioridad: flujo.incPrioridad || 'Normal',
          fotos: flujo.incFotos,
          video: flujo.incVideo,
        };
      } else {
        flujo.incidencia = null;
        flujo.incFotos = [];
        flujo.incVideo = null;
      }

      // Recoger consumibles seleccionados
      if (consActivo) {
        flujo.consumiblesSeleccionados = [
          ...container.querySelectorAll('.cons-check:checked'),
        ].map(cb => ({
          item: cb.dataset.item,
          urgencia: container.querySelector('[data-urg="' + cb.dataset.item + '"]')?.value || 'Normal',
        }));
        // Consumibles "Otro" múltiples
        flujo.otroCapturados = [];
        const seenRev = new Set();
        container.querySelectorAll('#otro-list .otro-row').forEach(row => {
          const txt = row.querySelector('.otro-txt')?.value.trim();
          const urg = row.querySelector('.otro-urg')?.value || 'Normal';
          if (!txt || seenRev.has(txt.toLowerCase())) return;
          seenRev.add(txt.toLowerCase());
          flujo.otroCapturados.push({ txt, urg });
          flujo.consumiblesSeleccionados.push({ item: 'Otro', item_otro: txt, urgencia: urg });
        });
      } else {
        flujo.consumiblesSeleccionados = [];
        flujo.otroCapturados = [];
      }

      // ── Enviar ────────────────────────────────────────────────────────────────
      btnEnviar.disabled = true; btnEnviar.textContent = t('revision.enviando');

      try {
        // 1. Incidencia de mantenimiento (si existe)
        if (flujo.incidencia) {
          const fdInc = new FormData();
          fdInc.append('parte_id', id);
          fdInc.append('session_id', session_id);
          fdInc.append('casa', casa);
          fdInc.append('categoria', flujo.incidencia.cat);
          fdInc.append('ubicacion', flujo.incidencia.ubi);
          fdInc.append('prioridad', flujo.incidencia.prioridad);
          fdInc.append('descripcion', flujo.incidencia.desc);
          flujo.incidencia.fotos.forEach(f => fdInc.append('fotos', f));
          if (flujo.incidencia.video) fdInc.append('video', flujo.incidencia.video);
          await api.crearIncidencia(fdInc);
        }

        // 2. Consumibles
        if (flujo.consumiblesSeleccionados.length) {
          await api.registrarConsumo({
            parte_id: id, session_id, casa,
            items: flujo.consumiblesSeleccionados,
          });
        }
        // Propuestas para cada Otro — no bloquea el parte
        if ((flujo.otroCapturados || []).length) {
          const tipo_limpieza = flujo.tipo_limpieza || state.parte.tipo || '';
          const pErrors = [];
          await Promise.all(flujo.otroCapturados.map(async ({ txt, urg }) => {
            try {
              await api.crearPropuesta({ propuesta_texto: txt, casa, tipo_limpieza, urgencia: urg });
            } catch (propErr) {
              console.error('[revision] crearPropuesta falló para "' + txt + '":', propErr);
              pErrors.push(txt);
            }
          }));
          if (pErrors.length) {
            toast(t('revision.propuesta_warning', { items: pErrors.join(', ') }), 'warning', 7000);
          }
        }

        // 3. Finalizar parte
        const resumen = flujo.observaciones
          || (flujo.casaLista ? 'Revisión OK. Casa lista para entrada.' : `Casa no lista: ${flujo.queFlataText}`);

        const fd = new FormData();
        fd.append('resumen', resumen);
        fd.append('pendiente', casaNoLista ? flujo.queFlataText : 'Ninguno');
        fd.append('casa_lista', flujo.casaLista ? 'Sí' : 'No');
        fd.append('casa_lista_falta_texto', flujo.queFlataText);
        fd.append('tiene_incidencia', flujo.incidencia ? 'true' : 'false');
        fd.append('tareas_realizadas', ''); // tareas no aplican en revisión
        await api.finalizarParte(id, fd);

        // 4. Guardar resumen para exito.js
        sessionStorage.setItem('dg_last_parte_resumen', JSON.stringify({
          casa,
          tipo: state.parte.tipo || 'revision',
          limpiador_nombre: state.user?.nombre || '',
          casaLista: flujo.casaLista ? 'Sí' : 'No',
          fotosCount: flujo.incidencia ? flujo.incidencia.fotos.length : 0,
        }));

        state.parte._fotosCount = flujo.incidencia ? flujo.incidencia.fotos.length : 0;
        navigate('exito');

      } catch (err) {
        toast(t('revision.error_enviar') + err.message, 'error', 6000);
        btnEnviar.disabled = false; btnEnviar.textContent = t('revision.btn_enviar');
      }
    });
  }

  showPantalla1();
}
