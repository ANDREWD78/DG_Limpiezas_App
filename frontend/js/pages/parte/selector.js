// ─── Selector: Casa + Acción — v3 ─────────────────────────────────────────
// Phase 3: join-session banner removed — each person always creates own parte
// Phase 4: consumibles integrated as action within tipo-grid
// Phase 5: fixed raw HTML tag bug (spaces in tag names)
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { loadParteFromOpen } from '../../app.js';
import { DG_ICON } from '../login.js';
import { openModalIncidencia } from '../../components/partHeader.js';
import { CASA_ICON } from '../../utils/casas.js';
import { t } from '../../i18n/index.js';

const CASAS = [
  { id: 'MIRADOR', icon: CASA_ICON.MIRADOR },
  { id: 'CASON', icon: CASA_ICON.CASON },
  { id: 'GRATAL', icon: CASA_ICON.GRATAL },
];

// Tipos de parte — label se obtiene en runtime desde t()
// El campo id es el valor interno estable que se guarda en Sheets
const TIPOS = [
  { id: 'cambio',   icon: '\u2728', labelKey: 'tipo.cambio' },
  { id: 'revision', icon: '\u26a1', labelKey: 'tipo.revision' },
];

// Acciones especiales — no crean parte
const ACCION_CONSUMIBLES = { id: '_consumibles', icon: '\uD83D\uDED2', labelKey: 'accion.consumibles' };
const ACCION_INCIDENCIA  = { id: '_incidencia',  icon: '\uD83D\uDEE0\uFE0F', labelKey: 'accion.incidencia'  };

