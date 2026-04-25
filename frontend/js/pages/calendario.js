import { api } from '../api.js';
import { toast } from '../components/toast.js';
import { goBack } from '../app.js';
import { CASA_ICON } from '../utils/casas.js';
import { formatFechaCompleta, renderReservaHTML } from '../utils/reservas.js';
import { DG_ICON } from './login.js';

let mesVisible = 0;
let reservasData = [];
let hoyReferencia = ''; // Guardar referencia de hoy en Madrid enviada por el backend

function renderCalendarioHTML(offsetMeses, reservasBase, isAdmin = false) {
    // Si no hay hoyReferencia (ej. primera carga), fallback seguro (aunque la API debe enviarlo)
    const hoyStr = hoyReferencia || new Date().toISOString().slice(0, 10);
    const hoyParts = hoyStr.split('-');
    
    const act = new Date(hoyParts[0], hoyParts[1] - 1, hoyParts[2]);
    const currentAnyo = act.getFullYear();
    const currentMes = act.getMonth();

    const targetDate = new Date(currentAnyo, currentMes + offsetMeses, 1);
    const year = targetDate.getFullYear();
    const month = targetDate.getMonth();

    const diasMes = new Date(year, month + 1, 0).getDate();
    const diaClaveSemana = new Date(year, month, 1).getDay();
    const padding = diaClaveSemana === 0 ? 6 : diaClaveSemana - 1;

    const mesNombre = targetDate.toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });


    const minMes = isAdmin ? -1 : 0;
    const maxMes = isAdmin ? 10 : 3;

    const btnPrevState = offsetMeses <= minMes ? 'disabled style="opacity:0.3"' : '';
    const btnNextState = offsetMeses >= maxMes ? 'disabled style="opacity:0.3"' : '';

    let html = `
    <div style="background:var(--bg-surface);border-radius:12px;padding:16px;box-shadow:0 1px 3px rgba(0,0,0,0.1); border: 1px solid var(--border); margin-bottom: 24px;">
      
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h3 style="margin:0;font-size:1.1rem;text-transform:capitalize;">${mesNombre}</h3>
        <div style="display:flex;gap:4px;">
          <button id="btn-cal-prev" class="btn-outline" style="padding:6px 12px;" ${btnPrevState}>←</button>
          <button id="btn-cal-next" class="btn-outline" style="padding:6px 12px;" ${btnNextState}>→</button>
        </div>
      </div>

      <div style="display:flex;gap:10px;font-size:0.75rem;margin-bottom:16px;justify-content:center;color:var(--text-muted);font-weight:600;">
          <div style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background:#3b82f6;border-radius:50%;"></span> Mirador</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background:#10b981;border-radius:50%;"></span> Casón</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background:#f97316;border-radius:50%;"></span> Gratal</div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;text-align:center;font-size:0.75rem;font-weight:600;color:var(--text-muted);margin-bottom:8px;">
        <div>L</div><div>M</div><div>X</div><div>J</div><div>V</div><div>S</div><div>D</div>
      </div>
      
      <div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;grid-auto-rows:1fr;">
    `;

    for (let i = 0; i < padding; i++) {
        html += `<div style="background:var(--bg-card);opacity:0.5;"></div>`;
    }

    // Filter relevant days from our data
    for (let day = 1; day <= diasMes; day++) {
        const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        let slotsHtml = '';
        ['MIRADOR', 'CASON', 'GRATAL'].forEach(casa => {
            const matches = reservasBase.filter(x => x.casa === casa && x.fecha_entrada <= dStr && x.fecha_salida_visual >= dStr);
            let color = casa === 'MIRADOR' ? '#3b82f6' : casa === 'CASON' ? '#10b981' : '#f97316';
            
            if (matches.length === 0) {
                slotsHtml += `<div style="height:14px;margin:2px 0;"></div>`;
                return;
            }

            // Caso Especial 3A: Bloqueo de 1 día sobre día de salida real
            const realCheckout = matches.find(m => !m.es_bloqueo && m.fecha_salida_visual === dStr);
            const punctualBlock = matches.find(m => m.es_bloqueo && m.is1DayBlock && m.fecha_entrada === dStr);

            if (realCheckout && punctualBlock) {
                 slotsHtml += `
                  <div style="background:${color}; height:14px; margin:2px 0; position:relative; overflow:hidden; border-radius: 0 4px 4px 0; border:1px solid rgba(255,255,255,0.1);" title="Salida + Bloqueo Puntual">
                    <!-- Mitad inferior rayada -->
                    <div style="position:absolute; top:50%; inset:50% 0 0 0; background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px);"></div>
                    <!-- Línea divisoria horizontal sutil -->
                    <div style="position:absolute; top:50%; left:0; right:0; height:1px; background:rgba(255,255,255,0.15); transform:translateY(-0.5px);"></div>
                    <span style="position:absolute; top:0.5px; left:3px; font-size:5.5px; font-weight:900; color:white; text-shadow:0 0 2px rgba(0,0,0,0.5); line-height:1;">SAL</span>
                  </div>
                 `;
                 return;
            }

            // Detección de rotación real (entradas y salidas reales/multi-día que coinciden)
            const hasStart = matches.some(m => m.fecha_entrada === dStr && !m.is1DayBlock);
            const hasEnd = matches.some(m => m.fecha_salida_visual === dStr && !m.is1DayBlock);
            const isRotation = matches.length > 1 && hasStart && hasEnd;

            if (isRotation) {
                slotsHtml += `
                  <div style="background:${color}; height:14px; margin:2px 0; position:relative; overflow:hidden; border-top:1px solid rgba(255,255,255,0.1); border-bottom:1px solid rgba(255,255,255,0.1);" title="Rotación: Salida + Entrada">
                    <!-- Diagonal completa que cruza la franja -->
                    <div style="position:absolute; inset:0; background: linear-gradient(to bottom right, transparent calc(50% - 0.5px), rgba(255,255,255,0.6) 50%, transparent calc(50% + 0.5px));"></div>
                    <span style="position:absolute; top:0px; left:3px; font-size:5.5px; font-weight:900; color:white; text-shadow:0 0 2px rgba(0,0,0,0.5); line-height:1;">SAL</span>
                    <span style="position:absolute; bottom:0px; right:3px; font-size:5.5px; font-weight:900; color:white; text-shadow:0 0 2px rgba(0,0,0,0.5); line-height:1;">ENT</span>
                  </div>
                `;
                return;
            }

            // Renderizado de reserva o bloqueo normal
            const r = matches[0];
            let extraStyle = `height:14px; margin:2px 0; position:relative; `;
            
            let isStart = r.fecha_entrada === dStr;
            let isEnd = r.fecha_salida_visual === dStr;

            // 3B o estándar
            if (r.es_bloqueo && r.is1DayBlock) {
                extraStyle += `background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px), ${color}; border: 1px dashed rgba(255,255,255,0.3); width:100%; border-radius:4px; box-sizing:border-box;`;
            } else {
                if (r.es_bloqueo) {
                    extraStyle += `background: repeating-linear-gradient(45deg, transparent, transparent 3px, rgba(255,255,255,0.2) 3px, rgba(255,255,255,0.2) 6px), ${color}; border-top: 1px dashed rgba(255,255,255,0.3); border-bottom: 1px dashed rgba(255,255,255,0.3); box-sizing:border-box;`;
                } else {
                    extraStyle += `background:${color}; `;
                }
                
                if (isStart && !isEnd) {
                    extraStyle += `margin-left:50%; width:50%; border-radius: 4px 0 0 4px; ${r.es_bloqueo ? 'border-left: 1px dashed rgba(255,255,255,0.3);':''}`;
                } else if (isEnd && !isStart) {
                    extraStyle += `width:50%; border-radius: 0 4px 4px 0; ${r.es_bloqueo ? 'border-right: 1px dashed rgba(255,255,255,0.3);':''}`;
                } else if (isStart && isEnd) { // Fallback, no debería darse en reservas reales por ser estancias >= 1 noche
                    extraStyle += `width:100%; border-radius: 4px; ${r.es_bloqueo ? 'border: 1px dashed rgba(255,255,255,0.3);':''}`;
                } else {
                    extraStyle += `width:100%; border-radius:0;`; 
                }
            }

            slotsHtml += `<div style="${extraStyle}"></div>`;
        });

        // La celda entera del día es clickeable
        const isHoy = dStr === hoyStr;
        const styleHoy = isHoy ? 'border: 2px solid var(--primary); background: rgba(99, 102, 241, 0.08) !important;' : '';

        html += `<div class="cal-day-cell ${isHoy ? 'hoy' : ''}" data-date="${dStr}" style="background:var(--bg-card);padding:4px;display:flex;flex-direction:column;min-height:76px;cursor:pointer;transition:background 0.2s; ${styleHoy}">
        <div style="font-size:0.75rem;text-align:right;color:var(--text-muted);font-weight:600;">${day}</div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;pointer-events:none;">${slotsHtml}</div>
        </div>`;
    }

    html += `</div></div>`;
    return html;
}

