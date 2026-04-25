// ─── Pantalla: Partes abiertos — rediseño UX v2 ────────────────────────────
// Aparece post-PIN si hay ≥1 parte abierto o pausado.
// Lógica de pausa/reanuda/Sabayés: intacta del código anterior.
// Solo cambia el render visual.
import { api } from '../api.js';
import { toast } from '../components/toast.js';
import { CASA_ICON } from '../utils/casas.js';

const TIPO_LABEL = {
  revision: 'Revisión rápida', cambio: 'Cambio de huéspedes',
  profunda: 'Limpieza profunda', 'post-incidencia': 'Post-incidencia',
};
const SABAYES_SWAP = { MIRADOR: 'CASON', CASON: 'MIRADOR' };

export async function renderReanudar(navigate, state) {
  const container = document.getElementById('page-container');

  // ── Re-sincronizar estado desde backend al entrar ─────────────────────────
  try {
    const openRes = await api.openParte();
    if (!openRes.open) { navigate('selector'); return; }
    state.partes = openRes.partes || [];
    const principal = state.partes.find(p => p.status === 'ABIERTO') || state.partes[0];
    if (principal) Object.assign(state.parte, principal);
  } catch {
    console.warn('[reanudar] openParte() falló — usando state existente');
  }

  let timerInterval = null;
  let renderTs = 0;
  let tiempoBaseSeg = 0;

  function fmtSegCrono(seg) {
    const s = Math.max(0, Math.floor(seg));
    const hh = Math.floor(s / 3600);
    const mm = Math.floor((s % 3600) / 60);
    const ss = s % 60;
    const mm2 = String(mm).padStart(2, '0');
    const ss2 = String(ss).padStart(2, '0');
    return hh > 0 ? `${hh}:${mm2}:${ss2}` : `${mm2}:${ss2}`;
  }

  function cronometroDesde(tiempoActualSeg, ts) {
    return fmtSegCrono(tiempoActualSeg + Math.floor((Date.now() - ts) / 1000));
  }

  // ── Cabecera con Salir rojo en esquina derecha ────────────────────────────
  function cabeceraHTML() {
    return `
      <div class="app-header">
        <div class="logo" style="flex:1;">
          <img src="img/logo-dg-icono.svg" alt="DG" width="28" height="28" style="display:block;">
        </div>
        <button id="hdr-reservas" class="hdr-btn" style="color:var(--info);font-size:.74rem;padding:6px 8px;">📅 Reservas</button>
        <button id="hdr-salir" class="hdr-btn" style="color:var(--danger);">Salir</button>
      </div>
      <div style="padding:16px 20px 8px;">
        <h1 style="font-size:1.3rem;font-weight:800;margin:0 0 2px;line-height:1.2;">
          ▶️ Tus partes abiertos
        </h1>
        <p style="font-size:.9rem;color:var(--text-muted);margin:0;">Vamos a seguir 💪</p>
      </div>
    `;
  }

  // ── Píldora de estado ─────────────────────────────────────────────────────
  function estadoPill(isPausado) {
    return isPausado
      ? `<span style="display:inline-flex;align-items:center;gap:5px;
                      background:rgba(239,68,68,.15);color:#f87171;
                      border-radius:99px;padding:4px 10px;
                      font-size:.72rem;font-weight:700;letter-spacing:.04em;">
           ⏸ En pausa
         </span>`
      : `<span style="display:inline-flex;align-items:center;gap:5px;
                      background:rgba(34,197,94,.15);color:var(--success);
                      border-radius:99px;padding:4px 10px;
                      font-size:.72rem;font-weight:700;letter-spacing:.04em;">
           ● En marcha
         </span>`;
  }

  // ── Footer fijo: solo Añadir consumibles ─────────────────────────────────
  function accionesFijasHTML() {
    return `
      <div style="position:fixed;bottom:0;left:0;right:0;z-index:100;
                  background:var(--bg);border-top:1px solid var(--border);
                  padding:12px 20px calc(12px + env(safe-area-inset-bottom, 0px));">
        <button class="btn btn-secondary" id="btn-consumibles"
                style="font-size:.9rem;padding:13px;color:var(--text-muted);width:100%;">
          🛒 Añadir consumibles
        </button>
      </div>
    `;
  }

  // Logout real desde header → vuelve al PIN
  function bindCabecera() {
    container.querySelector('#hdr-reservas')?.addEventListener('click', () => {
      clearInterval(timerInterval);
      navigate('calendario');
    });
    container.querySelector('#hdr-salir')?.addEventListener('click', async () => {
      clearInterval(timerInterval);
      await api.logout().catch(() => { });
      state.user = null;
      navigate('login');
    });
  }


  function bindAccionesFijas() {
    container.querySelector('#btn-consumibles')?.addEventListener('click', () => {
      clearInterval(timerInterval);
      navigate('consumibles-rapidos');
    });
  }

  // Helper para decidir si ir a Inicio (suciedad) o Checklist directamente
  function getDestino(p) {
    if (p.tipo === 'cambio') {
      const suc = parseInt(p.suciedad);
      if ([1, 2, 3, 4, 5].includes(suc)) {
        return 'checklist';
      }
    }
    return p.tipo === 'revision' ? 'revision' : 'inicio';
  }

  // ── Elegir modo de render ─────────────────────────────────────────────────
  function render() {
    clearInterval(timerInterval);
    const partes = state.partes?.length ? state.partes : [state.parte];
    if (partes.length >= 2) renderDual(partes);
    else renderSimple(partes[0] || state.parte);
  }


  // ══════════════════════════════════════════════════════════════════════════
  // MODO SIMPLE — 1 parte (ABIERTO o PAUSADO)
  // ══════════════════════════════════════════════════════════════════════════
  function renderSimple(parte) {
    if (!parte) { navigate('selector'); return; }
    const isPausado = parte.status === 'PAUSADO';
    const icon = CASA_ICON[parte.casa] || '🏠';
    const tipoLabel = TIPO_LABEL[parte.tipo] || parte.tipo || '—';
    const casaSwap = SABAYES_SWAP[parte.casa] || null;

    container.innerHTML = `
      ${cabeceraHTML()}

      <div style="padding:12px 20px 140px;display:flex;flex-direction:column;gap:10px;">

        <!-- Tarjeta del parte -->
        <div style="background:var(--bg-surface);
                    border:1.5px solid ${isPausado ? 'rgba(239,68,68,.35)' : 'rgba(34,197,94,.35)'};
                    border-radius:16px;padding:16px;">
          <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:1.8rem;">${icon}</span>
              <div>
                <div style="font-weight:800;font-size:1rem;">${parte.casa}</div>
                <div style="font-size:.78rem;color:var(--text-muted);">${tipoLabel}</div>
              </div>
            </div>
            ${estadoPill(isPausado)}
          </div>
          <div style="font-size:1.8rem;font-weight:800;font-variant-numeric:tabular-nums;
                      color:${isPausado ? '#f87171' : 'var(--success)'};letter-spacing:.01em;">
            <span id="resume-timer">${fmtSegCrono(parte.tiempo_efectivo_seg ?? 0)}</span>
          </div>
        </div>

        <!-- Acción principal -->
        <button class="btn btn-primary" id="btn-continuar"
                style="font-size:1rem;padding:16px;">
          ▶ Seguir en ${parte.casa}
        </button>

        ${casaSwap ? `
        <button class="btn btn-secondary" id="btn-otra-casa"
                style="font-size:.95rem;padding:14px 16px;
                       border-color:var(--primary);color:var(--primary);
                       display:flex;flex-direction:column;align-items:center;gap:2px;">
          <span>+ Abrir parte en ${casaSwap}</span>
          <span style="font-size:.7rem;font-weight:400;opacity:.8;">
            ${isPausado ? 'Puedes empezar en ' + casaSwap + ' directamente' : parte.casa + ' se pausará automáticamente'}
          </span>
        </button>` : ''}

      </div><!-- fin contenido scrollable -->

      <!-- Footer fijo -->
      ${accionesFijasHTML()}
    `;

    // Cronómetro en vivo solo si ABIERTO
    if (!isPausado) {
      const tsBaseReal = new Date(parte.ultimo_reanudar_ts || parte.inicio_ts).getTime();
      const segundosDelBackend = parte.tiempo_efectivo_seg ?? 0;
      
      // Conservamos las variables locales de reanudar.js para que funcionen los botones de pausa
      renderTs = tsBaseReal;
      tiempoBaseSeg = Math.max(0, segundosDelBackend - Math.floor((Date.now() - tsBaseReal) / 1000));
      
      timerInterval = setInterval(() => {
        const el = document.getElementById('resume-timer');
        if (el) el.textContent = cronometroDesde(tiempoBaseSeg, renderTs);
      }, 1000);
    }

    bindCabecera();
    bindSimple(parte, isPausado, casaSwap);
    bindAccionesFijas();
  }

  function bindSimple(parte, isPausado, casaSwap) {
    // Seguir en la casa actual
    container.querySelector('#btn-continuar')?.addEventListener('click', async () => {
      clearInterval(timerInterval);
      if (isPausado) {
        // Reanudar antes de entrar al flujo
        const btn = container.querySelector('#btn-continuar');
        btn.disabled = true; btn.textContent = '⏳ Reanudando…';
        try {
          await api.reanudarParte(parte.id);
          const openRes = await api.openParte();
          state.partes = openRes.partes || [];
          const reanudado = state.partes.find(p => p.id === parte.id);
          if (reanudado) Object.assign(state.parte, reanudado);
        } catch (err) {
          toast('Error al reanudar: ' + err.message, 'error');
          btn.disabled = false; btn.textContent = `▶ Seguir en ${parte.casa}`;
          return;
        }
      } else {
        Object.assign(state.parte, parte);
      }
      navigate(getDestino(state.parte));
    });

    // Abrir en otra casa (Sabayés)
    if (casaSwap) {
      container.querySelector('#btn-otra-casa')?.addEventListener('click', async () => {
        const btn = container.querySelector('#btn-otra-casa');
        btn.disabled = true;

        try {
          // Si el parte actual está ABIERTO → pausarlo antes de abrir en la otra casa
          if (!isPausado) {
            btn.textContent = '⏳ Pausando…';
            await api.pausarParte(parte.id);
            clearInterval(timerInterval);
            const tiempoCongeladoSeg = tiempoBaseSeg + Math.floor((Date.now() - renderTs) / 1000);
            state.parte.status = 'PAUSADO';
            state.parte.tiempo_efectivo_seg = tiempoCongeladoSeg;
            state.partes = (state.partes || []).map(p =>
              p.id === parte.id
                ? { ...p, status: 'PAUSADO', tiempo_efectivo_seg: tiempoCongeladoSeg }
                : p
            );
          }

          // ¿Ya hay parte pausado en casaSwap? → reanudar directamente
          const parteSwap = (state.partes || []).find(
            p => p.casa === casaSwap && p.status === 'PAUSADO'
          );

          if (parteSwap) {
            btn.textContent = '⏳ Reanudando…';
            await api.reanudarParte(parteSwap.id);
            const openRes = await api.openParte();
            state.partes = openRes.partes || [];
            const reanudado = state.partes.find(p => p.id === parteSwap.id);
            if (reanudado) Object.assign(state.parte, reanudado);
            navigate(getDestino(state.parte));
          } else {
            // No hay parte en casaSwap → mostrar popup para elegir tipo
            mostrarPopupTipo(casaSwap);
          }
        } catch (err) {
          toast('Error: ' + err.message, 'error');
          btn.disabled = false;
          btn.textContent = `+ Abrir parte en ${casaSwap}`;
        }
      });
    }
  }


  // ══════════════════════════════════════════════════════════════════════════
  // POPUP — Elegir tipo para la nueva casa
  // ══════════════════════════════════════════════════════════════════════════
  function mostrarPopupTipo(casa) {
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position:fixed;inset:0;z-index:500;
      display:flex;align-items:flex-end;justify-content:center;
      background:rgba(0,0,0,.6);
    `;
    overlay.innerHTML = `
      <div style="background:var(--bg-surface);border-radius:20px 20px 0 0;
                  padding:24px 20px 40px;width:100%;max-width:480px;
                  border-top:1px solid var(--border);">

        <p style="font-size:.72rem;font-weight:700;letter-spacing:.08em;text-transform:uppercase;
                  color:var(--primary);margin:0 0 4px;">
          ${CASA_ICON[casa] || '🏠'} ${casa}
        </p>
        <h3 style="font-size:1.05rem;font-weight:800;margin:0 0 18px;">
          ¿Qué tipo de parte?
        </h3>

        <div style="display:flex;flex-direction:column;gap:10px;">
          <button class="btn btn-primary" id="popup-cambio" style="font-size:1rem;padding:16px;">
            🔄 Cambio de huéspedes
          </button>
          <button class="btn btn-secondary" id="popup-revision" style="font-size:1rem;padding:16px;">
            🔍 Revisión rápida
          </button>
          <button id="popup-cancelar"
                  style="background:none;border:none;color:var(--text-muted);
                         font-size:.85rem;font-family:inherit;cursor:pointer;padding:12px;text-align:center;">
            Cancelar
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    async function iniciarEnCasa(tipo) {
      overlay.remove();
      state.parte.casa = casa;
      state.parte.tipo = tipo;

      try {
        const res = await api.iniciarParte({ casa, tipo_limpieza: tipo });
        state.parte.id = res.id;
        state.parte.session_id = res.session_id;
        state.parte.cleaning_session_id = res.cleaning_session_id;
        state.parte.inicio_ts = res.inicio_ts;
        state.parte.status = 'ABIERTO';
        state.parte.tiempo_efectivo_seg = 0; // Inicializar a 0 por seguridad
        navigate(getDestino(state.parte));
      } catch (err) {
        toast('Error al iniciar parte: ' + err.message, 'error');
        render(); // volver a la pantalla inicial
      }
    }

    overlay.querySelector('#popup-cambio').addEventListener('click', () => iniciarEnCasa('cambio'));
    overlay.querySelector('#popup-revision').addEventListener('click', () => iniciarEnCasa('revision'));
    overlay.querySelector('#popup-cancelar').addEventListener('click', () => {
      overlay.remove();
      // Reactivar botón si se cancela
      const btn = container.querySelector('#btn-otra-casa');
      if (btn) { btn.disabled = false; btn.textContent = `+ Abrir parte en ${casa}`; }
    });
  }


  // ══════════════════════════════════════════════════════════════════════════
  // MODO DUAL — 2 partes (Sabayés)
  // ══════════════════════════════════════════════════════════════════════════
  function renderDual(partes) {
    container.innerHTML = `
      ${cabeceraHTML()}

      <div style="padding:12px 20px 140px;display:flex;flex-direction:column;gap:10px;">
        ${partes.map(p => tarjetaDualHTML(p)).join('')}
        <p style="font-size:.75rem;color:var(--text-muted);text-align:center;
                  margin:4px 0 0;line-height:1.4;">
          No se pueden abrir más partes ahora.
        </p>
      </div>

      ${accionesFijasHTML()}
    `;

    // Cronómetro en vivo para el ABIERTO
    const abierto = partes.find(p => p.status !== 'PAUSADO');
    if (abierto) {
      const tsBaseReal = new Date(abierto.ultimo_reanudar_ts || abierto.inicio_ts).getTime();
      const segundosDelBackend = abierto.tiempo_efectivo_seg ?? 0;
      
      const rTs = tsBaseReal;
      const tBase = Math.max(0, segundosDelBackend - Math.floor((Date.now() - tsBaseReal) / 1000));
      
      timerInterval = setInterval(() => {
        const el = document.getElementById(`timer-${abierto.id}`);
        if (el) el.textContent = cronometroDesde(tBase, rTs);
      }, 1000);
    }

    bindCabecera();
    bindDual(partes);
    bindAccionesFijas();
  }

  function tarjetaDualHTML(p) {
    const isPausado = p.status === 'PAUSADO';
    const icon = CASA_ICON[p.casa] || '🏠';
    const tipoLabel = TIPO_LABEL[p.tipo] || p.tipo || '—';

    return `
      <div style="background:var(--bg-surface);
                  border:1.5px solid ${isPausado ? 'rgba(239,68,68,.35)' : 'rgba(34,197,94,.35)'};
                  border-radius:16px;padding:16px;">

        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <div style="display:flex;align-items:center;gap:10px;">
            <span style="font-size:1.8rem;">${icon}</span>
            <div>
              <div style="font-weight:800;font-size:1rem;">${p.casa}</div>
              <div style="font-size:.78rem;color:var(--text-muted);">${tipoLabel}</div>
            </div>
          </div>
          ${estadoPill(isPausado)}
        </div>

        <div style="font-size:1.5rem;font-weight:800;font-variant-numeric:tabular-nums;
                    color:${isPausado ? '#f87171' : 'var(--success)'};margin-bottom:12px;">
          <span id="timer-${p.id}">${fmtSegCrono(p.tiempo_efectivo_seg ?? 0)}</span>
        </div>

        <button class="btn ${isPausado ? 'btn-secondary' : 'btn-primary'} btn-parte-accion"
                data-id="${p.id}" data-casa="${p.casa}" data-pausado="${isPausado}"
                style="font-size:.95rem;padding:14px;
                       ${!isPausado ? '' : 'border-color:var(--primary);color:var(--primary);'}">
          ${isPausado ? `▶ Seguir en ${p.casa}` : `▶ Continuar en ${p.casa}`}
        </button>
      </div>
    `;
  }

  function bindDual(partes) {
    container.querySelectorAll('.btn-parte-accion').forEach(btn => {
      btn.addEventListener('click', async () => {
        const p = partes.find(x => x.id === btn.dataset.id);
        if (!p) return;
        const isPausado = btn.dataset.pausado === 'true';
        btn.disabled = true;
        btn.textContent = '⏳ Espera…';

        try {
          if (isPausado) {
            // Reanudar parte pausado → backend auto-pausa el otro
            await api.reanudarParte(p.id);
            const openRes = await api.openParte();
            state.partes = openRes.partes || [];
            const reanudado = state.partes.find(x => x.id === p.id);
            if (reanudado) Object.assign(state.parte, reanudado);
            clearInterval(timerInterval);
            navigate(getDestino(state.parte));
          } else {
            // Continuar en el parte abierto directamente
            clearInterval(timerInterval);
            Object.assign(state.parte, p);
            navigate(getDestino(p));
          }
        } catch (err) {
          toast('Error: ' + err.message, 'error');
          btn.disabled = false;
          btn.textContent = isPausado ? `▶ Seguir en ${p.casa}` : `▶ Continuar en ${p.casa}`;
        }
      });
    });
  }

  // Arrancar
  render();
}