export async function renderSelector(navigate, state) {
  const container = document.getElementById('page-container');

  // Helpers robustos de comparación e identidad
  const norm = (s) => String(s || '').trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
  const normCasa = (c) => String(c || '').trim().toUpperCase();
  const isMe = (p) => {
    const uId = norm(state.user?.user_id);
    const pId = norm(p.user_id);
    if (uId && pId) return uId === pId;
    return norm(p.usuario_nombre) === norm(state.user?.nombre);
  };

  // ─── FILTRO DE CASAS PERMITIDAS ───
  let allowedHouses = ['MIRADOR', 'CASON', 'GRATAL'];
  if (state.user?.casas_permitidas) {
    const parsed = String(state.user.casas_permitidas)
      .split(',')
      .map(c => c.trim().toUpperCase())
      .filter(c => ['MIRADOR', 'CASON', 'GRATAL'].includes(c));
    if (parsed.length > 0) allowedHouses = parsed;
  }
  if (state.user?.rol === 'admin') allowedHouses = ['MIRADOR', 'CASON', 'GRATAL'];

  // ─── BLOQUEO DE INTERFAZ: Carga estricta de estado antes de pintar ───
  container.innerHTML = `
    <div class="app-header">
      <div class="logo">
        <div style="width:28px;height:28px;flex-shrink:0;">${DG_ICON}</div>
        <span>${t('selector.titulo')}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn-logout" disabled style="opacity:0.6;">${t('selector.cargando')}</button>
      </div>
    </div>
    <div style="display:flex;justify-content:center;padding:80px;">
      <div class="loading-spinner"></div>
    </div>
  `;

  if (state.user?.rol === 'admin') {
    try {
      state.allOpenParts = await api.partesAbiertos().catch(() => []);
      // Auto-rellenar state.partes con los propios del admin usando helper robusto
      state.partes = state.allOpenParts.filter(isMe);
    } catch (e) { 
      console.error('[SELECTOR] Error loading admin open parts:', e);
      state.allOpenParts = []; 
      state.partes = [];
    }
  } else {
    try {
      console.log(`[SELECTOR_FETCH] Disparando red a api.openParte() para [${state.user?.nombre}] a las ${new Date().toISOString()}`);
      const openRes = await api.openParte();
      console.log(`[SELECTOR_RESPONSE] JSON integro recibido del servidor:`, JSON.stringify(openRes));
      
      if (openRes.partes && Array.isArray(openRes.partes)) {
        state.partes = openRes.partes;
      } else if (openRes.parte) {
        state.partes = [openRes.parte];
      } else {
        state.partes = [];
      }
      
      if (openRes.parte) {
        loadParteFromOpen(openRes.parte, openRes.stale || false);
      }
    } catch (e) {
      console.error('[SELECTOR] Error loading worker open parts:', e);
      state.partes = [];
    }
  }

  const preselected = state.parte.casa;
  const preSelectedTipo = state.parte.tipo;

  // Determinar si mostrar las acciones desde el principio (si hay casa preseleccionada)
  const showAcciones = !!preselected;

  container.innerHTML = `
    <div class="app-header">
      <div class="logo">
        <div style="width:28px;height:28px;flex-shrink:0;">${DG_ICON}</div>
        <span>${t('selector.titulo')}</span>
      </div>
      <div style="display:flex;gap:8px;align-items:center;">
        <button class="btn-logout" id="btn-calendario">${t('selector.reservas')}</button>
        ${state.user?.rol === 'admin' ? `<button class="btn-logout" id="btn-admin">${t('selector.admin')}</button>` : ''}
        <button class="btn-logout" id="btn-logout">${t('selector.salir')}</button>
      </div>
    </div>

    <div class="page" style="padding-bottom:100px;">

      <!-- Saludo discreto -->
      <p style="font-size:.85rem;color:var(--text-muted);font-weight:600;margin-bottom:14px;padding:0 2px;">
        👋 ${t('selector.hola')} <strong style="color:var(--text);">${state.user?.nombre || ''}</strong>
      </p>

      <div class="section-header"><h2>${t('selector.que_casa')}</h2></div>
      <div class="piso-grid" id="casa-grid">
        ${CASAS.filter(c => allowedHouses.includes(c.id)).map(c => {
          const casaId = normCasa(c.id);
          const propios = (state.partes || []).filter(p => normCasa(p.casa) === casaId);
          propios.sort((a, b) => {
            if (a.status === 'ABIERTO' && b.status !== 'ABIERTO') return -1;
            if (b.status === 'ABIERTO' && a.status !== 'ABIERTO') return 1;
            return (b.inicio_ts || '').localeCompare(a.inicio_ts || '');
          });
          const blockContent = propios.map(p => {
            const raw = norm(p.tipo_limpieza || p.tipo || '');
            const fallback = p.tipo_limpieza || p.tipo || 'Limpieza';
            // Etiqueta visual traducida (valor interno 'cambio'/'revision' no cambia)
            const sNombre = raw.includes('cambio') ? t('tipo.cambio') : raw.includes('revision') ? t('tipo.revision') : fallback;
            const strTipo = sNombre ? `${sNombre} · ` : '';
            return `
            <div class="estado-abierto" data-ts="${p.ultimo_reanudar_ts || p.inicio_ts}" data-segs="${p.tiempo_efectivo_seg || 0}" data-status="${p.status}" style="text-align:right;">
              <div style="font-size:.65rem;font-weight:800;color:var(--primary);text-transform:uppercase;line-height:1.1;letter-spacing:-.04em;">
                 <span style="color:var(--text-muted);font-weight:600;margin-right:2px;">${strTipo}</span>${p.status === 'PAUSADO' ? t('estado.pausado') : t('estado.en_marcha')}
              </div>
              <div class="estado-tiempo" style="font-size:.8rem;font-variant-numeric:tabular-nums;font-weight:800;color:var(--text-muted);line-height:1.1;">-- min</div>
              <button class="btn btn-continuar-directo" data-casa="${c.id}" 
                      style="margin-top:6px; width:100%; font-size:0.75rem; font-weight:700; padding:5px 0; border-radius:6px; color:${p.status === 'PAUSADO' ? 'var(--warning-dark, #b45309)' : 'var(--primary)'}; background:var(--bg-surface); border:1px solid currentColor;">
                ${p.status === 'PAUSADO' ? t('btn.reanudar') : t('btn.continuar')}
              </button>
            </div>
          `}).join('');
          
          const block = propios.length > 0 ? `
            <div style="display:flex; flex-direction:column; gap:6px; margin-left:auto;">
              ${blockContent}
            </div>
          ` : '';

          // ─── ADMIN: Otros partes abiertos en esta casa ─────────────────────
          let adminFooter = '';
          if (state.user?.rol === 'admin' && Array.isArray(state.allOpenParts)) {
            // Excluir los partes propios del admin en el recuento del pie
            const otrosAbiertos = state.allOpenParts.filter(p => normCasa(p.casa) === casaId && !isMe(p));
            
            if (otrosAbiertos.length > 0) {
              const lineas = otrosAbiertos.map(p => {
                const icon = p.status === 'PAUSADO' ? '⏸' : '▶';
                const rawTipo = norm(p.tipo_limpieza || p.tipo || '');
                const strFallback = p.tipo_limpieza || p.tipo || 'Limpieza';
                // Etiqueta admin siempre en español
                const strTipo = rawTipo.includes('cambio') ? 'Cambio' : rawTipo.includes('revision') ? 'Revisión' : strFallback;
                
                return `<span class="admin-part-timer" data-ts="${p.ultimo_reanudar_ts || p.inicio_ts}" data-segs="${p.tiempo_efectivo_seg || 0}" data-status="${p.status}">
                  ${p.usuario_nombre || '—'} · ${strTipo} · ${icon} <small class="at-val">--</small>
                </span>`;
              }).join(' | ');
              adminFooter = `<div style="grid-column: 1 / -1; margin-top: 10px; padding-top: 8px; border-top: 1px solid var(--border); 
                                      font-size: 0.7rem; color: var(--text-muted); font-weight: 500;
                                      white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block;">
                ${lineas}
              </div>`;
            }
          }

          return `
            <div class="piso-card piso-${c.id} ${preselected === c.id ? 'selected' : ''}" data-casa="${c.id}" 
                 style="display:grid; grid-template-columns: auto 1fr auto; align-items: center;">
              <div class="piso-icon">${c.icon}</div>
              <div class="piso-info"><h3>${c.id}</h3></div>
              ${block}
              ${adminFooter}
            </div>
          `;
        }).join('')}
      </div>

      <!-- Acciones: solo visibles cuando hay casa seleccionada -->
      <div id="acciones-wrap" style="${showAcciones ? '' : 'display:none;'}">
        <div class="section-header mt-24"><h2>${t('selector.que_hacer')}</h2></div>
        <div style="display:flex;flex-direction:column;gap:10px;" id="tipo-grid">
          <!-- Se renderiza dinámicamente -->
        </div>
      </div>

    </div>

    <div class="bottom-actions">
      <button class="btn btn-primary" id="btn-siguiente" disabled>${t('selector.empezar')} →</button>
    </div>
  `;

  let timerInterval = null;

  function updateTimers() {
    // 1. Timers de estado principal (Usuaria actual)
    container.querySelectorAll('.estado-abierto').forEach(el => {
      const s = calcularSegundos(el);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      el.querySelector('.estado-tiempo').textContent = h > 0 ? `${h} h ${m} min` : `${m} min`;
    });

    // 2. Timers ADMIN (Todos los usuarios)
    container.querySelectorAll('.admin-part-timer').forEach(el => {
      const s = calcularSegundos(el);
      const h = Math.floor(s / 3600);
      const m = Math.floor((s % 3600) / 60);
      el.querySelector('.at-val').textContent = h > 0 ? `${h}h ${m}m` : `${m}m`;
    });
  }

  function calcularSegundos(el) {
    if (!el.dataset.renderTs) {
      el.dataset.renderTs = Date.now();
    }
    const renderTs = parseInt(el.dataset.renderTs);
    const backendSegs = parseInt(el.dataset.segs) || 0;
    const status = el.dataset.status;
    let s = backendSegs;
    if (status !== 'PAUSADO') {
      s += Math.floor((Date.now() - renderTs) / 1000);
    }
    return Math.max(0, s);
  }

  function renderTipoGrid() {
    let gridHTML = '';
    
    // 1. Determinar si existe parte prioritario para la casa seleccionada
    let pPrioritario = null;
    if (casaSel) {
      const casaSelN = normCasa(casaSel);
      const propios = (state.partes || []).filter(p => normCasa(p.casa) === casaSelN);
      propios.sort((a, b) => {
        if (a.status === 'ABIERTO' && b.status !== 'ABIERTO') return -1;
        if (b.status === 'ABIERTO' && a.status !== 'ABIERTO') return 1;
        return (b.inicio_ts || '').localeCompare(a.inicio_ts || '');
      });
      pPrioritario = propios[0];
    }

    // 2. Construir la lista de acciones a renderizar
    if (pPrioritario) {
      // SI HAY PARTE: Tarjeta de continuación eliminada, solo auxiliares y Pausar Todos
      const hasAbierta = (state.partes || []).some(p => p.status === 'ABIERTO');
      
      if (hasAbierta) {
        gridHTML += `
          <div class="piso-card tipo-row" data-tipo="_pausar_todos" style="border-left: 3px solid var(--warning); background: rgba(245, 158, 11, 0.05);">
            <div class="piso-icon">⏸️</div>
            <div class="piso-info">
              <h3 style="color: var(--warning-dark, #b45309);">${t('pausar_todos.titulo')}</h3>
              <p style="font-size: .8rem; color: var(--text-muted); font-weight: 500; margin-top: 4px;">${t('pausar_todos.desc')}</p>
            </div>
          </div>
        `;
      }

      // Añadimos las acciones especiales manualmente
      [ACCION_CONSUMIBLES, ACCION_INCIDENCIA].forEach(t_item => {
        gridHTML += `
          <div class="piso-card tipo-row" data-tipo="${t_item.id}">
             <div class="piso-icon">${t_item.icon}</div>
             <div class="piso-info"><h3>${t(t_item.labelKey)}</h3></div>
          </div>
        `;
      });

    } else {
      // NO HAY PARTE: Comportamiento clásico
      gridHTML = [...TIPOS, ACCION_CONSUMIBLES, ACCION_INCIDENCIA].map(t_item => {
        return `
          <div class="piso-card tipo-row${tipoSel === t_item.id ? ' selected' : ''}" data-tipo="${t_item.id}">
            <div class="piso-icon">${t_item.icon}</div>
            <div class="piso-info"><h3>${t(t_item.labelKey)}</h3></div>
          </div>
        `;
      }).join('');
    }

    container.querySelector('#tipo-grid').innerHTML = gridHTML;
    updateTimers();
  }

  let casaSel = preselected || null;
  let tipoSel = preSelectedTipo || null;
  // Phase 3: joinCSI kept for server-side CSI grouping but no longer shown to user
  let joinCSI = null;

  function updateSiguiente() {
    const isSpecial = tipoSel === '_consumibles' || tipoSel === '_incidencia';
    const btn = container.querySelector('#btn-siguiente');
    const bottomActions = container.querySelector('.bottom-actions');

    let pPrioritario = null;
    if (casaSel) {
      const casaSelN = normCasa(casaSel);
      const propios = (state.partes || []).filter(p => normCasa(p.casa) === casaSelN);
      propios.sort((a, b) => {
        if (a.status === 'ABIERTO' && b.status !== 'ABIERTO') return -1;
        if (b.status === 'ABIERTO' && a.status !== 'ABIERTO') return 1;
        return (b.inicio_ts || '').localeCompare(a.inicio_ts || '');
      });
      pPrioritario = propios[0];
    }

    if (pPrioritario) {
      // Si hay un parte activo o pausado, escondemos el contenedor inferior por completo
      bottomActions.style.display = 'none';
      btn.disabled = true;
    } else {
      // Si no hay parte activo en la casa, exhibimos el botón
      bottomActions.style.display = '';
      btn.disabled = !(casaSel && tipoSel && !isSpecial);
      btn.textContent = t('selector.empezar');
    }
  }

  function showAccionesWrap() {
    container.querySelector('#acciones-wrap').style.display = '';
  }

  // Phase 3: silently store CSI for the server (no join prompt shown to user)
  async function checkSessionCSI(casa) {
    try {
      const res = await api.activeSession(casa);
      if (res.found) {
        joinCSI = res.cleaning_session_id || res.session_id;
      } else {
        joinCSI = null;
      }
    } catch { joinCSI = null; }
  }

  // Restore visual state if preselected
  if (casaSel) {
    container.querySelector(`[data-casa="${casaSel}"]`)?.classList.add('selected');
    checkSessionCSI(casaSel);
  }
  
  renderTipoGrid();
  updateSiguiente();
  timerInterval = setInterval(updateTimers, 1000);

  // selectTipo se llama más abajo, tras definirla

  // Casa selection
  async function triggerContinuar(casaId, btnEle) {
    if (!casaId) return;
    btnEle.style.pointerEvents = 'none';
    btnEle.style.opacity = '0.7';

    function getDestino(p) {
      const rawTipo = String(p.tipo_limpieza || p.tipo || '').toLowerCase();
      if (rawTipo.includes('cambio')) {
        // SIMPLIFICACION: Saltar nivel de suciedad y checklist
        // const sucVal = p.suciedad !== undefined ? p.suciedad : p.suciedad_1a5;
        // const suc = parseInt(sucVal);
        // if ([1, 2, 3, 4, 5].includes(suc)) return 'checklist';
        return 'fotos';
      }
      return (rawTipo.includes('revision') || rawTipo.includes('revisión')) ? 'revision' : 'fotos';
    }

    const casaN = normCasa(casaId);
    const propios = (state.partes || []).filter(p => normCasa(p.casa) === casaN);
    propios.sort((a, b) => {
      if (a.status === 'ABIERTO' && b.status !== 'ABIERTO') return -1;
      if (b.status === 'ABIERTO' && a.status !== 'ABIERTO') return 1;
      return (b.inicio_ts || '').localeCompare(a.inicio_ts || '');
    });
    const pAb = propios[0];
    
    if (pAb) {
      try {
        if (pAb.status === 'PAUSADO') {
          toast(t('selector.toast.reanudando'), 'info');
          await api.reanudarParte(pAb.id);
          const openRes = await api.openParte();
          state.partes = openRes.partes || [];
          const reanudado = state.partes.find(x => x.id === pAb.id);
          if (reanudado) {
              loadParteFromOpen(reanudado);
              Object.assign(state.parte, reanudado);
          }
        } else {
          loadParteFromOpen(pAb);
          Object.assign(state.parte, pAb);
        }
        if (typeof timerInterval !== 'undefined') clearInterval(timerInterval);
        navigate(getDestino(state.parte));
      } catch (err) {
        toast(t('selector.error_reanudar') + err.message, 'error');
        btnEle.style.pointerEvents = '';
        btnEle.style.opacity = '1';
      }
    } else {
      btnEle.style.pointerEvents = '';
      btnEle.style.opacity = '1';
    }
  }

  container.querySelector('#casa-grid').addEventListener('click', (e) => {
    const btnContinuar = e.target.closest('.btn-continuar-directo');
    if (btnContinuar) {
      e.stopPropagation();
      triggerContinuar(btnContinuar.dataset.casa, btnContinuar);
      return;
    }

    const card = e.target.closest('.piso-card');
    if (!card) return;
    const nuevaCasa = card.dataset.casa;
    // Solo borrar la bandera si el usuario cambia a una casa distinta de la preseleccionada
    casaSel = nuevaCasa;
    container.querySelectorAll('.piso-card').forEach(c => c.classList.remove('selected'));
    card.classList.add('selected');
    showAccionesWrap();
    // Si había tipo seleccionado de otra casa, resetear
    tipoSel = null;
    renderTipoGrid();
    joinCSI = null;
    checkSessionCSI(casaSel);
    updateSiguiente();
  });


  // Tipo / acción selection
  function selectTipo(id) {
    tipoSel = id;
    container.querySelectorAll('[data-tipo]').forEach(r => {
      r.classList.toggle('selected', r.dataset.tipo === id);
    });
  }

  // Restore visual state si hay tipo preseleccionado
  if (tipoSel && tipoSel !== '_consumibles' && tipoSel !== '_incidencia') selectTipo(tipoSel);

  container.querySelector('#tipo-grid').addEventListener('click', async (e) => {
    const row = e.target.closest('[data-tipo]');
    if (!row) return;
    const tipo = row.dataset.tipo;

    if (tipo === '_pausar_todos') {
      const btn = row;
      btn.style.pointerEvents = 'none';
      btn.style.opacity = '0.7';
      try {
        toast(t('selector.toast.pausando'), 'info');
        const abiertas = (state.partes || []).filter(p => p.status === 'ABIERTO');
        await Promise.all(abiertas.map(p => api.pausarParte(p.id)));
        
        const openRes = await api.openParte();
        state.partes = openRes.partes || (openRes.parte ? [openRes.parte] : []);
        if (openRes.parte) loadParteFromOpen(openRes.parte, openRes.stale || false);
        
        toast(t('selector.toast.pausados'), 'success');
        navigate('selector');
      } catch (err) {
        toast(t('selector.error_pausar') + err.message, 'error');
        btn.style.pointerEvents = '';
        btn.style.opacity = '1';
      }
      return;
    }

    if (tipo === '_consumibles') {
      if (!casaSel) { toast(t('selector.toast.selecciona_casa'), 'error'); return; }
      state.parte.casa = casaSel;
      clearInterval(timerInterval);
      navigate('consumibles-rapidos');
      return;
    }

    if (tipo === '_incidencia') {
      if (!casaSel) { toast(t('selector.toast.selecciona_casa'), 'error'); return; }
      // Abro el modal. Le paso el "state" con la casa seleccionada.
      openModalIncidencia({ parte: { casa: casaSel } }, (success) => {
        // Al cerrar el modal, quito la selección visual de la acción (si la hubiera)
      });
      return;
    }

    selectTipo(tipo);
    updateSiguiente();
  });

  // Empezar
  container.querySelector('#btn-siguiente').addEventListener('click', async () => {
    state.parte.casa = casaSel;
    state.parte.tipo = tipoSel;

    const btn = container.querySelector('#btn-siguiente');
    btn.disabled = true; btn.textContent = '…';


    // Helper: intentar iniciarParte una vez y devolver el resultado
    const intentar = () => api.iniciarParte({
      casa: casaSel, tipo_limpieza: tipoSel,
      cleaning_session_id: joinCSI || undefined,
    });

    // Helper: procesar una respuesta exitosa
    const procesarExito = (res) => {
      state.parte.id = res.id;
      state.parte.session_id = res.session_id;
      state.parte.cleaning_session_id = res.cleaning_session_id;
      state.parte.inicio_ts = res.inicio_ts;
      state.parte.status = 'ABIERTO';
      // Actualizar state.partes[] si existe (modo dual)
      if (Array.isArray(state.partes)) {
        state.partes = state.partes.filter(p => p.status !== 'ABIERTO' || p.casa === casaSel);
        state.partes.push({ id: res.id, casa: casaSel, tipo: tipoSel, status: 'ABIERTO', inicio_ts: res.inicio_ts });
      }
      clearInterval(timerInterval);
      if (tipoSel === 'revision') navigate('revision');
      else navigate('fotos');
    };

    try {
      let res = await intentar();

      // ── 409: parte propio ya abierto (caso normal) ──────────────────────
      if (res.open && !res.sabayes) {
        if (!res.parte?.id) {
          console.error('[selector] 409 sin parte.id válido:', res);
          toast('Ya tienes un parte abierto. Recarga la app para continuar.', 'error');
          btn.disabled = false; btn.textContent = 'Empezar →';
          return;
        }
        toast('Tienes un parte activo en esta casa. Usa "Continuar parte".', 'info');
        loadParteFromOpen(res.parte);
        const openRes = await api.openParte();
        state.partes = openRes.partes || (openRes.parte ? [openRes.parte] : []);
        renderTipoGrid();
        updateSiguiente();
        btn.disabled = false; btn.textContent = 'Empezar →';
        return;
      }

      // ── 409: excepción Sabayés ───────────────────────────────────────────
      // El backend ya garantiza la consistencia; si llega 409 sabayes es un conflicto real.
      if (res.sabayes) {
        btn.disabled = false; btn.textContent = 'Empezar →';
        mostrarModalSabayes(res, casaSel);
        return;
      }

      // ── Éxito en el primer intento ───────────────────────────────────────
      procesarExito(res);

    } catch (err) {
      toast(t('selector.error_iniciar') + err.message, 'error');
      btn.disabled = false; btn.textContent = t('selector.empezar') + ' →';
    }
  });


  // ── Modal Sabayés: explica la situación y ofrece ir a pausar ─────────────
  function mostrarModalSabayes(res, casaDestino) {
    // Validar que activo tiene un ID real antes de continuar
    const parteActivo = res.activo;
    if (!parteActivo?.id) {
      console.error('[selector] Sabâyes sin activo.id válido:', res);
      toast('Error al detectar tu parte activo. Recarga la app e inténtalo otra vez.', 'error');
      return;
    }
    const casaActiva = parteActivo.casa || '—';
    const casaIcon = { MIRADOR: '🏔️', CASON: '🏡', GRATAL: '🌿' };

    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:500;
      display:flex;align-items:flex-end;justify-content:center;
      background:rgba(0,0,0,.6);padding:0;
    `;
    overlay.innerHTML = `
      <div style="background:var(--bg-surface);border-radius:20px 20px 0 0;
                  padding:28px 20px 40px;width:100%;max-width:480px;
                  border-top:1px solid var(--border);text-align:center;">

        <div style="font-size:2.4rem;margin-bottom:8px;">⏸</div>

        <h3 style="font-size:1.1rem;font-weight:800;margin:0 0 10px;">
          ${t('sabayes.titulo', { activa: casaActiva })}
        </h3>

        <p style="font-size:.88rem;color:var(--text-muted);line-height:1.6;margin:0 0 20px;">
          ${t('sabayes.desc', { activa: casaActiva, destino: casaDestino })}
        </p>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <button id="sabayes-ir-pausar" class="btn btn-primary"
                  style="font-size:1rem;padding:16px;">
            ${t('sabayes.btn_pausar', { activa: casaActiva })}
          </button>
          <button id="sabayes-cancelar" class="btn btn-secondary"
                  style="font-size:.9rem;">
            ${t('sabayes.btn_cancelar')}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    overlay.querySelector('#sabayes-cancelar').addEventListener('click', () => {
      overlay.remove();
    });

    overlay.querySelector('#sabayes-ir-pausar').addEventListener('click', async () => {
      overlay.remove();
      const btnSig = container.querySelector('#btn-siguiente');
      if (btnSig) { btnSig.disabled = true; btnSig.textContent = t('selector.iniciando'); }
      
      try {
        toast(`Pausando \${casaActiva} y empezando \${casaDestino}...`, 'info');
        await api.pausarParte(parteActivo.id);
        
        // Tras pausar con éxito, reintentamos iniciar el nuevo parte
        const res2 = await api.iniciarParte({
            casa: casaDestino, 
            tipo_limpieza: tipoSel,
            cleaning_session_id: joinCSI || undefined,
        });
        
        state.parte.id = res2.id;
        state.parte.session_id = res2.session_id;
        state.parte.cleaning_session_id = res2.cleaning_session_id;
        state.parte.inicio_ts = res2.inicio_ts;
        state.parte.status = 'ABIERTO';
        
        if (Array.isArray(state.partes)) {
            const oldIndex = state.partes.findIndex(p => p.id === parteActivo.id);
            if(oldIndex >= 0) state.partes[oldIndex].status = 'PAUSADO';
            state.partes.push({ id: res2.id, casa: casaDestino, tipo: tipoSel, status: 'ABIERTO', inicio_ts: res2.inicio_ts });
        }
        
        clearInterval(timerInterval);
        navigate(tipoSel === 'revision' ? 'revision' : 'fotos');
        
      } catch(err) {
        toast(t('selector.error_reasignar') + err.message, 'error');
        if (btnSig) { btnSig.disabled = false; btnSig.textContent = t('selector.empezar') + ' →'; }
        
        const openRes = await api.openParte().catch(() => ({}));
        state.partes = openRes.partes || [];
        renderTipoGrid();
        updateSiguiente();
      }
    });
  }

  container.querySelector('#btn-calendario')?.addEventListener('click', () => {
    clearInterval(timerInterval);
    navigate('calendario');
  });

  container.querySelector('#btn-logout')?.addEventListener('click', async () => {
    clearInterval(timerInterval);
    await api.logout().catch(() => { });
    state.user = null;
    state.partes = [];
    state.allOpenParts = [];
    navigate('login');
  });

  container.querySelector('#btn-admin')?.addEventListener('click', () => {
    clearInterval(timerInterval);
    navigate('admin');
  });
}