export async function renderCalendario(navigate, state) {
    const container = document.getElementById('page-container');
    
    // Al entrar, empezamos en el mes actual
    mesVisible = 0;
    
    // Initial shell with skeleton loader
    container.innerHTML = `
      <div class="app-header">
        <div class="logo">
          <div style="width:28px;height:28px;flex-shrink:0;">${DG_ICON}</div>
          <span>📅 Reservas</span>
        </div>
        <div style="display:flex;gap:8px;align-items:center;">
          <button class="btn-back" id="btn-volver">Volver</button>
        </div>
      </div>
  
      <div class="page" style="padding-bottom:100px;">
        <div style="display:flex;justify-content:center;padding:40px;">
          <div class="loading-spinner"></div>
        </div>
      </div>
    `;

    // Load actual data
    container.querySelector('#btn-volver').addEventListener('click', () => goBack());

    try {
        const res = await api.calendario();
        
        // Sincronizar "Hoy" con el servidor (Madrid) para evitar desvíos UTC
        hoyReferencia = res.fecha || new Date().toISOString().slice(0, 10);
        
        // Normalización técnica de reservas: Inyectar lógica visual de fin de bloqueos (+1 noche)
        reservasData = (res.reservasCalendario || []).map(r => {
            const isBlock = r.estado_reserva === 'BLOCKED' || r.origen === 'MANUAL_BLOCK';
            let visualOut = r.fecha_salida;
            const is1DayBlock = isBlock && (r.fecha_entrada === r.fecha_salida);
            
            if (isBlock && visualOut && !is1DayBlock) {
                const dObj = new Date(visualOut + 'T12:00:00Z');
                dObj.setUTCDate(dObj.getUTCDate() + 1);
                visualOut = dObj.toISOString().slice(0, 10);
            }
            return { ...r, fecha_salida_visual: visualOut, es_bloqueo: isBlock, is1DayBlock };
        });
        
        renderContent(container, state.user?.rol === 'admin');
    } catch (err) {
        container.querySelector('.page').innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
    }
}

function renderContent(container, isAdmin = false) {
    const page = container.querySelector('.page');
    
    page.innerHTML = `
      <div class="section-header" style="margin-bottom:16px;">
        <h2>Vistas de casas: ${['MIRADOR', 'CASON', 'GRATAL'].map(c => `<span style="color: ${c === 'MIRADOR' ? '#3b82f6' : c === 'CASON' ? '#10b981' : '#f97316'}; font-size: 1.2rem;">■</span> ${c.charAt(0) + c.slice(1).toLowerCase()}`).join(' ')}</h2>
      </div>
      
      <div id="worker-calendar-wrapper">
        ${renderCalendarioHTML(mesVisible, reservasData, isAdmin)}
      </div>
    `;

    // Event listeners para el calendario: Blindado contra acumulaciones
    if (page._calListenerAttached) page.removeEventListener('click', page._calListenerAttached);
    
    page._calListenerAttached = e => {
        const minMes = isAdmin ? -1 : 0;
        const maxMes = isAdmin ? 10 : 3;

        const btnCalPrev = e.target.closest('#btn-cal-prev');
        if (btnCalPrev && mesVisible > minMes) {
            mesVisible--;
            document.getElementById('worker-calendar-wrapper').innerHTML = renderCalendarioHTML(mesVisible, reservasData, isAdmin);
            return;
        }

        const btnCalNext = e.target.closest('#btn-cal-next');
        if (btnCalNext && mesVisible < maxMes) {
            mesVisible++;
            document.getElementById('worker-calendar-wrapper').innerHTML = renderCalendarioHTML(mesVisible, reservasData, isAdmin);
            return;
        }

        const dayCell = e.target.closest('.cal-day-cell');
        if (dayCell) {
            const dateStr = dayCell.dataset.date;
            const rDia = reservasData.filter(r => r.fecha_entrada <= dateStr && r.fecha_salida_visual >= dateStr);
            
            if (!rDia.length) return; // Si no hay reservas ese día, no hacer nada

            const dateLabel = formatFechaCompleta(dateStr);

            const modalHtml = `
              <div class="modal overlay-modal" id="modal-cal-detalle" data-date="${dateStr}">
                <div class="modal-content" style="max-width:500px;">
                  <h3>📅 Reservas del ${dateLabel}</h3>
                  <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">
                    ${rDia.map(r => renderReservaHTML(r, dateStr, false)).join('')}
                  </div>
                  <div style="text-align:right;margin-top:24px;">
                    <button class="btn btn-primary btn-close-modal">Cerrar</button>
                  </div>
                </div>
              </div>
            `;
            document.body.insertAdjacentHTML('beforeend', modalHtml);
            return;
        }
    };
    page.addEventListener('click', page._calListenerAttached);
}

// Global modal close listener
if (!window._workerCalModalClickListener) {
    window._workerCalModalClickListener = e => {
        if (e.target.closest('.btn-close-modal')) {
            const modal = e.target.closest('.modal');
            if (modal) modal.remove();
        }
    };
    document.body.addEventListener('click', window._workerCalModalClickListener);
}
