// ─── Admin Panel v2 ─────────────────────────────────────────────────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';
import { renderUsuarios } from './usuarios.js';
import { CASA_ICON } from '../../utils/casas.js';
import { CATEGORIAS_INCIDENCIA, getUbicaciones } from '../../utils/incidencias.js';
import { renderPartesAbiertos as renderSinCerrar } from './partes-abiertos.js';
import { renderPropuestas } from './propuestas.js';

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'partes', label: '✨ Partes' },
  { id: 'abiertos', label: '▶️ Sin cerrar' },
  { id: 'incidencias', label: '🛠️ Incidencias' },
  { id: 'consumibles', label: '🛒 Consumibles' },
  { id: 'propuestas', label: '💡 Propuestas' },
  { id: 'costes', label: '💰 Costes limpieza' },
  { id: 'tareas', label: '🗓️ Tareas periódicas' },
  { id: 'usuarios', label: '👥 Usuarios' },
  { id: 'temporada', label: '🌤️ Temporada' },
];

const getStatusBadge = (status) => {
  if (status === 'Sí') return { text: 'Lista', class: 'badge-ok' };
  if (status === 'No') return { text: 'No lista', class: 'badge-error' };
  return { text: 'Sin confirmar', class: 'badge-warning' };
};

const unificarTipo = (tipo) => {
  if (!tipo) return 'Limpieza';
  const t = tipo.toLowerCase().trim();
  if (t === 'cambio' || t.includes('huéspedes')) return 'Cambio de huéspedes';
  if (t === 'revisión' || t.includes('rápida')) return 'Revisión rápida';
  if (t.includes('salida')) return 'Limpieza de salida';
  if (t.includes('profunda')) return 'Limpieza profunda';
  return tipo;
};

const formatDia = (fechaStr) => {
  if (!fechaStr) return '?';
  const datePart = fechaStr.includes('T') ? fechaStr.split('T')[0] : fechaStr;
  const parts = datePart.split('-');
  return parts.length === 3 ? `${parts[2]}/${parts[1]}/${parts[0]}` : fechaStr;
};

const isReservaActiva = (r) => {
  if (!r) return false;
  const st = String(r.estado_reserva || '').toLowerCase();
  if (st.includes('cancel') || st.includes('anul')) return false;
  return true;
};

let activeTab = 'dashboard';
let mesVisibleAvaibook = 0;

export function renderAdmin(navigate, state) {
  const container = document.getElementById('page-container');

  function shell(content) {
    return `
      <div class="app-header">
        <div class="logo">
          <img src="img/logo-dg-icono.svg" alt="DG Limpiezas" width="32" height="32" style="display:block;">
          <span style="line-height:1.2;">
            <span style="display:block;font-size:.8rem;font-weight:700;">Admin</span>
            <span style="display:block;font-size:.68rem;color:var(--text-muted);font-weight:400;">${state.user?.nombre || ''}</span>
          </span>
        </div>
        <div style="display:flex;align-items:center;gap:6px;">

          <button class="btn-logout" id="btn-nueva">✨ Parte</button>
          <button class="btn-logout" id="btn-logout">Salir</button>
        </div>
      </div>
      <div class="admin-nav" id="admin-nav" style="display:grid; grid-template-columns:1fr auto 1fr; align-items:center; gap:0;">
        <div class="nav-utils" style="display:flex; justify-content:flex-start;">
          <button class="admin-nav-btn nav-util-btn ${'usuarios' === activeTab ? 'active' : ''}" data-tab="usuarios">👥 Usuarios</button>
        </div>
        <div class="nav-home" style="display:flex; justify-content:center;">
          <button class="admin-nav-btn nav-home-btn ${'dashboard' === activeTab ? 'active' : ''}" data-tab="dashboard">📊 Dashboard</button>
          ${TABS.filter(t => t.id !== 'dashboard' && t.id !== 'usuarios' && t.id !== 'temporada' && t.id !== 'qr').map(t =>
      `<button class="admin-nav-btn" data-tab="${t.id}" hidden></button>`
    ).join('')}
        </div>
        <div class="nav-utils" style="display:flex; justify-content:flex-end;">
          <button class="admin-nav-btn nav-util-btn ${'temporada' === activeTab ? 'active' : ''}" data-tab="temporada">🌤️ Temporada</button>
        </div>
      </div>
      <div class="page" id="admin-content">${content}</div>
    `;
  }

  async function loadTab(tab) {
    activeTab = tab;
    container.querySelectorAll('.admin-nav-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
    const content = container.querySelector('#admin-content');
    content.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;"><div class="loading-spinner"></div></div>';
    try {
      const render = {
        dashboard,
        partes,
        abiertos: renderSinCerrar,
        incidencias,
        consumibles,
        propuestas: renderPropuestas,
        costes,
        tareas,
        usuarios: renderUsuarios,
        temporada,
        qr
      };
      await render[tab]?.(content, state, loadTab);
    } catch (err) {
      content.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>${err.message}</p></div>`;
    }
  }

  container.innerHTML = shell('<div style="display:flex;justify-content:center;padding:40px;"><div class="loading-spinner"></div></div>');

  container.querySelector('#admin-nav').addEventListener('click', e => {
    const tab = e.target.closest('.admin-nav-btn')?.dataset.tab;
    if (tab) loadTab(tab);
  });
  container.querySelector('#btn-logout').addEventListener('click', async () => {
    await api.logout().catch(() => { });
    state.user = null;
    state.partes = [];
    state.allOpenParts = [];
    navigate('login');
  });
  container.querySelector('#btn-nueva').addEventListener('click', () => navigate('selector'));

  loadTab('dashboard');
}

// ─── Saludo rotatorio para admins ─────────────────────────────────────────────
const FRASES_ANDRES = [
  'Todo listo para poner orden al día.',
  'Vamos a dejarlo fino hoy.',
  'Operativa lista, decisiones claras.',
  'Hoy toca dejar cada casa a punto.',
  'Todo preparado para que fluya.',
  'El panel está preparado, tú marcas el ritmo.',
];

const FRASES_MARIA = [
  'Qué gusto verte por aquí.',
  'Todo listo para dejarlo bonito y en orden.',
  'Hoy también lo vamos a sacar genial.',
  'Todo preparado para que salga redondo.',
  'Vamos a ponerle mimo a todo.',
  'Tu toque se nota hasta en el panel.',
];

const FRASES_NEUTRAS = [
  'Todo listo para poner orden al día.',
  'Bienvenid@ al cuartel general.',
  'El panel está preparado.',
  'Vamos a dejarlo fino hoy.',
];

function adminSaludo(nombre) {
  if (!nombre) return '';

  const d = new Date();
  const diaMes = `${String(d.getDate()).padStart(2, '0')}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  const isAndres = nombre === 'Andrés' || nombre === 'Andres';
  const isMaria = nombre === 'María' || nombre === 'Maria';

  let msjEspecial = null;

  if (diaMes === '30-05' && isAndres) {
    const list = [
      'Feliz cumpleaños, Andrés. Hoy el panel trabaja para ti 🎉',
      'Andrés, hoy manda el cumpleañero. Feliz día 🎂',
      'Feliz cumpleaños, Andrés. Que hoy salga todo redondo ✨'
    ];
    msjEspecial = list[d.getFullYear() % list.length];
  } else if (diaMes === '05-11' && isMaria) {
    const list = [
      'Feliz cumpleaños, María. Hoy el día es un poquito más bonito 🎂',
      'María, feliz cumpleaños. Qué alegría tenerte por aquí ✨',
      'Feliz cumpleaños, María. Hoy toca celebrar y sonreír 💛'
    ];
    msjEspecial = list[d.getFullYear() % list.length];
  } else if (diaMes === '10-08') {
    const list = [
      'Feliz aniversario, pareja. Otro año bonito caminando juntos 💛',
      'Hoy se celebra lo importante: vosotros. Feliz aniversario ✨',
      'Feliz 10 de agosto. Qué suerte compartir camino y proyecto 💫'
    ];
    msjEspecial = list[d.getFullYear() % list.length];
  } else if (diaMes === '03-09') {
    const list = [
      'Feliz aniversario de boda. Que nunca falten los buenos días juntos 🤍',
      'Hoy toca recordar una fecha preciosa. Feliz aniversario 💍',
      'Feliz aniversario de boda. A seguir construyendo bonito ✨'
    ];
    msjEspecial = list[d.getFullYear() % list.length];
  } else if (diaMes === '24-12' || diaMes === '25-12') {
    const list = [
      'Feliz Navidad. Que hoy todo tenga un poco más de calma y de luz 🎄',
      'Feliz Navidad, pareja. Que disfrutéis mucho de lo importante ✨',
      'Hoy el panel también os desea Feliz Navidad 🎄'
    ];
    msjEspecial = list[d.getFullYear() % list.length];
  } else if (diaMes === '31-12' || diaMes === '01-01') {
    const list = [
      'Feliz Año Nuevo. A por un año bonito y bien vivido ✨',
      'Feliz 2027. Que venga con salud, alegría y buenos planes 🥂',
      'Año nuevo, ilusiones nuevas. Feliz comienzo 💫'
    ];
    msjEspecial = list[d.getFullYear() % list.length];
  }

  // 1. Renderizado de Mensaje Especial (Prioridad Máxima)
  if (msjEspecial) {
    return `
      <div style="margin-bottom:16px; color:var(--text-muted); font-size:0.95rem;">
        <span style="font-size:1.1rem; margin-right:6px;">👋</span>
        <span style="font-weight:600; color:var(--text);">${msjEspecial}</span>
      </div>`;
  }

  // 2. Renderizado Normal / Neutro
  const inicio = new Date(d.getFullYear(), 0, 0);
  const diaAnyo = Math.floor((d - inicio) / 86400000);

  let fraseRotatoria = '';
  if (isAndres) {
    fraseRotatoria = FRASES_ANDRES[diaAnyo % FRASES_ANDRES.length];
  } else if (isMaria) {
    fraseRotatoria = FRASES_MARIA[diaAnyo % FRASES_MARIA.length];
  } else {
    fraseRotatoria = FRASES_NEUTRAS[diaAnyo % FRASES_NEUTRAS.length];
  }

  return `
    <div style="margin-bottom:16px; color:var(--text-muted); font-size:0.95rem;">
      <span style="font-size:1.1rem; margin-right:6px;">👋</span>
      <span style="font-weight:600; color:var(--text);">Hola, ${nombre}.</span> ${fraseRotatoria}
    </div>`;
}

// ─── TABS ──────────────────────────────────────────────────────────────────

// ─── Helpers Reservas ────────────────────────────────────────────────────────
import { formatFechaCompleta, renderReservaHTML } from '../../utils/reservas.js';
import { formatTimeMadrid, formatDateMadrid } from '../../utils/time.js';

function getMadridISOString(d = new Date()) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Europe/Madrid',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
    hour12: false
  }).formatToParts(d);
  const p = {};
  for (const part of parts) p[part.type] = part.value;
  let h = p.hour; if (h === '24') h = '00';
  const dateStr = `${p.year}-${p.month}-${p.day}`;
  const timeStr = `${h}:${p.minute}:${p.second}`;
  const localD = new Date(dateStr + 'T' + timeStr + 'Z');
  let offsetMins = Math.round((localD - d) / 60000);
  const sign = offsetMins >= 0 ? '+' : '-';
  offsetMins = Math.abs(offsetMins);
  const zH = String(Math.floor(offsetMins / 60)).padStart(2, '0');
  const zM = String(offsetMins % 60).padStart(2, '0');
  return `${dateStr}T${timeStr}${sign}${zH}:${zM}`;
}

async function dashboard(el, state, loadTab) {
  const [dRaw, abiertosData, propuestasPendientes] = await Promise.all([
    api.dashboard(),
    api.partesAbiertos().catch(() => []),
    api.propuestas({ estado: 'PENDIENTE' }).catch(() => []),
  ]);

  // Normalización técnica de reservas: Inyectar lógica visual de fin de bloqueos (+1 noche)
  const d = {
    ...dRaw,
    reservasCalendario: (dRaw.reservasCalendario || []).map(r => {
      const isBlock = r.estado_reserva === 'BLOCKED' || r.origen === 'MANUAL_BLOCK';
      let visualOut = r.fecha_salida;
      const is1DayBlock = isBlock && (r.fecha_entrada === r.fecha_salida);

      if (isBlock && visualOut && !is1DayBlock) {
        const dObj = new Date(visualOut + 'T12:00:00Z');
        dObj.setUTCDate(dObj.getUTCDate() + 1);
        visualOut = dObj.toISOString().slice(0, 10);
      }
      return { ...r, fecha_salida_visual: visualOut, es_bloqueo: isBlock, is1DayBlock };
    })
  };

  const pisoColor = { MIRADOR: 'var(--mirador)', CASON: 'var(--cason)', GRATAL: 'var(--gratal)' };
  const hoyMadrid = d.fecha; // Usar la fecha Madrid reportada por el dashboard (backend)

  // Helpers de navegación mensual y fechas locales
  function prevMes(mes) {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m - 2, 1);
    return getMadridISOString(d).slice(0, 7);
  }
  function nextMes(mes) {
    const [y, m] = mes.split('-').map(Number);
    const d = new Date(y, m, 1);
    return getMadridISOString(d).slice(0, 7);
  }
  function labelMes(mes) {
    const [y, m] = mes.split('-').map(Number);
    return new Date(y, m - 1, 1).toLocaleDateString('es-ES', { month: 'long', year: 'numeric' });
  }
  function mesNavBar(mesFiltro, onPrev, onNext) {
    const esActual = mesFiltro >= mesActual;
    const bar = document.createElement('div');
    bar.className = 'mes-nav';
    bar.innerHTML = `<button class="mes-nav-btn" id="bn-prev">&#8249;</button>
      <span class="mes-nav-lbl">${labelMes(mesFiltro)}</span>
      <button class="mes-nav-btn" id="bn-next"${esActual ? ' disabled' : ''}>&#8250;</button>`;
    bar.querySelector('#bn-prev').addEventListener('click', onPrev);
    if (!esActual) bar.querySelector('#bn-next').addEventListener('click', onNext);
    return bar;
  }

  // ── Shortcuts: badge solo si hay dato real > 0 ──────────────────────────────
  function sc(tab, icon, lbl, n) {
    const badge = n > 0 ? `<span class="adm-sc-badge">${n}</span>` : '';
    return `<button class="adm-sc" data-goto="${tab}">${badge}${icon}<span class="adm-sc-lbl">${lbl}</span></button>`;
  }

  const bloqueShortcuts = `
    <div class="adm-sc-grid" style="margin-bottom:16px;">
      <div class="adm-sc-row">
        ${sc('incidencias', '🛠️', 'Incidencias', d.incPendientes)}
        ${sc('abiertos', '⚠️', 'Sin cerrar', abiertosData.length)}
        ${sc('consumibles', '🛒', 'Consumibles', d.consPendientes)}
      </div>
      <div class="adm-sc-row adm-sc-row--mid">
        ${sc('propuestas', '💡', 'Propuestas', propuestasPendientes.length)}
        ${sc('tareas', '🗓️', 'Tareas', 0)}
      </div>

    </div>
  `;

  function renderCalendarioHTML(offset, reservas) {
    if (!reservas) return '';
    const hoyParts = hoyMadrid.split('-');
    const hoy = new Date(hoyParts[0], hoyParts[1] - 1, hoyParts[2]);
    const calDate = new Date(hoy.getFullYear(), hoy.getMonth() + offset, 1);
    const year = calDate.getFullYear();
    const month = calDate.getMonth();
    const monthFormatter = new Intl.DateTimeFormat('es-ES', { month: 'long' });
    const monthName = monthFormatter.format(calDate);
    const monthL = monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + year;


    const diasMes = new Date(year, month + 1, 0).getDate();
    const primerDia = new Date(year, month, 1).getDay();
    let padding = primerDia === 0 ? 6 : primerDia - 1;

    let html = `
    <style>
      .avaibook-cal .btn-outline {
        background: rgba(255,255,255,0.05);
        border: 1px solid var(--border);
        color: var(--text);
        border-radius: 8px;
        transition: all 0.2s;
        cursor: pointer;
        display: flex;
        align-items: center;
        justify-content: center;
      }
      .avaibook-cal .btn-outline:hover:not(:disabled) {
        background: rgba(255,255,255,0.1);
        border-color: var(--primary);
      }
      .avaibook-cal .btn-outline:disabled {
        opacity: 0.3;
        cursor: not-allowed;
      }
    </style>
    <div class="avaibook-cal" style="background:var(--bg-card);border-radius:var(--radius);border:1px solid var(--border);padding:16px;margin-bottom:24px;">`;

    html += `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px;">
        <div style="display:flex;align-items:center;gap:12px;">
          <div style="display:flex;gap:4px;">
            <button class="btn-outline" id="btn-cal-prev" ${offset <= -1 ? 'disabled' : ''} style="width:32px;height:32px;font-size:1.2rem;">&lsaquo;</button>
            <button class="btn-outline" id="btn-cal-next" ${offset >= 10 ? 'disabled' : ''} style="width:32px;height:32px;font-size:1.2rem;">&rsaquo;</button>
          </div>
          <h3 style="margin:0;font-size:1.1rem;">${monthL}</h3>
        </div>
        <div style="display:flex;gap:10px;font-size:0.75rem;color:var(--text-muted);font-weight:600;">
          <div style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background:var(--mirador);border-radius:50%;"></span> Mirador</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background:var(--cason);border-radius:50%;"></span> Casón</div>
          <div style="display:flex;align-items:center;gap:4px;"><span style="display:inline-block;width:10px;height:10px;background:var(--gratal);border-radius:50%;"></span> Gratal</div>
        </div>
        <button class="btn btn-sm btn-avaibook" id="btn-sync-avaibook" style="width:auto; height:32px; padding:0 12px; font-size:0.75rem; background:transparent; border:1px solid var(--border); color:var(--text-muted); box-shadow:none;">
          ↻ Sincronizar
        </button>
      </div>
    `;

    const weekDays = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];
    html += `<div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:4px;text-align:center;font-size:0.8rem;color:var(--text-muted);margin-bottom:8px;">
      ${weekDays.map(d => `<div>${d}</div>`).join('')}
    </div>`;

    html += `<div style="display:grid;grid-template-columns:repeat(7, 1fr);gap:1px;background:var(--border);border:1px solid var(--border);border-radius:8px;overflow:hidden;">`;

    for (let i = 0; i < padding; i++) {
      html += `<div style="background:var(--bg-card);opacity:0.5;"></div>`;
    }

    for (let day = 1; day <= diasMes; day++) {
      const dStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

      let slotsHtml = '';
      ['MIRADOR', 'CASON', 'GRATAL'].forEach(casa => {
        const matches = reservas.filter(x => x.casa === casa && x.fecha_entrada <= dStr && x.fecha_salida_visual >= dStr);
        let color = casa === 'MIRADOR' ? 'var(--mirador)' : casa === 'CASON' ? 'var(--cason)' : 'var(--gratal)';

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
            extraStyle += `margin-left:50%; width:50%; border-radius: 4px 0 0 4px; ${r.es_bloqueo ? 'border-left: 1px dashed rgba(255,255,255,0.3);' : ''}`;
          } else if (isEnd && !isStart) {
            extraStyle += `width:50%; border-radius: 0 4px 4px 0; ${r.es_bloqueo ? 'border-right: 1px dashed rgba(255,255,255,0.3);' : ''}`;
          } else if (isStart && isEnd) { // Fallback, no debería darse en reservas reales por ser estancias >= 1 noche
            extraStyle += `width:100%; border-radius: 4px; ${r.es_bloqueo ? 'border: 1px dashed rgba(255,255,255,0.3);' : ''}`;
          } else {
            extraStyle += `width:100%; border-radius:0;`;
          }
        }

        slotsHtml += `<div style="${extraStyle}"></div>`;
      });

      // La celda entera del día es clickeable
      const dStrRelativa = dStr;
      const isHoy = dStr === hoyMadrid;
      const styleHoy = isHoy ? 'border: 2px solid var(--primary); background: rgba(99, 102, 241, 0.08) !important;' : '';

      html += `<div class="cal-day-cell ${isHoy ? 'hoy' : ''}" data-date="${dStr}" style="background:var(--bg-card);padding:4px;display:flex;flex-direction:column;min-height:76px;cursor:pointer;transition:background 0.2s; ${styleHoy}">
        <div style="font-size:0.75rem;text-align:right;color:var(--text-muted);font-weight:600;">${day}</div>
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;pointer-events:none;">${slotsHtml}</div>
        </div>`;
    }

    html += `</div></div>`;
    return html;
  }

  el.innerHTML = `
    ${adminSaludo(state.user?.nombre)}
    ${bloqueShortcuts}

    <div class="section-header"><h2>Hoy · ${formatFechaCompleta(d.fecha)}</h2></div>
    <div class="stat-grid" style="grid-template-columns:repeat(3,1fr);">
      <div class="stat-card success" data-goto="partes" style="cursor:pointer;">
        <div class="num">${d.totalPartesHoy}</div>
        <div class="lbl">✨ Partes hoy</div>
      </div>
      <div class="stat-card ${(d.incUrgentesDetalle?.filter(i => i.prioridad === 'Urgente').length ?? 0) > 0 ? 'danger' : ''}" data-goto="incidencias" style="cursor:pointer;">
        <div class="num">${d.incUrgentesDetalle?.filter(i => i.prioridad === 'Urgente').length ?? 0}</div>
        <div class="lbl">🔴 Inc. urgentes</div>
      </div>
      <div class="stat-card ${(d.consUrgentesDetalle?.length ?? 0) > 0 ? 'warning' : ''}" data-goto="consumibles" style="cursor:pointer;">
        <div class="num">${d.consUrgentesDetalle?.length ?? 0}</div>
        <div class="lbl">🛒 Cons. urgentes</div>
      </div>
    </div>
    <div class="coste-resumen" data-goto="costes" style="cursor:pointer; border:1px solid var(--primary); background:rgba(99,102,241,0.03); opacity:0.95; transition:opacity 0.2s;" onmouseover="this.style.opacity='1'" onmouseout="this.style.opacity='0.95'">
      <div>
        <div class="coste-res-titulo">💰 Coste este mes</div>
        <div class="coste-res-sub">desde el 1 de ${new Date().toLocaleDateString('es-ES', { month: 'long' })}</div>
      </div>
      <div style="display:flex;align-items:center;gap:10px;">
        <span class="coste-res-num">${(d.costes?.mesEur ?? '—')}€</span>
        <span style="font-size:1.3rem;color:var(--primary);font-weight:bold;margin-top:-2px;">›</span>
      </div>
    </div>

    <!-- Ficha Económica (Dinámica) -->
    <div id="eco-widget-container"></div>

    <div class="section-header" style="margin-bottom:8px;"><h2>Estado por casa</h2></div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:24px;">
      ${['MIRADOR', 'CASON', 'GRATAL'].map((casa, i) => {
    // 1. Extraer datos específicos
    const incCasa = (d.incidenciasAbiertas || []).filter(inc => inc.casa === casa);
    const consCasa = (d.consumiblesPendientes || []).filter(c => c.casa === casa);
    const ultimos = (d.ultimosPartesPorCasa && d.ultimosPartesPorCasa[casa]) ? d.ultimosPartesPorCasa[casa] : [];
    const ultimoParte = ultimos[0] || null;
    const sinCerrarCount = abiertosData.filter(a => a.casa === casa).length;

    // Próximas Reservas
    const hoy = d.fecha; // Usar fecha Madrid del backend
    const msMny = new Date(hoy + 'T00:00:00Z');
    msMny.setUTCDate(msMny.getUTCDate() + 1);
    const mny = msMny.toISOString().slice(0, 10);

    const resOperativas = (d.reservasCalendario || []).filter(isReservaActiva);
    const proxResIn = resOperativas.filter(r => r.casa === casa && r.fecha_entrada >= hoy).sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada))[0];
    const proxResOut = resOperativas.filter(r => r.casa === casa && r.fecha_salida >= hoy).sort((a, b) => a.fecha_salida.localeCompare(b.fecha_salida))[0];

    // Cálculos booleanos
    const tieneIncUrgente = incCasa.some(inc => inc.prioridad === 'Urgente');
    const tieneIncNormal = incCasa.some(inc => inc.prioridad !== 'Urgente');
    const tieneConsPendiente = consCasa.length > 0;
    const entradaHoy = proxResIn && proxResIn.fecha_entrada === hoy;
    const entradaOMnna = proxResIn && (proxResIn.fecha_entrada === hoy || proxResIn.fecha_entrada === mny);
    const salidaHoy = proxResOut && proxResOut.fecha_salida === hoy;
    const casaNoLista = ultimoParte && (ultimoParte.casa_lista === 'No' || !ultimoParte.fin_ts);
    const casaSinConfirmar = ultimoParte && !ultimoParte.casa_lista && ultimoParte.fin_ts;


    // Determinación de estado real
    let icon, cls, label, listMotivos = [];

    // CRÍTICO: Entrada hoy + casa no lista, o incidencia urgente
    if ((entradaHoy && casaNoLista) || tieneIncUrgente) {
      icon = '🚨'; cls = 'casa-urgente'; label = 'Crítico';
      if (entradaHoy && casaNoLista) listMotivos.push('Entrada HOY: casa no lista');

      const urgCount = incCasa.filter(i => i.prioridad === 'Urgente').length;
      if (urgCount > 0) listMotivos.push(`${urgCount} ${urgCount === 1 ? 'inc. urgente' : 'incs. urgentes'}`);
    }
    // ATENCIÓN: Inc. abierta, cons. pendiente, casa no lista reciente, o inminente rotación
    else if (tieneIncNormal || tieneConsPendiente || casaNoLista || entradaOMnna || salidaHoy) {
      icon = '⚠️'; cls = 'casa-atencion'; label = 'Atención';
      if (entradaOMnna) listMotivos.push(entradaHoy ? 'Entrada HOY' : 'Entrada MAÑANA');
      if (salidaHoy && !entradaHoy) listMotivos.push('Salida HOY');
      if (casaNoLista && !entradaOMnna) listMotivos.push('Último parte: No lista');
      if (tieneIncNormal) listMotivos.push(`${incCasa.length} ${incCasa.length === 1 ? 'incidencia abierta' : 'incidencias abiertas'}`);
      if (tieneConsPendiente) listMotivos.push(`${consCasa.length} ${consCasa.length === 1 ? 'consumible falta' : 'consumibles faltan'}`);
      if (sinCerrarCount > 0) listMotivos.push(`${sinCerrarCount} ${sinCerrarCount === 1 ? 'parte abierto' : 'partes abiertos'}`);
    }
    // OK
    else {
      icon = '✅'; cls = 'casa-ok'; label = 'OK';
      listMotivos.push('Sin bloqueos operativos');
      if (casaSinConfirmar) listMotivos.push('Último parte: Sin confirmar');
      if (proxResIn) listMotivos.push(`Próxima entrada: ${formatDia(proxResIn.fecha_entrada)}`);
    }

    const motivo = listMotivos.slice(0, 2).join(' · ');
    const spanWide = i === 2 ? 'grid-column:span 2;' : '';
    return `
          <div class="casa-card ${cls}" data-drilldown="${casa}" style="${spanWide} cursor:pointer;">
            <div class="casa-nombre">${casa}</div>
            <div class="casa-estado">${icon}</div>
            <div class="casa-label">${label}</div>
            <div class="casa-motivo">${motivo}${listMotivos.length > 2 ? ' (+)' : ''}</div>
          </div>`;
  }).join('')}
    </div>

    <div style="display:flex;justify-content:space-between;align-items:flex-end;margin-top:24px;margin-bottom:8px;">
      <h2 style="font-size:1.1rem;font-weight:600;margin:0;">📅 Calendario de reservas</h2>
    </div>

    <div id="avaibook-calendar-wrapper">
      ${renderCalendarioHTML(mesVisibleAvaibook, d.reservasCalendario)}
    </div>
    </div>

    ${d.ultimosPartes?.length ? `
    <div class="section-header mt-16"><h2>Últimos partes</h2></div>
    <div class="data-list">
      ${d.ultimosPartes.map(p => `
        <div class="data-row">
          <div class="data-row-main">
            <h4>${p.casa} · ${p.tipo_limpieza || ''}</h4>
            <p>${p.usuario_nombre || ''} · ${(p.inicio_ts || '').slice(11, 16)}</p>
          </div>
          <span class="badge ${getStatusBadge(p.casa_lista).class}">${getStatusBadge(p.casa_lista).text}</span>
        </div>
      `).join('')}
    </div>` : ''}
  `;

  // --- WIDGET LÓGICA REACTIVA ---
  const dashHoy = d.fecha || new Date().toISOString().slice(0, 10);
  const widgetCurrMes = dashHoy.slice(0, 7);
  const widgetCurrAno = dashHoy.slice(0, 4);

  if (!window.ecoMode) window.ecoMode = 'mes';
  if (!window.ecoMonth) window.ecoMonth = widgetCurrMes;
  if (!window.ecoYear) window.ecoYear = widgetCurrAno;

  const ecoData = d.economiaCompleta || { meses: {}, anos: {} };
  const mesesDisponibles = Object.keys(ecoData.meses).sort();
  const anosDisponibles = Object.keys(ecoData.anos).sort();

  if (!mesesDisponibles.includes(window.ecoMonth) && mesesDisponibles.length > 0) {
    window.ecoMonth = mesesDisponibles.includes(widgetCurrMes) ? widgetCurrMes : mesesDisponibles[mesesDisponibles.length - 1];
  }
  if (!anosDisponibles.includes(window.ecoYear) && anosDisponibles.length > 0) {
    window.ecoYear = anosDisponibles.includes(widgetCurrAno) ? widgetCurrAno : anosDisponibles[anosDisponibles.length - 1];
  }

  function renderEcoWidget() {
    const container = el.querySelector('#eco-widget-container');
    if (!container) return;

    const isMes = window.ecoMode === 'mes';
    const periodos = isMes ? mesesDisponibles : anosDisponibles;
    let currentVal = isMes ? window.ecoMonth : window.ecoYear;

    if (periodos.length === 0) {
      container.innerHTML = '<div style="color:var(--text-muted); font-size:0.85rem; padding:16px; text-align:center; background:var(--bg-card); border-radius:8px; border:1px solid var(--border);">No hay datos económicos</div>';
      return;
    }

    const idx = periodos.indexOf(currentVal);
    const hasPrev = idx > 0;
    const hasNext = idx !== -1 && idx < periodos.length - 1;

    const dataObj = isMes ? (ecoData.meses[currentVal] || {}) : (ecoData.anos[currentVal] || {});
    const bruto = dataObj.bruto || 0;
    const comision = dataObj.comision || 0;
    const neto = dataObj.neto || 0;
    const porCasa = dataObj.porCasa || { MIRADOR: {}, CASON: {}, GRATAL: {} };

    let periodoDisplay = currentVal;
    if (isMes && currentVal.length === 7) {
      const [y, m] = currentVal.split('-');
      const monthName = new Date(y, parseInt(m) - 1).toLocaleDateString('es-ES', { month: 'long' });
      periodoDisplay = monthName.charAt(0).toUpperCase() + monthName.slice(1) + ' ' + y;
    }

    const casasHTML = ['MIRADOR', 'CASON', 'GRATAL'].map(c => {
      const e = porCasa[c] || { bruto: 0, comision: 0, neto: 0 };
      const colorCasa = c === 'MIRADOR' ? 'var(--mirador)' : c === 'CASON' ? 'var(--cason)' : 'var(--gratal)';
      return `
           <div style="background:var(--bg-body); border:1px solid var(--border); border-radius:8px; padding:10px 12px; display:flex; justify-content:space-between; align-items:center;">
             <div style="font-weight:700; font-size:0.8rem; color:${colorCasa}; width:70px;">${c}</div>
             <div style="display:flex; gap:16px; flex:1; justify-content:flex-end;">
               <div style="display:flex;flex-direction:column;align-items:flex-end;font-size:0.7rem;color:var(--text-muted);">
                 <span>Bruto</span><span style="font-weight:500;color:var(--text);">${(e.bruto || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
               <div style="display:flex;flex-direction:column;align-items:flex-end;font-size:0.7rem;color:var(--text-muted);">
                 <span>Com.</span><span style="font-weight:500;color:var(--text);">${(e.comision || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
               <div style="display:flex;flex-direction:column;align-items:flex-end;font-size:0.7rem;font-weight:700;color:var(--text);">
                 <span>Neto</span><span>${(e.neto || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
               </div>
             </div>
           </div>
         `;
    }).join('');

    container.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <h2 style="margin:0; font-size:1.1rem; color:var(--text); flex:1;">Ficha Económica</h2>
          <div style="display:flex; background:var(--bg-btn-sec); border-radius:6px; overflow:hidden; border:1px solid var(--border); flex-shrink:0;">
            <button class="eco-tab" data-mode="mes" style="padding:6px 14px; font-size:0.75rem; font-weight:600; border:none; background:${isMes ? 'var(--primary)' : 'transparent'}; color:${isMes ? 'white' : 'var(--text-muted)'}; cursor:pointer; transition:0.2s;">Mes</button>
            <button class="eco-tab" data-mode="ano" style="padding:6px 14px; font-size:0.75rem; font-weight:600; border:none; background:${!isMes ? 'var(--primary)' : 'transparent'}; color:${!isMes ? 'white' : 'var(--text-muted)'}; cursor:pointer; transition:0.2s;">Año</button>
          </div>
        </div>

        <div style="background:var(--bg-card); border:1px solid var(--border); border-radius:12px; padding:16px; margin-bottom:24px; box-shadow:0 1px 3px rgba(0,0,0,0.05);">
            <div style="display:flex; justify-content:center; align-items:center; gap:8px; margin-bottom:16px;">
               <button class="eco-nav-btn prev" style="background:transparent; border:none; font-size:1.8rem; display:flex; align-items:center; justify-content:center; width:40px; cursor:${hasPrev ? 'pointer' : 'default'}; opacity:${hasPrev ? '1' : '0.2'}; color:var(--primary); transition:0.2s; padding:0;">‹</button>
               <div style="font-weight:700; font-size:1.05rem; min-width:140px; text-align:center; color:var(--text); letter-spacing:0.3px;">${periodoDisplay}</div>
               <button class="eco-nav-btn next" style="background:transparent; border:none; font-size:1.8rem; display:flex; align-items:center; justify-content:center; width:40px; cursor:${hasNext ? 'pointer' : 'default'}; opacity:${hasNext ? '1' : '0.2'}; color:var(--primary); transition:0.2s; padding:0;">›</button>
            </div>

            <div style="display:flex; justify-content:space-between; margin-bottom:16px;">
              <div style="flex:1; text-align:center; padding-right:8px; border-right:1px solid var(--border);">
                <div style="font-size:1.1rem; color:var(--text); font-weight:600;">${bruto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">Bruto</div>
              </div>
              <div style="flex:1; text-align:center; padding:0 8px; border-right:1px solid var(--border);">
                <div style="font-size:1.1rem; color:var(--text); font-weight:600;">${comision.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">Comisiones</div>
              </div>
              <div style="flex:1; text-align:center; padding-left:8px;">
                <div style="color:var(--primary); font-size:1.2rem; font-weight:700;">${neto.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div style="font-size:0.75rem; color:var(--primary); font-weight:700; text-transform:uppercase; letter-spacing:0.5px; margin-top:2px;">Neto</div>
              </div>
            </div>

            <div style="border-top:1px dashed var(--border); padding-top:12px; margin-bottom:20px; display:flex; justify-content:space-between; align-items:center;">
               <span style="color:var(--text-muted); font-size:0.8rem; display:flex; align-items:center; gap:6px;">
                 <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
                 Previsión prox. 30 días
               </span>
               <span style="font-weight:700; font-size:0.9rem; color:var(--primary); background:rgba(99,102,241,0.08); padding:4px 8px; border-radius:6px;">${(d.neto30d || 0).toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €</span>
            </div>

            <div style="display:flex; flex-direction:column; gap:8px;">
              ${casasHTML}
            </div>
        </div>
      `;

    container.querySelectorAll('.eco-tab').forEach(btn => {
      btn.addEventListener('click', (ev) => {
        const selectedMode = ev.currentTarget.getAttribute('data-mode');
        if (window.ecoMode !== selectedMode) {
          window.ecoMode = selectedMode;
          renderEcoWidget();
        }
      });
    });

    container.querySelector('.eco-nav-btn.prev')?.addEventListener('click', () => {
      if (hasPrev) {
        if (isMes) window.ecoMonth = periodos[idx - 1]; else window.ecoYear = periodos[idx - 1];
        renderEcoWidget();
      }
    });

    container.querySelector('.eco-nav-btn.next')?.addEventListener('click', () => {
      if (hasNext) {
        if (isMes) window.ecoMonth = periodos[idx + 1]; else window.ecoYear = periodos[idx + 1];
        renderEcoWidget();
      }
    });
  }

  renderEcoWidget();
  // --- FIN WIDGET ---

  // Clicks en shortcuts → delegar al navBtn correspondiente
  if (!el._dashListenerAttached) {
    el._dashListenerAttached = true;
    el.addEventListener('click', async e => {
      // Sincronización Manual Avaibook
      const btnSync = e.target.closest('#btn-sync-avaibook');
      if (btnSync) {
        btnSync.disabled = true;
        btnSync.textContent = '⏳ Sincronizando...';
        try {
          const res = await api.syncReservas();
          toast(`Avaibook sincronizado (${res.stats?.insertadas || 0} bajadas)`, 'success');
          loadTab('dashboard'); // Recargar para ver los cambios
        } catch (err) {
          toast('Error al sincronizar Avaibook: ' + err.message, 'error');
          btnSync.disabled = false;
          btnSync.innerHTML = '↻ Sincronizar';
        }
        return;
      }

      // Navegación Calendario Avaibook (Optimizado: en memoria, sin peticiones)
      const btnCalPrev = e.target.closest('#btn-cal-prev');
      if (btnCalPrev && mesVisibleAvaibook > -1) {
        mesVisibleAvaibook--;
        const wrapper = document.getElementById('avaibook-calendar-wrapper');
        if (wrapper) wrapper.innerHTML = renderCalendarioHTML(mesVisibleAvaibook, d.reservasCalendario);
        return;
      }
      const btnCalNext = e.target.closest('#btn-cal-next');
      if (btnCalNext && mesVisibleAvaibook < 10) {
        mesVisibleAvaibook++;
        const wrapper = document.getElementById('avaibook-calendar-wrapper');
        if (wrapper) wrapper.innerHTML = renderCalendarioHTML(mesVisibleAvaibook, d.reservasCalendario);
        return;
      }

      // Click en un día del calendario para ver el detalle de las reservas
      const dayCell = e.target.closest('.cal-day-cell');
      if (dayCell) {
        const dateStr = dayCell.dataset.date;
        const rDia = d.reservasCalendario.filter(r => r.fecha_entrada <= dateStr && r.fecha_salida_visual >= dateStr);

        if (!rDia.length) return; // Si no hay reservas ese día, no hacer nada

        const dateLabel = formatFechaCompleta(dateStr);

        const modalHtml = `
          <div class="modal overlay-modal" id="modal-cal-detalle" data-date="${dateStr}">
            <div class="modal-content" style="max-width:500px;">
              <h3>📅 Reservas del ${dateLabel}</h3>
              <div style="display:flex;flex-direction:column;gap:12px;margin-top:16px;">
                ${rDia.map(r => renderReservaHTML(r, dateStr, true)).join('')}
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

      const drilldown = e.target.closest('[data-drilldown]');
      if (drilldown) {
        const casaName = drilldown.dataset.drilldown;
        renderFichaCasa(casaName, d, abiertosData);
        return;
      }

      const sc = e.target.closest('[data-goto]');
      if (!sc) return;
      const navBtn = document.querySelector(`.admin-nav-btn[data-tab="${sc.dataset.goto}"]`);
      if (navBtn) navBtn.click();
    });
  }

  // Global Event Listeners for Dynamic Modals attached to document.body
  // Remove existing listeners to prevent duplicates on tab reload
  if (window._calModalClickListener) document.body.removeEventListener('click', window._calModalClickListener);
  if (window._calModalChangeListener) document.body.removeEventListener('change', window._calModalChangeListener);

  window._calModalClickListener = async e => {
    // Close Modal
    if (e.target.closest('.btn-close-modal')) {
      e.target.closest('.modal').remove();
      return;
    }

    // Toggle Edit Overrides
    if (e.target.closest('.btn-toggle-override')) {
      const btn = e.target.closest('.btn-toggle-override');
      const formDiv = btn.parentElement.querySelector('.override-form');
      formDiv.classList.toggle('hidden');
      return;
    }

    // Submit Guardar Overrides
    if (e.target.closest('.btn-save-override')) {
      e.preventDefault();
      const btn = e.target.closest('.btn-save-override');
      const form = btn.closest('form');
      const card = btn.closest('.reserva-card-wrapper');
      const modal = card.closest('.modal');
      const reserva_id = card.dataset.resId;

      const payload = {
        reserva_id,
        cuna: form.querySelector('.input-cuna').value,
        num_cunas: form.querySelector('.input-num-cunas').value,
        late_checkout: form.querySelector('.input-late').value,
        late_checkout_hora: form.querySelector('.input-late-hora').value,
        nota_interna: form.querySelector('[name="nota_interna"]').value,
        nota_equipo: form.querySelector('[name="nota_equipo"]').value
      };

      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        const res = await api.saveOverride(payload);
        toast('Guardado con éxito', 'success');

        // Update local object Memory
        const targetRes = d.reservasCalendario.find(r => String(r.reserva_id) === String(reserva_id));
        if (targetRes) {
          Object.assign(targetRes, res.data);
        }

        // Extract native date and Re-render modal by simulating a click
        const dateStr = modal.dataset.date;
        modal.remove();

        const dayCell = document.querySelector(`.cal-day-cell[data-date="${dateStr}"]`);
        if (dayCell) dayCell.click();

      } catch (err) {
        toast(err.message || 'Error guardando', 'error');
        btn.disabled = false;
        btn.textContent = '💾 Guardar Overrides';
      }
    }
  };

  window._calModalChangeListener = e => {
    // Dynamic dependencies trigger rules
    if (e.target.classList.contains('input-cuna')) {
      const numInput = e.target.closest('form').querySelector('.input-num-cunas');
      if (e.target.value === 'Sí') {
        numInput.disabled = false;
        if (numInput.value == 0) numInput.value = 1;
      } else {
        numInput.disabled = true;
        numInput.value = 0;
      }
    }
    if (e.target.classList.contains('input-late')) {
      const hrInput = e.target.closest('form').querySelector('.input-late-hora');
      if (e.target.value === 'Sí') {
        hrInput.disabled = false;
      } else {
        hrInput.disabled = true;
        hrInput.value = '';
      }
    }
  };

  document.body.addEventListener('click', window._calModalClickListener);
  document.body.addEventListener('change', window._calModalChangeListener);
}


async function partes(el) {
  const reload = async () => {
    el.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;"><div class="loading-spinner"></div></div>';
    const data = await api.partes({ limit: 30 });
    if (!data.length) { el.innerHTML = '<div class="empty-state"><div class="icon">✨</div><p>Sin partes</p></div>'; return; }

    el.innerHTML = `
      <div class="section-header"><h2>Últimos 30 partes</h2></div>
      <div class="data-list" id="partes-list">
        ${data.map(p => `
          <div class="data-row" style="cursor:pointer;" data-id="${p.id}">
            <div class="data-row-main">
              <h4>${p.casa} · ${p.tipo_limpieza}</h4>
              <p>${formatFechaCompleta(p.fecha)} · ${p.usuario_nombre} · ${p.duracion_min || '?'} min</p>
            </div>
            <div style="text-align:right;">
              <span class="badge ${getStatusBadge(p.casa_lista).class}" style="display:block;margin-bottom:4px;">${getStatusBadge(p.casa_lista).text}</span>
              ${p.coste_estimado_eur ? `<span style="font-size:.75rem;color:var(--text-muted)">${p.coste_estimado_eur}€</span>` : ''}
              <span style="font-size:.9rem;color:var(--text-muted);display:block;margin-top:2px;">›</span>
            </div>
          </div>
        `).join('')}
      </div>
    `;

    el.querySelector('#partes-list').addEventListener('click', e => {
      const row = e.target.closest('.data-row');
      if (!row) return;
      const parteId = row.dataset.id;
      const parteData = data.find(p => p.id === parteId);
      if (parteData) {
        mostrarModalParteDetalle(parteData, reload);
      }
    });
  };

  function mostrarModalParteDetalle(p, reloadCb) {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;justify-content:center;align-items:flex-end;backdrop-filter:blur(4px);';

    const fmtTs = (ts) => formatTimeMadrid(ts);
    const iniTs = p.inicio_ts ? fmtTs(p.inicio_ts) : '';
    const finTs = p.fin_ts ? fmtTs(p.fin_ts) : '';

    const durH = p.duracion_min ? Math.floor(p.duracion_min / 60) : 0;
    const durM = p.duracion_min ? p.duracion_min % 60 : 0;

    const fieldStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.3); border-radius:12px; padding:12px 14px; color:#f8fafc; width:100%; font-size:.9rem; height:48px; outline:none; transition:border-color .2s; box-sizing:border-box;`;
    const selStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.3); border-radius:8px; padding:6px 4px; color:#f8fafc; font-size:.95rem; height:38px; outline:none; box-sizing:border-box; text-align:center; -webkit-appearance:none; appearance:none; flex:1;`;
    const actionBtnStyle = `padding:10px 20px; border-radius:10px; font-weight:700; font-size:.9rem; cursor:pointer; transition:all 0.2s; border:none; display:inline-flex; align-items:center; justify-content:center;`;

    const iniH = iniTs ? iniTs.split(':')[0] : '';
    const iniM = iniTs ? iniTs.split(':')[1] : '';
    const finH = finTs ? finTs.split(':')[0] : '';
    const finM = finTs ? finTs.split(':')[1] : '';

    const hoursOpts = Array.from({ length: 24 }, (_, i) => { const v = String(i).padStart(2, '0'); return v; });
    const minsOpts = Array.from({ length: 60 }, (_, i) => { const v = String(i).padStart(2, '0'); return v; });
    const mkOpts = (arr, sel) => arr.map(v => `<option value="${v}"${v === sel ? ' selected' : ''}>${v}</option>`).join('');

    modal.innerHTML = `
      <div style="background:var(--bg-surface); width:100%; max-width:480px; border-radius:24px 24px 0 0; padding:24px 20px 48px; box-sizing:border-box; animation:slideUp .3s ease-out; max-height:92vh; overflow-y:auto; display:flex; flex-direction:column; gap:20px; border-top:1px solid var(--border);">
        
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <h2 style="margin:0; font-size:1.2rem; font-weight:800; color:var(--text);">Detalle del Parte</h2>
          <button id="btn-cerrar-modal" style="background:none; border:none; font-size:1.8rem; color:var(--text); cursor:pointer; opacity:0.6; line-height:1;">&times;</button>
        </div>
        
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:12px; background:rgba(255,255,255,.03); padding:16px; border-radius:16px; font-size:.85rem; border:1px solid rgba(255,255,255,.05);">
          <div>
            <span style="color:var(--text-muted); display:block; font-size:.7rem; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.02em;">Casa</span>
            <strong style="color:var(--text);">${p.casa}</strong>
          </div>
          <div>
            <span style="color:var(--text-muted); display:block; font-size:.7rem; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.02em;">Tipo</span>
            <strong style="color:var(--text);">${p.tipo_limpieza}</strong>
          </div>
          <div>
            <span style="color:var(--text-muted); display:block; font-size:.7rem; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.02em;">Fecha</span>
            <strong style="color:var(--text);">${formatFechaCompleta(p.fecha)}</strong>
          </div>
          <div>
            <span style="color:var(--text-muted); display:block; font-size:.7rem; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.02em;">Trabajadora</span>
            <strong style="color:var(--text);">${p.usuario_nombre}</strong>
          </div>
          <div>
            <span style="color:var(--text-muted); display:block; font-size:.7rem; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.02em;">Duración</span>
            <strong style="color:var(--text);">${durH}h ${durM}m</strong>
          </div>
          <div>
            <span style="color:var(--text-muted); display:block; font-size:.7rem; margin-bottom:2px; text-transform:uppercase; letter-spacing:0.02em;">Coste</span>
            <strong style="color:var(--text);">${p.coste_estimado_eur || 0}€</strong>
          </div>
          <div style="grid-column: 1 / -1; display:flex; align-items:center; gap:8px;">
            <span style="color:var(--text-muted); font-size:.7rem; text-transform:uppercase; letter-spacing:0.02em;">Casa Lista:</span>
            <span class="badge ${p.casa_lista === 'Sí' ? 'bg-success' : (p.casa_lista === 'No' ? 'bg-danger' : 'bg-warning')}" style="font-size: .75rem; padding: 4px 10px;">${p.casa_lista || 'Pendiente'}</span>
          </div>
        </div>

        <div>
          <h3 style="font-size:1rem; margin:0 0 16px 0; font-weight:700; color:var(--text);">Edición Admin</h3>
          <div style="display:flex; flex-direction:column; gap:16px;">
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px;">
              <div>
                <label style="display:block; font-size:.75rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Inicio</label>
                <div style="display:flex; align-items:center; gap:4px;">
                  <select id="edit-ini-h" style="${selStyle}">${mkOpts(hoursOpts, iniH)}</select>
                  <span style="color:var(--text-muted); font-weight:700; font-size:1rem;">:</span>
                  <select id="edit-ini-m" style="${selStyle}">${mkOpts(minsOpts, iniM)}</select>
                </div>
              </div>
              <div>
                <label style="display:block; font-size:.75rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Fin</label>
                <div style="display:flex; align-items:center; gap:4px;">
                  <select id="edit-fin-h" style="${selStyle}">${mkOpts(hoursOpts, finH)}</select>
                  <span style="color:var(--text-muted); font-weight:700; font-size:1rem;">:</span>
                  <select id="edit-fin-m" style="${selStyle}">${mkOpts(minsOpts, finM)}</select>
                </div>
              </div>
            </div>

            <div>
              <label style="display:block; font-size:.8rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">Tiempo Efectivo (min)</label>
              <input type="number" id="edit-tiempo-ef" value="${p.tiempo_efectivo_min || p.duracion_min || 0}" style="${fieldStyle}">
            </div>

            <div>
              <label style="display:block; font-size:.8rem; font-weight:600; color:var(--text-muted); margin-bottom:6px;">Motivo obligatorio</label>
              <textarea id="edit-motivo" placeholder="¿Por qué se modifica o anula?" rows="2" style="${fieldStyle} height:auto; resize:none; padding-top:12px;"></textarea>
            </div>
          </div>
        </div>

        <div style="display:flex; justify-content:flex-end; align-items:center; gap:12px; margin-top:8px;">
          <button id="btn-anular-parte" style="${actionBtnStyle} background:rgba(220, 38, 38, 0.1); color:#ef4444; border:1px solid rgba(220, 38, 38, 0.2);">Anular parte</button>
          <button id="btn-guardar-edicion" class="btn btn-primary" style="${actionBtnStyle} box-shadow:0 4px 12px rgba(59, 130, 246, 0.2);">Guardar cambios</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#btn-cerrar-modal').onclick = closeModal;
    modal.onclick = (e) => { if (e.target === modal) closeModal(); };

    const selIniH = modal.querySelector('#edit-ini-h');
    const selIniM = modal.querySelector('#edit-ini-m');
    const selFinH = modal.querySelector('#edit-fin-h');
    const selFinM = modal.querySelector('#edit-fin-m');
    const inTef = modal.querySelector('#edit-tiempo-ef');

    const getIniVal = () => `${selIniH.value}:${selIniM.value}`;
    const getFinVal = () => `${selFinH.value}:${selFinM.value}`;

    function recomputeTime() {
      const t1 = new Date(`1970-01-01T${getIniVal()}:00`);
      let t2 = new Date(`1970-01-01T${getFinVal()}:00`);
      if (isNaN(t1.getTime()) || isNaN(t2.getTime())) return;
      if (t2 < t1) t2 = new Date(`1970-01-02T${getFinVal()}:00`);
      inTef.value = Math.max(0, Math.round((t2 - t1) / 60000));
    }

    selIniH.onchange = recomputeTime;
    selIniM.onchange = recomputeTime;
    selFinH.onchange = recomputeTime;
    selFinM.onchange = recomputeTime;

    modal.querySelector('#btn-guardar-edicion').onclick = async function () {
      const btn = this;
      const motivo = modal.querySelector('#edit-motivo').value.trim();
      const hIni = getIniVal();
      const hFin = getFinVal();
      const tEfectivo = inTef.value;

      if (!motivo) { toast('El motivo es obligatorio', 'error'); return; }

      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        let changedTimes = false;
        let changedEf = false;
        const currentIniTs = p.inicio_ts;
        const currentFinTs = p.fin_ts;
        let newIniTs = currentIniTs;
        let newFinTs = currentFinTs;

        if (hIni && currentIniTs && hIni !== currentIniTs.slice(11, 16)) {
          newIniTs = getMadridISOString(new Date(`${currentIniTs.slice(0, 10)}T${hIni}:00`));
          changedTimes = true;
        }

        if (hFin && hFin !== (currentFinTs ? currentFinTs.slice(11, 16) : '')) {
          const dateBase = currentFinTs ? currentFinTs.slice(0, 10) : (currentIniTs ? currentIniTs.slice(0, 10) : getMadridISOString().slice(0, 10));
          newFinTs = getMadridISOString(new Date(`${dateBase}T${hFin}:00`));
          if (newIniTs && new Date(newFinTs) < new Date(newIniTs)) {
            const d = new Date(`${dateBase}T${hFin}:00`); d.setDate(d.getDate() + 1);
            newFinTs = getMadridISOString(d);
          }
          changedTimes = true;
        }

        if (tEfectivo !== '' && tEfectivo !== String(p.tiempo_efectivo_min || p.duracion_min)) changedEf = true;

        if (!changedTimes && !changedEf) {
          toast('No hay cambios', 'info'); btn.disabled = false; btn.textContent = 'Guardar cambios'; return;
        }

        if (changedTimes) await api.editTimestamps(p.id, { inicio_ts: newIniTs, fin_ts: newFinTs, motivo });
        if (changedEf) await api.ajustarTiempo(p.id, { tiempo_efectivo_min: tEfectivo, motivo });

        toast('Parte actualizado', 'success');
        closeModal();
        reloadCb();
      } catch (err) {
        toast(err.message || 'Error al guardar', 'error');
        btn.disabled = false;
        btn.textContent = 'Guardar cambios';
      }
    };

    modal.querySelector('#btn-anular-parte').onclick = async function () {
      const btn = this;

      const promptModal = document.createElement('div');
      promptModal.className = 'modal-overlay';
      promptModal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.85);z-index:10000;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(4px);';
      promptModal.innerHTML = `
        <div style="background:var(--bg-card); border-radius:16px; padding:24px; width:90%; max-width:340px; border:1px solid rgba(239,68,68,0.2); animation:popIn .2s ease-out;">
          <h3 style="margin:0 0 12px 0; color:#ef4444; font-size:1.1rem; font-weight:800;">⚠️ Anular Parte</h3>
          <p style="margin:0 0 20px 0; font-size:.85rem; color:var(--text-muted); line-height:1.5;">Esta acción excluirá el parte de todos los listados productivos y de la rentabilidad. No es reversible.</p>
          
          <label style="display:block; font-size:.75rem; font-weight:700; color:var(--text); margin-bottom:8px; text-transform:uppercase;">Motivo obligatorio</label>
          <input type="text" id="anular-motivo-input" style="width:100%; background:rgba(0,0,0,.3); border:1px solid rgba(255,255,255,.1); border-radius:10px; padding:12px; color:white; font-size:.9rem; margin-bottom:20px; outline:none;" placeholder="Ej: Error de fichaje" autocomplete="off" autofocus>
          
          <div style="display:flex; gap:10px;">
            <button id="btn-cancel-anular" class="btn" style="flex:1; background:rgba(255,255,255,.05); border:1px solid rgba(255,255,255,.1); height:44px; font-weight:600;">Cerrar</button>
            <button id="btn-confirm-anular" class="btn" style="flex:1; background:#ef4444; color:white; border:none; height:44px; font-weight:800;">Sí, anular</button>
          </div>
        </div>
      `;
      document.body.appendChild(promptModal);
      const input = promptModal.querySelector('#anular-motivo-input');
      setTimeout(() => input.focus(), 50);

      promptModal.querySelector('#btn-cancel-anular').onclick = () => promptModal.remove();
      promptModal.querySelector('#btn-confirm-anular').onclick = async () => {
        const motivo = input.value.trim();
        if (!motivo) { toast('El motivo es obligatorio', 'error'); return; }

        const confirmBtn = promptModal.querySelector('#btn-confirm-anular');
        confirmBtn.disabled = true; confirmBtn.textContent = '...';
        btn.disabled = true;

        try {
          await api.adminAnularParte(p.id, { motivo });
          toast('Parte anulado', 'success');
          promptModal.remove();
          closeModal();
          reloadCb();
        } catch (err) {
          toast(err.message || 'Error', 'error');
          confirmBtn.disabled = false; confirmBtn.textContent = 'Sí, anular';
          btn.disabled = false;
        }
      };
    };
  }

  await reload();
}

let dashIncFilters = { estado: 'todos', casa: 'todas' };

function applyIncFiltersLocal(rawData, filters) {
  const now = new Date();
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  return rawData.filter(i => {
    const est = (i.estado || '').toLowerCase();

    // Regla 1: Descartada solo si se filtra explícitamente
    if (est === 'descartada' && filters.estado !== 'Descartada') {
      return false;
    }

    // Regla 2: Resuelta se oculta tras 7 días en el listado general ("todos")
    if (est === 'resuelta' && filters.estado === 'todos' && i.fecha_cierre) {
      const cierre = new Date(i.fecha_cierre);
      if (!isNaN(cierre) && (now - cierre) > SEVEN_DAYS_MS) {
        return false;
      }
    }

    return true;
  });
}

const chipStyle = (isActive) => `padding: 4px 10px; border-radius: 16px; font-size: 0.75rem; font-weight: 500; border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; background: ${isActive ? 'var(--primary)' : 'transparent'}; color: ${isActive ? '#fff' : 'var(--text-muted)'}; cursor: pointer; flex-shrink: 0; transition: all 0.2s; -webkit-tap-highlight-color: transparent;`;

async function incidencias(el) {
  const params = {};
  if (dashIncFilters.estado && dashIncFilters.estado !== 'todos') params.estado = dashIncFilters.estado;
  if (dashIncFilters.casa && dashIncFilters.casa !== 'todas') params.casa = dashIncFilters.casa;

  const rawData = await api.incidencias(params);
  const data = applyIncFiltersLocal(rawData, dashIncFilters);

  const pendientesCount = data.filter(i => {
    const est = (i.estado || '').toLowerCase();
    return est !== 'resuelta' && est !== 'descartada';
  }).length;

  const filtersHtml = `
    <div style="background:var(--bg-surface); padding:12px; border-radius:10px; margin-bottom:16px; border:1px solid var(--border); display:flex; flex-direction:column; gap:12px;">
      <div style="font-size:0.8rem; font-weight:700; color:var(--text); text-transform:uppercase; letter-spacing:0.5px;">Filtros</div>
      
      <div>
        <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600; margin-bottom:6px;">ESTADO</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="dash-inc-filter-btn" data-filter="estado" data-val="todos" style="${chipStyle(dashIncFilters.estado === 'todos')}">Todos</button>
          <button class="dash-inc-filter-btn" data-filter="estado" data-val="Pendiente" style="${chipStyle(dashIncFilters.estado === 'Pendiente')}">Pendiente</button>
          <button class="dash-inc-filter-btn" data-filter="estado" data-val="En Curso" style="${chipStyle(dashIncFilters.estado === 'En Curso')}">En curso</button>
          <button class="dash-inc-filter-btn" data-filter="estado" data-val="Resuelta" style="${chipStyle(dashIncFilters.estado === 'Resuelta')}">Resuelta</button>
          <button class="dash-inc-filter-btn" data-filter="estado" data-val="Descartada" style="${chipStyle(dashIncFilters.estado === 'Descartada')}">Descartada</button>
        </div>
      </div>
      
      <div>
        <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600; margin-bottom:6px;">CASA</div>
        <div style="display:flex; gap:6px; flex-wrap:wrap;">
          <button class="dash-inc-filter-btn" data-filter="casa" data-val="todas" style="${chipStyle(dashIncFilters.casa === 'todas')}">Todas</button>
          <button class="dash-inc-filter-btn" data-filter="casa" data-val="MIRADOR" style="${chipStyle(dashIncFilters.casa === 'MIRADOR')}">MIRADOR</button>
          <button class="dash-inc-filter-btn" data-filter="casa" data-val="CASON" style="${chipStyle(dashIncFilters.casa === 'CASON')}">CASON</button>
          <button class="dash-inc-filter-btn" data-filter="casa" data-val="GRATAL" style="${chipStyle(dashIncFilters.casa === 'GRATAL')}">GRATAL</button>
        </div>
      </div>
    </div>
  `;

  let contentHtml = '';
  if (!data.length) {
    contentHtml = `
      ${filtersHtml}
      <div class="empty-state" style="padding-top:40px;"><div class="icon">✅</div><p>No hay incidencias para este filtro</p></div>
    `;
  } else {
    contentHtml = `
      <div class="section-header">
        <h2>Incidencias</h2>
        <span class="badge badge-error">${pendientesCount} pendientes</span>
      </div>
      ${filtersHtml}
      <div class="data-list" id="inc-list">
        ${renderIncList(data)}
      </div>
    `;
  }

  el.innerHTML = `
    <div style="display:flex; flex-direction:column; min-height:100%;">
      <div style="flex-grow:1;">
        ${contentHtml}
      </div>
      <div style="margin-top:24px; margin-bottom:20px;">
        <button id="btn-add-inc-real" class="btn btn-primary" style="width:100%; padding:16px; border-radius:12px; font-size:1rem; font-weight:700; box-shadow:0 4px 12px rgba(59, 130, 246, 0.2);">➕ Añadir incidencia</button>
      </div>
    </div>

    <!-- Overlay Editar Incidencia -->
    <div id="modal-editar-incidencia" class="modal-overlay" style="z-index:999; display:none; position:fixed; inset:0; background:var(--bg); overflow-y:auto; padding:0;">
      <div class="modal" style="display:flex; flex-direction:column; width:100%; max-width:650px; margin:0 auto; min-height:100%; background:var(--bg); padding:16px 10px;">
        <div class="modal-header" style="margin-bottom:16px; display:flex; justify-content:space-between; align-items:center; width:100%;">
          <h3 style="margin:0; font-size:1.35rem; font-weight:800; color:var(--text); letter-spacing:-0.02em;">Editar Incidencia</h3>
          <button id="btn-cerrar-edit-inc" style="background:rgba(255,255,255,0.05); border:none; font-size:1.6rem; color:var(--text); opacity:0.8; cursor:pointer; padding:6px 12px; border-radius:8px; margin-right:-4px;">&times;</button>
        </div>
        <form id="form-editar-inc" style="display:flex; flex-direction:column; gap:14px; flex-grow:1;">
          <input type="hidden" name="ticket_id" id="edit-inc-id">
          
          <div>
            <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Casa *</label>
            <select name="casa" id="edit-inc-casa" required class="form-input" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); width:100%; box-sizing:border-box; font-size:1rem; background:rgba(255,255,255,0.03); color:var(--text);">
              <option value="MIRADOR" style="background:var(--bg); color:var(--text);">MIRADOR</option>
              <option value="CASON" style="background:var(--bg); color:var(--text);">CASON</option>
              <option value="GRATAL" style="background:var(--bg); color:var(--text);">GRATAL</option>
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Ubicación *</label>
            <select name="ubicacion" id="edit-inc-ubicacion" required class="form-input" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); width:100%; box-sizing:border-box; font-size:1rem; background:rgba(255,255,255,0.03); color:var(--text);">
            </select>
          </div>

          <div>
            <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Categoría *</label>
            <select name="categoria" id="edit-inc-categoria" required class="form-input" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); width:100%; box-sizing:border-box; font-size:1rem; background:rgba(255,255,255,0.03); color:var(--text);">
              ${CATEGORIAS_INCIDENCIA.map(c => `<option value="${c}" style="background:var(--bg); color:var(--text);">${c}</option>`).join('')}
            </select>
          </div>

          <div style="display:grid; grid-template-columns: 1.2fr 1fr; gap:12px;">
            <div>
              <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Estado *</label>
              <select name="estado" id="edit-inc-estado" required class="form-input" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); width:100%; box-sizing:border-box; font-size:0.95rem; background:rgba(255,255,255,0.03); color:var(--text);">
                <option value="Pendiente">Pendiente</option>
                <option value="En curso">En curso</option>
                <option value="Resuelta">Resuelta</option>
                <option value="Descartada">Descartada</option>
              </select>
            </div>
            <div>
              <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Prioridad *</label>
              <select name="prioridad" id="edit-inc-prioridad" required class="form-input" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); width:100%; box-sizing:border-box; font-size:0.95rem; background:rgba(255,255,255,0.03); color:var(--text);">
                <option value="Normal">Normal</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label style="display:block; font-size:0.8rem; font-weight:600; color:var(--text-muted); margin-bottom:4px;">Descripción *</label>
            <textarea name="descripcion" id="edit-inc-desc" required class="form-input" rows="4" style="padding:12px; border-radius:10px; border:1px solid rgba(255,255,255,0.1); width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit; resize:vertical; background:rgba(255,255,255,0.03); color:var(--text);" placeholder="Escribe aquí los detalles..."></textarea>
          </div>

          <div style="margin-top:auto; padding-top:14px; padding-bottom:12px; display:flex; gap:10px; align-items:center;">
            <button type="button" id="btn-cancel-edit-inc" class="btn btn-secondary" style="flex:1; padding:14px 8px; border-radius:12px; font-weight:700; font-size:0.95rem;">Cancelar</button>
            <button type="submit" id="btn-submit-inc" class="btn btn-primary" style="flex:2; padding:14px 8px; border-radius:12px; font-weight:700; font-size:0.95rem; box-shadow:0 4px 12px rgba(59, 130, 246, 0.2); white-space:nowrap;">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  `;

  // Asignar eventos a filtros
  el.querySelectorAll('.dash-inc-filter-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const type = btn.dataset.filter;
      const val = btn.dataset.val;
      dashIncFilters[type] = val;
      incidencias(el); // recargar tab
    });
  });

  // Lógica Overlay Editar Incidencia
  const modal = el.querySelector('#modal-editar-incidencia');
  const selCasa = el.querySelector('#edit-inc-casa');
  const selUbicacion = el.querySelector('#edit-inc-ubicacion');

  function rellenarUbicaciones(casaSeleccionada, ubicacionPrevia) {
    const ubs = getUbicaciones(casaSeleccionada);
    selUbicacion.innerHTML = ubs.map(u => `<option value="${u}" style="background:var(--bg); color:var(--text);">${u}</option>`).join('')
      + `<option value="Otra zona..." style="background:var(--bg); color:var(--text); font-style:italic;">Otra zona...</option>`;

    // Si la ubicación previa existe en la nueva casa (o es "Otra zona..."), mantenerla
    if (ubicacionPrevia && (ubs.includes(ubicacionPrevia) || ubicacionPrevia === 'Otra zona...')) {
      selUbicacion.value = ubicacionPrevia;
    } else {
      selUbicacion.value = ubs[0] || 'Otra zona...';
    }
  }

  if (el.querySelector('#inc-list')) {
    el.querySelector('#inc-list').addEventListener('click', async e => {
      const btn = e.target.closest('[data-action]');
      if (!btn) return;
      const { action, id } = btn.dataset;

      if (action === 'editar-inc') {
        const inc = data.find(i => i.ticket_id === id);
        if (!inc) return;

        el.querySelector('#edit-inc-id').value = inc.ticket_id;
        selCasa.value = inc.casa || 'MIRADOR';
        rellenarUbicaciones(selCasa.value, inc.ubicacion);

        el.querySelector('#edit-inc-categoria').value = inc.categoria;
        el.querySelector('#edit-inc-prioridad').value = inc.prioridad || 'Normal';

        const estado = inc.estado === 'Pendiente' || inc.estado === 'En curso' || inc.estado === 'Resuelta' || inc.estado === 'Descartada' ? inc.estado : 'Pendiente';
        el.querySelector('#edit-inc-estado').value = estado;

        el.querySelector('#edit-inc-desc').value = inc.descripcion || '';

        modal.style.display = 'block';
        return; // No disparamos llamada a API todavía
      }

      btn.disabled = true;
      try {
        if (action === 'resolver') {
          await api.updateIncidencia(id, { estado: 'Resuelta' });
          toast('Incidencia resuelta ✅', 'success');
        } else if (action === 'en-curso') {
          await api.updateIncidencia(id, { estado: 'En curso' });
          toast('Estado actualizado', 'success');
        } else if (action === 'set-prio-inc') {
          const nuevaPrio = btn.dataset.prio;
          await api.updateIncidencia(id, { prioridad: nuevaPrio });
          toast(`Prioridad → ${nuevaPrio}`, 'success');
        }
        const freshParams = {};
        if (dashIncFilters.estado && dashIncFilters.estado !== 'todos') freshParams.estado = dashIncFilters.estado;
        if (dashIncFilters.casa && dashIncFilters.casa !== 'todas') freshParams.casa = dashIncFilters.casa;
        const freshRaw = await api.incidencias(freshParams);
        const fresh = applyIncFiltersLocal(freshRaw, dashIncFilters);

        data.length = 0;
        data.push(...fresh);
        el.querySelector('#inc-list').innerHTML = renderIncList(fresh);
        const penCount = fresh.filter(i => {
          const est = (i.estado || '').toLowerCase();
          return est !== 'resuelta' && est !== 'descartada';
        }).length;
        el.querySelector('.section-header .badge').textContent = `${penCount} pendientes`;
      } catch (err) { toast('Error: ' + err.message, 'error'); btn.disabled = false; }
    });
  }

  // ── Lógica Añadir Incidencia ──
  el.querySelector('#btn-add-inc-real').addEventListener('click', () => {
    const modal = document.createElement('div');
    modal.className = 'modal-overlay';
    modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';

    const fieldStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; width:100%; font-size:.85rem; height:50px; outline:none; transition:border-color .2s;`;

    modal.innerHTML = `
      <div style="background:var(--bg-surface);border-radius:20px 20px 0 0;padding:24px 20px 44px;width:100%;max-width:480px;border-top:1px solid var(--border);">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h3 style="margin:0;color:var(--text);font-size:1.1rem;font-weight:800;">Añadir Incidencia</h3>
          <button id="btn-close-add-inc" style="background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer;">&times;</button>
        </div>
        
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Casa (obligatorio)</label>
          <select id="m-add-casa" style="${fieldStyle}">
            <option value="MIRADOR">MIRADOR</option>
            <option value="CASON">CASON</option>
            <option value="GRATAL">GRATAL</option>
          </select>
        </div>
        
        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Categoría (obligatorio)</label>
          <select id="m-add-cat" style="${fieldStyle}">
            ${CATEGORIAS_INCIDENCIA.map(c => `<option value="${c}">${c}</option>`).join('')}
          </select>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:12px;">
          <div>
            <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Ubicación (obligatorio)</label>
            <select id="m-add-ubicacion" style="${fieldStyle}">
              <!-- Se rellena dinámicamente -->
            </select>
          </div>
          <div>
            <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Prioridad (obligatorio)</label>
            <select id="m-add-prioridad" style="${fieldStyle}">
              <option value="Normal">Normal</option>
              <option value="Urgente">Urgente</option>
            </select>
          </div>
        </div>

        <div style="margin-bottom:12px;">
          <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Descripción (obligatorio)</label>
          <input type="text" id="m-add-desc" placeholder="Ej: Pila del baño atascada" style="${fieldStyle}">
        </div>

        <div style="margin-bottom:16px;">
          <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">📷 Fotos o vídeo (opcional)</label>
          <div class="foto-grid" id="m-add-grid">
            <label class="foto-add-btn" for="m-add-media0">
              <span class="plus">+</span><span>Foto/vídeo</span>
            </label>
            <input type="file" id="m-add-media0" accept="image/*,video/*" multiple style="display:none"/>
          </div>
        </div>

        <button id="btn-save-add-inc" class="btn btn-primary w-full" style="padding:16px;border-radius:12px;font-weight:700;">Guardar incidencia</button>
      </div>
    `;
    document.body.appendChild(modal);

    // ── Media: fotos + vídeo ────────────────────────────────────────────────
    let addFotos = [];   // solo imágenes
    let addVideo = null; // un único vídeo
    let addMediaIdx = 1;

    function esVideoFile(f) { return f.type.startsWith('video/'); }

    function refreshAddGrid() {
      const grid = modal.querySelector('#m-add-grid');
      const idx = addMediaIdx++;
      const fotosThumb = addFotos.map((f, i) =>
        `<img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="${i}"/>`
      ).join('');
      const videoThumb = addVideo
        ? `<div class="foto-thumb" style="display:flex;align-items:center;justify-content:center;background:#1e293b;font-size:1.8rem;" title="${addVideo.name}">🎬</div>`
        : '';
      const puedeAnadirFotos = addFotos.length < 5;
      const puedeAnadirVideo = !addVideo;
      const addBtn = (puedeAnadirFotos || puedeAnadirVideo) ? `
        <label class="foto-add-btn" for="m-add-media${idx}">
          <span class="plus">+</span><span>Más</span>
        </label>
        <input type="file" id="m-add-media${idx}" accept="image/*,video/*"
               ${puedeAnadirFotos ? 'multiple' : ''} style="display:none"/>
      ` : '';
      grid.innerHTML = fotosThumb + videoThumb + addBtn;
      if (puedeAnadirFotos || puedeAnadirVideo) bindAddMedia(`m-add-media${idx}`);
    }

    function bindAddMedia(id) {
      modal.querySelector(`#${id}`)?.addEventListener('change', e => {
        Array.from(e.target.files).forEach(f => {
          if (esVideoFile(f)) {
            if (!addVideo) addVideo = f;
          } else {
            if (addFotos.length < 5) addFotos.push(f);
          }
        });
        refreshAddGrid();
      });
    }
    bindAddMedia('m-add-media0');

    const selAddCasa = modal.querySelector('#m-add-casa');
    const selAddUbi = modal.querySelector('#m-add-ubicacion');

    function refrescarUbiAlta() {
      const ubs = getUbicaciones(selAddCasa.value);
      selAddUbi.innerHTML = ubs.map(u => `<option value="${u}">${u}</option>`).join('')
        + `<option value="Otra zona..." style="font-style:italic;">Otra zona...</option>`;
    }

    refrescarUbiAlta(); // carga inicial
    selAddCasa.addEventListener('change', refrescarUbiAlta);

    const close = () => modal.remove();
    modal.querySelector('#btn-close-add-inc').onclick = close;
    modal.onclick = (e) => { if (e.target === modal) close(); };

    modal.querySelector('#btn-save-add-inc').onclick = async function () {
      const btn = this;
      const casa = modal.querySelector('#m-add-casa').value;
      const cat = modal.querySelector('#m-add-cat').value;
      const ubi = modal.querySelector('#m-add-ubicacion').value;
      const prio = modal.querySelector('#m-add-prioridad').value;
      const desc = modal.querySelector('#m-add-desc').value.trim();

      if (!desc) { toast('Añade una descripción', 'warning'); return; }

      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        const fd = new FormData();
        fd.append('casa', casa);
        fd.append('categoria', cat);
        fd.append('ubicacion', ubi);
        fd.append('prioridad', prio);
        fd.append('descripcion', desc);
        addFotos.forEach(f => fd.append('fotos', f));
        if (addVideo) fd.append('video', addVideo);

        await api.crearIncidencia(fd);
        toast('Incidencia creada ✅', 'success');
        close();
        incidencias(el); // recargar tab
      } catch (err) {
        toast('Error: ' + err.message, 'error');
        btn.disabled = false;
        btn.textContent = 'Guardar incidencia';
      }
    };
  });

  selCasa.addEventListener('change', () => {
    rellenarUbicaciones(selCasa.value, selUbicacion.value);
  });

  // Botones de cierre
  const cerrarModalEdit = () => { modal.style.display = 'none'; };
  el.querySelector('#btn-cerrar-edit-inc').addEventListener('click', cerrarModalEdit);
  el.querySelector('#btn-cancel-edit-inc').addEventListener('click', cerrarModalEdit);

  el.querySelector('#form-editar-inc').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = el.querySelector('#btn-submit-inc');
    btn.disabled = true;
    btn.textContent = 'Guardando...';

    const id = el.querySelector('#edit-inc-id').value;
    const payload = {
      casa: selCasa.value,
      ubicacion: selUbicacion.value,
      categoria: el.querySelector('#edit-inc-categoria').value,
      prioridad: el.querySelector('#edit-inc-prioridad').value,
      estado: el.querySelector('#edit-inc-estado').value,
      descripcion: el.querySelector('#edit-inc-desc').value
    };

    try {
      await api.updateIncidencia(id, payload);
      toast('Incidencia actualizada', 'success');
      modal.style.display = 'none';

      const freshParams = {};
      if (dashIncFilters.estado && dashIncFilters.estado !== 'todos') freshParams.estado = dashIncFilters.estado;
      if (dashIncFilters.casa && dashIncFilters.casa !== 'todas') freshParams.casa = dashIncFilters.casa;
      const freshRaw = await api.incidencias(freshParams);
      const fresh = applyIncFiltersLocal(freshRaw, dashIncFilters);

      // Update local data reference so reopen works immediately
      data.length = 0;
      data.push(...fresh);
      el.querySelector('#inc-list').innerHTML = renderIncList(fresh);
      const penCount = fresh.filter(i => {
        const est = (i.estado || '').toLowerCase();
        return est !== 'resuelta' && est !== 'descartada';
      }).length;
      el.querySelector('.section-header .badge').textContent = `${penCount} pendientes`;
    } catch (err) {
      toast('Error: ' + err.message, 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Guardar Cambios';
    }
  });

}

function prioChips(currentPrio, id, action) {
  const prioOpts = [
    { val: 'Normal', label: 'Normal', bg: 'rgba(234,179,8,.18)', color: '#ca8a04', border: 'rgba(234,179,8,.4)' },
    { val: 'Urgente', label: 'Urgente', bg: 'rgba(239,68,68,.18)', color: '#dc2626', border: 'rgba(239,68,68,.4)' },
  ];
  return `<div style="display:flex;gap:4px;margin-top:4px;">${prioOpts.map(p => {
    const active = currentPrio === p.val;
    return `<button
        data-action="${action}"
        data-id="${id}"
        data-prio="${p.val}"
        style="font-size:.68rem;padding:2px 8px;border-radius:20px;border:1px solid ${active ? p.border : 'rgba(255,255,255,.12)'};
               background:${active ? p.bg : 'transparent'};color:${active ? p.color : 'var(--text-muted)'};
               cursor:${active ? 'default' : 'pointer'};font-weight:${active ? '700' : '400'};transition:all .15s;"
        ${active ? 'disabled' : ''}>
        ${p.label}
      </button>`;
  }).join('')
    }</div>`;
}

function renderIncMediaBadges(i) {
  // Prioridad: signed URLs generadas por el backend (bucket privado)
  // Fallback: campo legacy 'Foto URL' (incidencias antiguas de Sheets)
  const fotos = (i.fotos_signed_urls && i.fotos_signed_urls.length)
    ? i.fotos_signed_urls
    : (i['Foto URL'] ? [i['Foto URL']] : []);

  const videoUrl = i.video_signed_url || null;

  if (!fotos.length && !videoUrl) return '';

  const MAX_THUMB = 3;
  const visibles = fotos.slice(0, MAX_THUMB);
  const resto = fotos.length - MAX_THUMB;

  const thumbsHTML = visibles.map(url => `
    <a href="${url}" target="_blank"
       style="display:inline-block;width:36px;height:36px;border-radius:6px;
              overflow:hidden;border:1px solid rgba(255,255,255,.15);flex-shrink:0;">
      <img src="${url}" style="width:100%;height:100%;object-fit:cover;"
           onerror="this.parentElement.innerHTML='\u{1F4F7}';"/>
    </a>`).join('');

  const masHTML = resto > 0
    ? `<span style="font-size:.7rem;color:var(--text-muted);align-self:center;">+${resto}</span>`
    : '';

  const videoHTML = videoUrl
    ? `<a href="${videoUrl}" target="_blank"
          style="display:inline-flex;align-items:center;gap:3px;font-size:.7rem;
                 color:var(--primary);background:rgba(59,130,246,.1);
                 border:1px solid rgba(59,130,246,.25);border-radius:6px;
                 padding:2px 6px;flex-shrink:0;">
        \uD83C\uDFAC <span>V\u00eddeo</span>
      </a>`
    : '';

  return `<div style="display:flex;align-items:center;gap:4px;flex-wrap:wrap;margin-top:4px;">
    ${thumbsHTML}${masHTML}${videoHTML}
  </div>`;
}

function renderIncList(data) {
  const prioIcon = { Urgente: '🆘', Normal: '🟡' };
  return data.map(i => {
    const est = i.estado || 'Pendiente';
    const isResuelta = est.toLowerCase() === 'resuelta';
    const isDescartada = est.toLowerCase() === 'descartada';
    const isCerrada = isResuelta || isDescartada;

    return `
    <div class="data-row" style="border-left:3px solid ${i.prioridad === 'Urgente' ? 'var(--danger)' : 'var(--warning)'}">
      <div class="data-row-main">
        <h4>${prioIcon[i.prioridad] || ''} ${i.casa} · ${i.categoria}</h4>
        <p>${i.ubicacion} · ${i.descripcion?.slice(0, 60) || ''}</p>
        <p style="color:var(--text-muted);font-size:.7rem;">${i.fecha_creacion?.slice(0, 10) || ''} · ${i.responsable || 'Sin asignar'}</p>
        ${renderIncMediaBadges(i)}
        ${prioChips(i.prioridad, i.ticket_id, 'set-prio-inc')}
      </div>
      <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
        <span class="badge ${isCerrada ? 'badge-ok' : est === 'En curso' ? 'badge-pending' : 'badge-error'}" ${isDescartada ? 'style="background: #475569; color: #f8fafc;"' : ''}>
          ${isResuelta ? '\u2705 Resuelta' : isDescartada ? '\u26d4 Descartada' : est}
        </span>
        ${!isCerrada ? `
          ${est !== 'En curso' ? `<button class="btn btn-sm btn-secondary" style="width:100%;padding:4px 8px;justify-content:center;" data-action="en-curso" data-id="${i.ticket_id}">En curso</button>` : ''}
          <button class="btn btn-sm btn-success" style="width:100%;padding:4px 8px;justify-content:center;" data-action="resolver" data-id="${i.ticket_id}">Resolver</button>
        `: ''}
        <button class="btn btn-sm btn-secondary" style="width:100%;padding:4px 8px;justify-content:center;margin-top:2px;border:1px solid rgba(255,255,255,0.2);" data-action="editar-inc" data-id="${i.ticket_id}">✏️ Editar</button>
      </div>
    </div>
  `}).join('');
}

let dashConsumiblesFilters = { estado: 'Pendiente', casa: 'Todas' };

function applyConsFiltersLocal(rawData, filters) {
  return rawData.filter(c => {
    const est = c.estado || 'Pendiente';
    if (filters.estado === 'Todos' && est === 'Descartado') return false;
    return true;
  });
}

async function consumibles(el) {
  const reloadCons = async () => {
    const params = {};
    if (dashConsumiblesFilters.estado && dashConsumiblesFilters.estado !== 'Todos') params.estado = dashConsumiblesFilters.estado;
    if (dashConsumiblesFilters.casa && dashConsumiblesFilters.casa !== 'Todas') params.casa = dashConsumiblesFilters.casa;

    const rawData = await api.consumibles(params);
    const data = applyConsFiltersLocal(rawData, dashConsumiblesFilters);

    const pendientesCount = data.filter(c => (c.estado || 'Pendiente') === 'Pendiente').length;

    const compactChipStyle = (isActive) => `padding: 4px 10px; border-radius: 16px; font-size: 0.75rem; font-weight: 500; border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; background: ${isActive ? 'var(--primary)' : 'transparent'}; color: ${isActive ? '#fff' : 'var(--text-muted)'}; cursor: pointer; flex-shrink: 0; transition: all 0.2s; -webkit-tap-highlight-color: transparent;`;

    const filtersHtml = `
      <div style="background:var(--bg-surface); padding:12px; border-radius:10px; margin-bottom:16px; border:1px solid var(--border); display:flex; flex-direction:column; gap:12px;">
        <div style="font-size:0.8rem; font-weight:700; color:var(--text); text-transform:uppercase; letter-spacing:0.5px;">Filtros</div>
        
        <div>
          <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600; margin-bottom:6px;">ESTADO</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="dash-cons-filter-btn" data-filter="estado" data-val="Todos" style="${compactChipStyle(dashConsumiblesFilters.estado === 'Todos')}">Todos</button>
            <button class="dash-cons-filter-btn" data-filter="estado" data-val="Pendiente" style="${compactChipStyle(dashConsumiblesFilters.estado === 'Pendiente')}">Pendiente</button>
            <button class="dash-cons-filter-btn" data-filter="estado" data-val="Repuesto" style="${compactChipStyle(dashConsumiblesFilters.estado === 'Repuesto')}">Repuesto</button>
            <button class="dash-cons-filter-btn" data-filter="estado" data-val="Descartado" style="${compactChipStyle(dashConsumiblesFilters.estado === 'Descartado')}">Descartado</button>
          </div>
        </div>
        
        <div>
          <div style="font-size:0.7rem; color:var(--text-muted); font-weight:600; margin-bottom:6px;">CASA</div>
          <div style="display:flex; gap:6px; flex-wrap:wrap;">
            <button class="dash-cons-filter-btn" data-filter="casa" data-val="Todas" style="${compactChipStyle(dashConsumiblesFilters.casa === 'Todas')}">Todas</button>
            <button class="dash-cons-filter-btn" data-filter="casa" data-val="MIRADOR" style="${compactChipStyle(dashConsumiblesFilters.casa === 'MIRADOR')}">MIRADOR</button>
            <button class="dash-cons-filter-btn" data-filter="casa" data-val="CASON" style="${compactChipStyle(dashConsumiblesFilters.casa === 'CASON')}">CASON</button>
            <button class="dash-cons-filter-btn" data-filter="casa" data-val="GRATAL" style="${compactChipStyle(dashConsumiblesFilters.casa === 'GRATAL')}">GRATAL</button>
          </div>
        </div>
      </div>
    `;

    let contentHtml = '';

    if (!data.length) {
      contentHtml = filtersHtml + '<div class="empty-state" style="padding-top:40px;"><div class="icon">✅</div><p>Sin consumibles para estos filtros</p></div>';
    } else {
      let listTitle = `Pendientes (${pendientesCount})`;
      if (dashConsumiblesFilters.estado === 'Repuesto') listTitle = `Repuestos (${data.length})`;
      else if (dashConsumiblesFilters.estado === 'Descartado') listTitle = `Descartados (${data.length})`;

      contentHtml = `
        ${filtersHtml}
        <div class="section-header"><h2>${listTitle}</h2></div>
        <div class="data-list" id="cons-list">
          ${data.sort((a, b) => (b.urgencia === 'Urgente') - (a.urgencia === 'Urgente')).map(c => {
        const isPendiente = (!c.estado || c.estado === 'Pendiente');
        const isDescartado = c.estado === 'Descartado';
        return `
            <div class="data-row cons-row" data-req-id="${c.req_id}">
              <div class="data-row-main">
                <h4>${c.urgencia === 'Urgente' ? '⚡ ' : ''}${c.item}${c.item_otro ? ' · ' + c.item_otro : ''}${c.cantidad && c.cantidad > 1 ? ' · x' + c.cantidad : ''}</h4>
                <p style="font-size:.75rem;color:var(--text-muted);">${c.casa}${c.nota ? ' · ' + c.nota : ''}</p>
                ${isPendiente ? prioChips(c.urgencia === 'Urgente' ? 'Urgente' : 'Normal', c.req_id, 'set-prio-cons') : ''}
              </div>
              <div style="display:flex; flex-direction:column; gap:6px; align-items:stretch; min-width:110px;">
                ${isPendiente 
                  ? `<button class="btn btn-sm btn-success" style="padding:6px 10px;justify-content:center;" data-id="${c.req_id}" data-action="reponer">✅ Repuesto</button>
                     <button class="btn btn-sm" style="padding:6px 10px;justify-content:center;background:rgba(239, 68, 68, 0.1);color:#ef4444;border:1px solid rgba(239, 68, 68, 0.3);" data-id="${c.req_id}" data-action="descartar">⛔ Descartar</button>` 
                  : `<span class="badge ${isDescartado ? 'badge-error' : 'badge-success'}" style="text-align:center;">${c.estado}</span>`}
              </div>
            </div>
            `;
          }).join('')}
        </div>
      `;
      }

    el.innerHTML = `
      <div style="display:flex; flex-direction:column; min-height:100%;">
        <div style="flex-grow:1;">
          ${contentHtml}
        </div>
        <div style="margin-top:24px; margin-bottom:20px; display:flex; flex-direction:column; gap:10px;">
          <button id="btn-add-cons-real" class="btn btn-primary" style="width:100%; padding:16px; border-radius:12px; font-size:1rem; font-weight:700; box-shadow:0 4px 12px rgba(59, 130, 246, 0.2);">➕ Registrar consumible</button>
          <button id="btn-gestionar-catalogo" style="width:100%;padding:10px;border-radius:12px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:.8rem;font-weight:600;cursor:pointer;">⚙️ Gestionar catálogo</button>
        </div>
      </div>
    `;

      // Asignar eventos a filtros
      el.querySelectorAll('.dash-cons-filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          const type = btn.dataset.filter;
          const val = btn.dataset.val;
          dashConsumiblesFilters[type] = val;
          reloadCons(); // recargar tab
        });
      });

      if (el.querySelector('#cons-list')) {

        el.querySelector('#cons-list').addEventListener('click', async e => {
          const btn = e.target.closest('[data-action]');
          if (!btn) return;
          const { action, id } = btn.dataset;
          btn.disabled = true;
          try {
            if (action === 'reponer') {
              await api.updateConsumo(id, { estado: 'Repuesto' });
              toast('Marcado como repuesto ✅', 'success');
              if (dashConsumiblesFilters.estado === 'Pendiente' || dashConsumiblesFilters.estado === 'Todos') {
                  btn.closest('.cons-row').remove();
                  const remaining = el.querySelectorAll('.cons-row').length;
                  const hdr = el.querySelector('.section-header h2');
                  if (hdr && dashConsumiblesFilters.estado === 'Pendiente') hdr.textContent = `Pendientes (${remaining})`;
                  if (!remaining) await reloadCons();
              } else {
                  await reloadCons();
              }
            } else if (action === 'descartar') {
              await api.updateConsumo(id, { estado: 'Descartado' });
              toast('Consumible descartado', 'success');
              if (dashConsumiblesFilters.estado === 'Pendiente' || dashConsumiblesFilters.estado === 'Todos') {
                  btn.closest('.cons-row').remove();
                  const remaining = el.querySelectorAll('.cons-row').length;
                  const hdr = el.querySelector('.section-header h2');
                  if (hdr && dashConsumiblesFilters.estado === 'Pendiente') hdr.textContent = `Pendientes (${remaining})`;
                  if (!remaining) await reloadCons();
              } else {
                  await reloadCons();
              }
            } else if (action === 'set-prio-cons') {
              const nuevaPrio = btn.dataset.prio;
              await api.updateConsumo(id, { urgencia: nuevaPrio });
              toast(`Prioridad → ${nuevaPrio}`, 'success');
              await reloadCons();
            }
          } catch (err) { toast('Error: ' + err.message, 'error'); btn.disabled = false; }
        });
      }

      // ── Lógica Añadir Consumible ──
      el.querySelector('#btn-add-cons-real').addEventListener('click', () => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';

        const fieldStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; width:100%; font-size:.85rem; height:50px; outline:none; transition:border-color .2s;`;

        modal.innerHTML = `
        <div style="background:var(--bg-surface);border-radius:20px 20px 0 0;padding:24px 20px 44px;width:100%;max-width:480px;border-top:1px solid var(--border);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
            <h3 style="margin:0;color:var(--text);font-size:1.1rem;font-weight:800;">Añadir Consumible</h3>
            <button id="btn-close-add-cons" style="background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer;">&times;</button>
          </div>
          
          <div style="margin-bottom:12px;">
            <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Casa (obligatorio)</label>
            <select id="mc-add-casa" style="${fieldStyle}">
              <option value="MIRADOR">MIRADOR</option>
              <option value="CASON">CASON</option>
              <option value="GRATAL">GRATAL</option>
            </select>
          </div>
          
          <div style="margin-bottom:12px; position:relative;">
            <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Producto (obligatorio)</label>
            <div id="mc-add-prod-container" style="position:relative;">
                <select id="mc-add-prod-select" style="${fieldStyle}" disabled>
                    <option value="">Cargando catálogo...</option>
                </select>
            </div>
          </div>

          <div id="mc-add-prod-otro-container" style="margin-bottom:12px; display:none;">
            <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Otro consumible (especificar)</label>
            <input type="text" id="mc-add-prod-otro" placeholder="Ej: Jabón especial" style="${fieldStyle}">
          </div>

          <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:16px;">
            <div>
              <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Cantidad (obligatorio)</label>
              <input type="number" id="mc-add-cant" value="1" min="1" style="${fieldStyle}">
            </div>
            <div>
              <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Urgencia (obligatorio)</label>
              <select id="mc-add-urg" style="${fieldStyle}">
                <option value="Normal">Normal</option>
                <option value="Urgente">Urgente</option>
              </select>
            </div>
          </div>

          <button id="btn-save-add-cons" class="btn btn-primary w-full" style="padding:16px;border-radius:12px;font-weight:700;" disabled>Cargando catálogo...</button>
        </div>
      `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('#btn-close-add-cons').onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };

        const casaSelect = modal.querySelector('#mc-add-casa');
        const prodSelect = modal.querySelector('#mc-add-prod-select');
        const otroContainer = modal.querySelector('#mc-add-prod-otro-container');
        const otroInput = modal.querySelector('#mc-add-prod-otro');
        const saveBtn = modal.querySelector('#btn-save-add-cons');

        const loadCatalog = async (casa) => {
            prodSelect.innerHTML = '<option value="">Cargando catálogo...</option>';
            prodSelect.disabled = true;
            saveBtn.disabled = true;
            saveBtn.textContent = 'Cargando...';
            
            try {
                const catData = await api.catalogoConsumo(casa);
                let options = '<option value="" disabled selected>Selecciona un producto</option>';
                if (catData && catData.length) {
                    catData.forEach(p => {
                        const itemStr = typeof p === 'string' ? p : (p.item || p);
                        options += `<option value="${itemStr}">${itemStr}</option>`;
                    });
                }
                options += '<option value="_OTRO_">No está en la lista (escribir otro)</option>';
                prodSelect.innerHTML = options;
                prodSelect.disabled = false;
                saveBtn.disabled = false;
                saveBtn.textContent = 'Registrar consumible';
            } catch (e) {
                console.error(e);
                prodSelect.innerHTML = '<option value="_OTRO_">Error cargando catálogo (escribir manual)</option>';
                prodSelect.disabled = false;
                prodSelect.value = '_OTRO_';
                saveBtn.disabled = false;
                saveBtn.textContent = 'Registrar consumible';
                otroContainer.style.display = 'block';
                setTimeout(() => otroInput.focus(), 50);
            }
        };

        loadCatalog(casaSelect.value);

        casaSelect.addEventListener('change', (e) => {
            loadCatalog(e.target.value);
            otroContainer.style.display = 'none';
        });

        prodSelect.addEventListener('change', (e) => {
            if (e.target.value === '_OTRO_') {
                otroContainer.style.display = 'block';
                otroInput.focus();
            } else {
                otroContainer.style.display = 'none';
            }
        });

        saveBtn.onclick = async function () {
          const btn = this;
          const casa = casaSelect.value;
          const prodVal = prodSelect.value;
          const cant = parseInt(modal.querySelector('#mc-add-cant').value) || 1;
          const urgencia = modal.querySelector('#mc-add-urg').value;

          if (!prodVal) { toast('Selecciona un producto', 'warning'); return; }
          
          let finalItem = prodVal;
          let finalOtro = '';

          if (prodVal === '_OTRO_') {
              const txt = otroInput.value.trim();
              if (!txt) { toast('Escribe el producto', 'warning'); return; }
              finalItem = 'Otro';
              finalOtro = txt;
          }

          btn.disabled = true;
          btn.textContent = 'Guardando...';

          try {
            await api.registrarConsumo({
              parte_id: 'RAPIDO-' + casa, // para que quede huella de alta rápida
              casa,
              items: [{
                item: finalItem,
                item_otro: finalOtro,
                cantidad: cant,
                urgencia
              }],
              fuente: 'alta_rapida'
            });

            toast('Consumible registrado ✅', 'success');
            close();
            reloadCons(); // recargar
          } catch (err) {
            toast('Error: ' + err.message, 'error');
            btn.disabled = false;
            btn.textContent = 'Guardar consumible';
          }
        };
      });

      el.querySelector('#btn-gestionar-catalogo').addEventListener('click', renderCatalogAdmin);
    };

    function renderCatalogAdmin() {
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.75);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';

      const fld = 'background:#0b1220;border:1px solid rgba(148,163,184,.35);border-radius:10px;padding:8px 12px;color:#f8fafc;width:100%;font-size:.8rem;height:40px;outline:none;';
      const chipOn = 'padding:4px 10px;border-radius:16px;font-size:.72rem;font-weight:600;border:1px solid var(--primary);background:var(--primary);color:#fff;cursor:pointer;flex-shrink:0;';
      const chipOff = 'padding:4px 10px;border-radius:16px;font-size:.72rem;font-weight:600;border:1px solid var(--border);background:transparent;color:var(--text-muted);cursor:pointer;flex-shrink:0;';

      modal.innerHTML = `
        <div style="background:var(--bg-surface);border-radius:20px 20px 0 0;padding:20px 16px 40px;width:100%;max-width:540px;border-top:1px solid var(--border);max-height:90vh;display:flex;flex-direction:column;">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-shrink:0;">
            <h3 style="margin:0;color:var(--text);font-size:1rem;font-weight:800;">⚙️ Gestionar catálogo</h3>
            <button id="btn-close-cat-admin" style="background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer;">&times;</button>
          </div>

          <div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:14px;flex-shrink:0;" id="cat-casa-filter">
            <button class="cat-f-btn" data-casa="" style="${chipOn}">Todas</button>
            <button class="cat-f-btn" data-casa="ALL" style="${chipOff}">ALL</button>
            <button class="cat-f-btn" data-casa="MIRADOR" style="${chipOff}">MIRADOR</button>
            <button class="cat-f-btn" data-casa="CASON" style="${chipOff}">CASÓN</button>
            <button class="cat-f-btn" data-casa="GRATAL" style="${chipOff}">GRATAL</button>
          </div>

          <div id="cat-admin-list" style="flex:1;overflow-y:auto;margin-bottom:14px;">
            <div style="display:flex;justify-content:center;padding:24px;"><div class="loading-spinner"></div></div>
          </div>

          <div style="border-top:1px solid var(--border);padding-top:14px;flex-shrink:0;">
            <div style="font-size:.75rem;font-weight:700;color:var(--text);margin-bottom:10px;">➕ Nuevo producto</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px;">
              <div>
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;margin-bottom:4px;">CASA</div>
                <select id="cat-new-casa" style="${fld}">
                  <option value="ALL">ALL (todas)</option>
                  <option value="MIRADOR">MIRADOR</option>
                  <option value="CASON">CASÓN</option>
                  <option value="GRATAL">GRATAL</option>
                </select>
              </div>
              <div>
                <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;margin-bottom:4px;">ORDEN (opcional)</div>
                <input type="number" id="cat-new-orden" placeholder="Auto" min="1" style="${fld}">
              </div>
            </div>
            <div style="margin-bottom:8px;">
              <div style="font-size:.65rem;color:var(--text-muted);font-weight:600;margin-bottom:4px;">NOMBRE</div>
              <input type="text" id="cat-new-nombre" placeholder="Nombre del producto" style="${fld}">
            </div>
            <button id="btn-cat-add" class="btn btn-primary" style="width:100%;padding:12px;border-radius:10px;font-weight:700;font-size:.85rem;">Añadir</button>
          </div>
        </div>
      `;

      document.body.appendChild(modal);

      let catFiltro = '';
      let catData = [];

      const listEl = modal.querySelector('#cat-admin-list');

      const renderList = () => {
        const items = catFiltro ? catData.filter(p => p.casa === catFiltro) : catData;
        if (!items.length) {
          listEl.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted);font-size:.82rem;">Sin productos para este filtro</div>';
          return;
        }
        listEl.innerHTML = items.map(p => `
          <div class="cat-item-row" data-id="${p.id}" style="display:flex;align-items:center;gap:8px;padding:9px 0;border-bottom:1px solid var(--border);">
            <div style="flex:1;min-width:0;">
              <div style="font-size:.84rem;font-weight:600;color:${p.activo ? 'var(--text)' : 'var(--text-muted)'};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${p.nombre}</div>
              <div style="display:flex;gap:4px;margin-top:3px;flex-wrap:wrap;">
                <span style="font-size:.62rem;padding:1px 6px;border-radius:8px;background:rgba(148,163,184,.12);color:var(--text-muted);">${p.casa}</span>
                <span style="font-size:.62rem;padding:1px 6px;border-radius:8px;background:rgba(148,163,184,.12);color:var(--text-muted);">#${p.orden}</span>
                <span style="font-size:.62rem;padding:1px 6px;border-radius:8px;background:${p.activo ? 'rgba(34,197,94,.12)' : 'rgba(239,68,68,.12)'};color:${p.activo ? '#22c55e' : '#ef4444'};">${p.activo ? 'Activo' : 'Inactivo'}</span>
              </div>
            </div>
            <button class="cat-edit-btn" data-id="${p.id}" style="padding:4px 8px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:.72rem;cursor:pointer;flex-shrink:0;">✏️</button>
            <button class="cat-toggle-btn" data-id="${p.id}" data-activo="${p.activo}" style="padding:4px 8px;border-radius:8px;border:1px solid ${p.activo ? 'rgba(239,68,68,.4)' : 'rgba(34,197,94,.4)'};background:transparent;color:${p.activo ? '#ef4444' : '#22c55e'};font-size:.7rem;font-weight:600;cursor:pointer;flex-shrink:0;">${p.activo ? 'Desact.' : 'Activar'}</button>
          </div>
        `).join('');

        listEl.querySelectorAll('.cat-toggle-btn').forEach(btn => {
          btn.addEventListener('click', async () => {
            const esActivo = btn.dataset.activo === 'true';
            btn.disabled = true;
            try {
              await api.actualizarCatalogoItem(btn.dataset.id, { activo: !esActivo });
              toast(esActivo ? 'Producto desactivado' : 'Producto activado ✅', 'success');
              await loadCatalogAdmin();
            } catch (e) { toast('Error: ' + e.message, 'error'); btn.disabled = false; }
          });
        });

        listEl.querySelectorAll('.cat-edit-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            const item = catData.find(p => p.id === btn.dataset.id);
            if (item) showEditInline(item);
          });
        });
      };

      const loadCatalogAdmin = async () => {
        listEl.innerHTML = '<div style="display:flex;justify-content:center;padding:20px;"><div class="loading-spinner"></div></div>';
        try {
          catData = await api.catalogoAdmin();
          renderList();
        } catch (e) {
          listEl.innerHTML = `<div style="color:#ef4444;font-size:.82rem;padding:12px;">Error: ${e.message}</div>`;
        }
      };

      const showEditInline = (item) => {
        const row = listEl.querySelector(`[data-id="${item.id}"]`);
        if (!row) return;
        row.innerHTML = `
          <div style="width:100%;display:grid;grid-template-columns:1fr 1fr;gap:6px;">
            <input class="cat-ei-nombre" value="${item.nombre}" style="background:#0b1220;border:1px solid var(--primary);border-radius:8px;padding:6px 10px;color:#f8fafc;font-size:.8rem;height:36px;outline:none;grid-column:1/-1;">
            <select class="cat-ei-casa" style="background:#0b1220;border:1px solid var(--border);border-radius:8px;padding:4px 8px;color:#f8fafc;font-size:.78rem;height:36px;outline:none;">
              <option value="ALL" ${item.casa==='ALL'?'selected':''}>ALL</option>
              <option value="MIRADOR" ${item.casa==='MIRADOR'?'selected':''}>MIRADOR</option>
              <option value="CASON" ${item.casa==='CASON'?'selected':''}>CASÓN</option>
              <option value="GRATAL" ${item.casa==='GRATAL'?'selected':''}>GRATAL</option>
            </select>
            <input type="number" class="cat-ei-orden" value="${item.orden}" min="1" style="background:#0b1220;border:1px solid var(--border);border-radius:8px;padding:6px 10px;color:#f8fafc;font-size:.78rem;height:36px;outline:none;">
            <div style="display:flex;gap:4px;">
              <button class="cat-ei-save" style="flex:1;padding:4px;border-radius:8px;background:var(--primary);border:none;color:#fff;font-size:.75rem;font-weight:700;cursor:pointer;">✓ Guardar</button>
              <button class="cat-ei-cancel" style="flex:1;padding:4px;border-radius:8px;border:1px solid var(--border);background:transparent;color:var(--text-muted);font-size:.75rem;cursor:pointer;">✕</button>
            </div>
          </div>
        `;
        row.querySelector('.cat-ei-cancel').addEventListener('click', renderList);
        row.querySelector('.cat-ei-save').addEventListener('click', async () => {
          const nombre = row.querySelector('.cat-ei-nombre').value.trim();
          const casa = row.querySelector('.cat-ei-casa').value;
          const ordenNum = Number(row.querySelector('.cat-ei-orden').value);
          if (!nombre) { toast('Nombre no puede estar vacío', 'warning'); return; }
          if (!Number.isInteger(ordenNum) || ordenNum < 0) { toast('Orden debe ser un número entero ≥ 0', 'warning'); return; }
          const saveBtn = row.querySelector('.cat-ei-save');
          saveBtn.disabled = true;
          try {
            await api.actualizarCatalogoItem(item.id, { nombre, casa, orden: ordenNum });
            toast('Actualizado ✅', 'success');
            await loadCatalogAdmin();
          } catch (e) { toast('Error: ' + e.message, 'error'); saveBtn.disabled = false; }
        });
      };

      modal.querySelector('#cat-casa-filter').addEventListener('click', e => {
        const btn = e.target.closest('.cat-f-btn');
        if (!btn) return;
        catFiltro = btn.dataset.casa;
        modal.querySelectorAll('.cat-f-btn').forEach(b => b.style.cssText = b.dataset.casa === catFiltro ? chipOn : chipOff);
        renderList();
      });

      modal.querySelector('#btn-cat-add').addEventListener('click', async () => {
        const addBtn = modal.querySelector('#btn-cat-add');
        const casa = modal.querySelector('#cat-new-casa').value;
        const nombre = modal.querySelector('#cat-new-nombre').value.trim();
        const ordenVal = modal.querySelector('#cat-new-orden').value;
        if (!nombre) { toast('Escribe el nombre del producto', 'warning'); modal.querySelector('#cat-new-nombre').focus(); return; }
        if (ordenVal) {
          const n = Number(ordenVal);
          if (!Number.isInteger(n) || n < 0) { toast('Orden debe ser un número entero ≥ 0', 'warning'); return; }
        }
        const payload = { casa, nombre };
        if (ordenVal) payload.orden = Number(ordenVal);
        addBtn.disabled = true;
        addBtn.textContent = 'Añadiendo...';
        try {
          await api.crearCatalogoItem(payload);
          modal.querySelector('#cat-new-nombre').value = '';
          modal.querySelector('#cat-new-orden').value = '';
          toast('Producto añadido ✅', 'success');
          await loadCatalogAdmin();
          modal.querySelector('#cat-new-nombre').focus();
        } catch (e) {
          toast('Error: ' + e.message, 'error');
        } finally {
          addBtn.disabled = false;
          addBtn.textContent = 'Añadir';
        }
      });

      modal.querySelector('#btn-close-cat-admin').onclick = () => modal.remove();
      modal.onclick = e => { if (e.target === modal) modal.remove(); };

      loadCatalogAdmin();
    }

    await reloadCons();
  }

  async function costes(el, _state, loadTab, personaDetalle = null, casaDetalle = null, mesSel = null) {
    el.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;"><div class="loading-spinner"></div></div>';
    const mesActual = getMadridISOString().slice(0, 7);
    const mesLabel = new Intl.DateTimeFormat('es-ES', { timeZone: 'Europe/Madrid', month: 'long', year: 'numeric' }).format(new Date());
    const pisoColor = { MIRADOR: 'var(--mirador)', CASON: 'var(--cason)', GRATAL: 'var(--gratal)' };

    // \u2500\u2500 Vista de detalle por persona \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    if (personaDetalle) {
      const mesFiltro = mesSel || mesActual;
      const [resumen, todosPartes] = await Promise.all([
        api.resumenMensual(mesFiltro).catch(() => ({ empleadas: [] })),
        api.partes({ limit: 500 }).catch(() => []),
      ]);
      const p = (resumen.empleadas || []).find(e => e.nombre === personaDetalle) || {};
      const partesPersona = todosPartes
        .filter(r => r.usuario_nombre === personaDetalle && r.fecha?.startsWith(mesFiltro) && r.fin_ts)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));

      const filasParte = partesPersona.map(r => {
        const dur = parseInt(r.duracion_min || 0);
        const hh = Math.floor(dur / 60);
        const mm = dur % 60;
        const stat = getStatusBadge(r.casa_lista);
        const casaLabel = `<span style="color:var(--${stat.class === 'badge-ok' ? 'success' : (stat.class === 'badge-error' ? 'danger' : 'warning')});font-size:.7rem">${stat.class === 'badge-ok' ? '✅' : (stat.class === 'badge-error' ? '❌' : '⚠️')} ${stat.text}</span>`;

        return `
        <div class="data-row">
          <div class="data-row-main" style="gap:2px;">
            <h4 style="font-size:.82rem;">${formatFechaCompleta(r.fecha)} \u00b7 ${r.casa}</h4>
            <p style="font-size:.72rem;color:var(--text-muted)">${r.tipo_limpieza}</p>
            <p style="font-size:.72rem;">${hh}h ${String(mm).padStart(2, '0')}m \u00b7 ${parseFloat(r.coste_estimado_eur || 0).toFixed(2)}\u20ac ${casaLabel}</p>
          </div>
        </div>`;
      }).join('') || '<div style="padding:12px;color:var(--text-muted);font-size:.82rem;">Sin partes cerrados este mes</div>';

      el.innerHTML = `
      <div class="section-header" style="display:flex;align-items:center;gap:12px;">
        <button class="btn-back" id="btn-volver-costes">Volver</button>
        <h2>${personaDetalle}</h2>
      </div>
      <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px;">
        <div class="stat-card"><div class="num">${p.coste ?? '\u2014'}\u20ac</div><div class="lbl">\ud83d\udcb0 Coste ${mesLabel}</div></div>
        <div class="stat-card"><div class="num">${p.horas ?? '\u2014'}h</div><div class="lbl">\u23f1 Horas ${mesLabel}</div></div>
      </div>
      <div id="persona-partes-header" style="margin-bottom:8px;"></div>
      <div class="data-list">${filasParte}</div>
    `;
      el.querySelector('#btn-volver-costes').addEventListener('click', () => costes(el, _state, loadTab));
      el.querySelector('#persona-partes-header').appendChild(
        mesNavBar(mesFiltro,
          () => costes(el, _state, loadTab, personaDetalle, null, prevMes(mesFiltro)),
          () => costes(el, _state, loadTab, personaDetalle, null, nextMes(mesFiltro))
        )
      );
      return;
    }

    // Vista de detalle por casa
    if (casaDetalle) {
      const mesFiltro = mesSel || mesActual;
      const todosPartes = await api.partes({ limit: 500 }).catch(() => []);
      const partesCasa = todosPartes
        .filter(r => r.casa === casaDetalle && r.fecha?.startsWith(mesFiltro) && r.fin_ts)
        .sort((a, b) => b.fecha.localeCompare(a.fecha));
      const pisoColor2 = { MIRADOR: 'var(--mirador)', CASON: 'var(--cason)', GRATAL: 'var(--gratal)' };
      const colorCasa = pisoColor2[casaDetalle] || 'var(--primary)';

      const filasCasa = partesCasa.map(r => {
        const dur = parseInt(r.duracion_min || 0);
        const hh = Math.floor(dur / 60);
        const mm = dur % 60;
        const stat = getStatusBadge(r.casa_lista);
        const casaLbl = `<span style="color:var(--${stat.class === 'badge-ok' ? 'success' : (stat.class === 'badge-error' ? 'danger' : 'warning')});font-size:.7rem">${stat.class === 'badge-ok' ? '✅' : (stat.class === 'badge-error' ? '❌' : '⚠️')} ${stat.text}</span>`;

        return `
        <div class="data-row">
          <div class="data-row-main" style="gap:2px;">
            <h4 style="font-size:.82rem;">${formatFechaCompleta(r.fecha)} · ${r.usuario_nombre || '—'}</h4>
            <p style="font-size:.72rem;color:var(--text-muted)">${r.tipo_limpieza}</p>
            <p style="font-size:.72rem;">${hh}h ${String(mm).padStart(2, '0')}m · ${parseFloat(r.coste_estimado_eur || 0).toFixed(2)}€ ${casaLbl}</p>
          </div>
        </div>`;
      }).join('') || '<div style="padding:12px;color:var(--text-muted);font-size:.82rem;">Sin partes cerrados este mes</div>';

      el.innerHTML = `
      <div class="section-header" style="display:flex;align-items:center;gap:12px;">
        <button class="btn-back" id="btn-volver-costes2">Volver</button>
        <h2 style="border-left:3px solid ${colorCasa};padding-left:8px;">${casaDetalle}</h2>
      </div>
      <div class="section-header" style="margin-bottom:8px;" id="casa-partes-header"></div>
      <div class="data-list">${filasCasa}</div>
    `;
      el.querySelector('#btn-volver-costes2').addEventListener('click', () => costes(el, _state, loadTab));
      el.querySelector('#casa-partes-header').appendChild(
        mesNavBar(mesFiltro,
          () => costes(el, _state, loadTab, null, casaDetalle, prevMes(mesFiltro)),
          () => costes(el, _state, loadTab, null, casaDetalle, nextMes(mesFiltro))
        )
      );
      return;
    }

    // \u2500\u2500 Vista principal de costes \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
    const [d, resumen] = await Promise.all([
      api.dashboard(),
      api.resumenMensual().catch(() => ({ empleadas: [] })),
    ]);
    const c = d.costes || {};

    // Por casa: mini-grid 3 columnas (Semana / Mes / A\u00f1o)
    const bloquePorCasa = Object.entries(c.porCasa || {}).map(([casa, datos]) => {
      const color = pisoColor[casa] || 'var(--primary)';
      const semana = datos?.semanaEur ?? '\u2014';
      const mes = datos?.mesEur ?? datos ?? '\u2014';
      const anyo = datos?.anyoEur ?? '\u2014';
      return `
      <div class="data-row casa-row" data-casa="${casa}" style="border-left:3px solid ${color};flex-direction:column;gap:8px;align-items:stretch;cursor:pointer;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <h4 style="font-size:.85rem;font-weight:700;">${casa}</h4>
          <span style="font-size:.9rem;color:var(--text-muted);">›</span>
        </div>
        <div class="coste-casa-grid">
          <div class="coste-casa-col"><div class="coste-casa-lbl">Semana</div><div class="coste-casa-val">${semana}\u20ac</div></div>
          <div class="coste-casa-col"><div class="coste-casa-lbl">Mes</div><div class="coste-casa-val">${mes}\u20ac</div></div>
          <div class="coste-casa-col"><div class="coste-casa-lbl">A\u00f1o</div><div class="coste-casa-val">${anyo}\u20ac</div></div>
        </div>
      </div>`;
    }).join('');

    // Por persona: coste + horas, clicable
    const empleadasFiltradas = (resumen.empleadas || [])
      .filter(e => e.nombre && parseFloat(e.coste || 0) > 0)
      .sort((a, b) => parseFloat(b.coste) - parseFloat(a.coste));

    const bloquePorPersona = empleadasFiltradas.map(e => `
    <div class="data-row persona-row" data-nombre="${e.nombre}" style="cursor:pointer;">
      <div class="data-row-main"><h4>${e.nombre}</h4></div>
      <div style="text-align:right;font-size:.82rem;">
        <div><strong>${e.coste}\u20ac</strong></div>
        <div style="color:var(--text-muted)">${e.horas}h este mes</div>
      </div>
      <span style="font-size:.9rem;color:var(--text-muted);margin-left:4px;">\u203a</span>
    </div>`).join('');

    el.innerHTML = `
    <div class="section-header"><h2>\ud83d\udcb0 Costes limpieza</h2></div>
    <div class="stat-grid" style="grid-template-columns:repeat(2,1fr);margin-bottom:16px;">
      <div class="stat-card"><div class="num" style="font-size:1.3rem;">${c.semanaEur ?? '\u2014'}\u20ac</div><div class="lbl">\ud83d\udcc5 Esta semana</div></div>
      <div class="stat-card"><div class="num" style="font-size:1.3rem;">${c.mesEur ?? '\u2014'}\u20ac</div><div class="lbl">\ud83d\uddd3 Este mes</div></div>
      <div class="stat-card"><div class="num" style="font-size:1.3rem;">${c.anyoEur ?? '\u2014'}\u20ac</div><div class="lbl">\ud83d\udcc6 Este a\u00f1o</div></div>
      <div class="stat-card"><div class="num" style="font-size:1.3rem;">${c.totalHorasMes ?? '\u2014'}h</div><div class="lbl">\u23f1 Horas mes</div></div>
    </div>

    ${bloquePorCasa ? `
    <div class="section-header" style="margin-bottom:8px;"><h2>Por casa</h2></div>
    <div class="data-list" style="margin-bottom:16px;">${bloquePorCasa}</div>` : ''}

    ${bloquePorPersona ? `
    <div class="section-header" style="margin-bottom:8px;"><h2>Por persona</h2></div>
    <p style="font-size:.7rem;color:var(--text-muted);margin-bottom:6px;">${mesLabel} \u00b7 toca para ver detalle</p>
    <div class="data-list">${bloquePorPersona}</div>` : ''}
  `;

    el.querySelectorAll('.persona-row').forEach(row => {
      row.addEventListener('click', () => costes(el, _state, loadTab, row.dataset.nombre));
    });
    el.querySelectorAll('.casa-row').forEach(row => {
      row.addEventListener('click', () => costes(el, _state, loadTab, null, row.dataset.casa));
    });
  }


  async function qr(el) {
    const casas = ['MIRADOR', 'CASON', 'GRATAL'];
    el.innerHTML = `
    <div class="section-header"><h2>QR Codes — Deep Links</h2></div>
    <p class="text-muted" style="margin-bottom:20px;font-size:.85rem;">
      Imprime y coloca cada código en el alojamiento correspondiente.
      Al escanearlo se abre directamente el formulario de parte.
    </p>
    ${casas.map(casa => `
      <div class="card" style="text-align:center;margin-bottom:16px;">
        <div class="card-title">${CASA_ICON[casa]} ${casa}</div>
        <img src="/api/qr/${casa}" alt="QR ${casa}" style="width:180px;height:180px;margin:12px auto;display:block;border-radius:8px;background:white;padding:8px;"/>
        <p style="font-size:.75rem;color:var(--text-muted);margin-top:8px;">/new?house=${casa}</p>
        <a href="/api/qr/${casa}" download="QR_${casa}.svg" class="btn btn-secondary btn-sm mt-12" style="width:auto;display:inline-flex;">⬇️ Descargar SVG</a>
      </div>
    `).join('')}
    <div class="card" style="border-color:rgba(59,130,246,.3);">
      <div class="card-title">ℹ️ Cómo imprimir</div>
      <p style="font-size:.8rem;color:var(--text-muted);line-height:1.6;">
        Descarga el SVG, abre en cualquier visor y ajusta tamaño (recomendado ≥ 8cm × 8cm). Plastifica y coloca en lugar visible del alojamiento.
      </p>
    </div>
  `;
  }

  // ─── Tareas periódicas ────────────────────────────────────────────────────────
  async function tareas(el) {
    let mostrarInactivas = false;

    const reloadTareas = async () => {
      el.innerHTML = '<div style="display:flex;justify-content:center;padding:40px;"><div class="loading-spinner"></div></div>';
      try {
        const data = await api.adminTareasPeriodicas();
        renderTareasList(data);
      } catch (err) {
        el.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p style="color:var(--danger)">${err.message}</p><button class="btn btn-sm btn-secondary" style="margin-top:12px;width:auto;" onclick="location.reload()">Recargar panel</button></div>`;
      }
    };

    const renderTareasList = (data) => {
      const filtradas = mostrarInactivas ? data : data.filter(t => t.activa === 'Sí');

      const countActivas = data.filter(t => t.activa === 'Sí').length;
      const countInactivas = data.length - countActivas;

      el.innerHTML = `
      <div class="section-header" style="display:flex; justify-content:space-between; align-items:flex-end;">
        <div>
          <h2>🗓️ Tareas periódicas</h2>
          <span style="font-size:.75rem;color:var(--text-muted);">${countActivas} activas ${countInactivas > 0 ? `· ${countInactivas} inactivas` : ''}</span>
        </div>
        <button class="btn btn-sm btn-success" id="btn-nueva-tarea" style="width:auto;padding:6px 14px;">+ Nueva</button>
      </div>
      
      ${countInactivas > 0 ? `
      <div style="margin-bottom: 16px; display: flex; justify-content: flex-end;">
        <label style="display:flex; align-items:center; gap:6px; font-size:.8rem; color:var(--text-muted); cursor:pointer;">
          <input type="checkbox" id="toggle-inactivas" ${mostrarInactivas ? 'checked' : ''} style="width:16px; height:16px;">
          Mostrar inactivas
        </label>
      </div>` : ''}

      ${!filtradas.length ? '<div class="empty-state"><div class="icon">✅</div><p>Sin tareas configuradas</p></div>' : `
      <div class="data-list" id="tareas-list">
        ${filtradas.sort((a, b) => {
        const val = { vencida: 0, proxima: 1, ok: 2 };
        return (val[a.estado] ?? 3) - (val[b.estado] ?? 3);
      }).map(t => {
        const isActiva = t.activa === 'Sí';
        let borderColor = 'var(--text-muted)';
        let badgeHtml = '';

        if (isActiva) {
          if (t.estado === 'vencida') {
            borderColor = 'var(--danger)';
            badgeHtml = '<span class="badge badge-error">Vencida</span>';
          } else if (t.estado === 'proxima') {
            borderColor = 'var(--warning)';
            badgeHtml = '<span class="badge badge-pending">Próxima</span>';
          } else {
            borderColor = 'var(--success)';
            badgeHtml = '<span class="badge badge-ok">Al día</span>';
          }
        } else {
          badgeHtml = '<span class="badge" style="background:rgba(255,255,255,.1);color:var(--text-muted)">Inactiva</span>';
        }

        const ult = t.ultima_realizacion_ts ? t.ultima_realizacion_ts.slice(0, 10) : '—';
        const prox = t.proxima_realizacion_ts ? t.proxima_realizacion_ts.slice(0, 10) : '—';

        return `
            <div class="data-row" style="border-left:3px solid ${borderColor}; flex-direction:column; gap:10px; opacity: ${isActiva ? '1' : '0.6'}">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; width:100%;">
                <div class="data-row-main" style="margin:0;">
                  <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                     <h4 style="margin:0;font-size:.9rem;">${t.casa} · ${t.zona}</h4>
                     ${badgeHtml}
                  </div>
                  <p style="font-weight:600; font-size:.95rem; color:var(--text); margin-bottom:6px;">${t.nombre}</p>
                  <div style="display:flex; gap:12px; font-size:.75rem; color:var(--text-muted); flex-wrap:wrap;">
                    <span>⏳ Freq: ${t.frecuencia_valor && t.frecuencia_unidad ? `${t.frecuencia_valor} ${t.frecuencia_unidad}` : `${t.periodicidad_meses} meses`}</span>
                    <span>🔄 Última: ${ult}</span>
                    <span>⏭️ PRÓX: ${prox}</span>
                  </div>
                </div>
              </div>
              <div style="display:flex; gap:6px; flex-wrap:wrap; width:100%;">
                  ${isActiva ? `<button class="btn btn-sm btn-success" data-action="hecha" data-id="${t.id}" style="flex:1; padding:6px 0; font-size:.8rem;">✅ Hecha hoy</button>` : ''}
                  <button class="btn btn-sm btn-secondary" data-action="editar" data-id="${t.id}" style="width:auto; padding:6px 12px; font-size:.8rem;">✏️ Editar</button>
                  <button class="btn btn-sm btn-secondary" data-action="historial" data-id="${t.id}" data-casa="${t.casa}" data-nombre="${t.nombre.replace(/"/g, '&quot;')}" style="width:auto; padding:6px 12px; font-size:.8rem;">🕒 Historial</button>
              </div>
            </div>
          `;
      }).join('')}
      </div>`}
    `;

      // Listeners
      const toggle = el.querySelector('#toggle-inactivas');
      if (toggle) {
        toggle.addEventListener('change', (e) => {
          mostrarInactivas = e.target.checked;
          renderTareasList(data);
        });
      }

      el.querySelector('#btn-nueva-tarea')?.addEventListener('click', () => {
        mostrarModalTarea(null, reloadTareas);
      });

      el.querySelector('#tareas-list')?.addEventListener('click', async (e) => {
        const btn = e.target.closest('button[data-action]');
        if (!btn) return;
        const { action, id, casa, nombre } = btn.dataset;
        const tarea = data.find(t => t.id === id);

        if (action === 'editar') {
          mostrarModalTarea(tarea, reloadTareas);
        } else if (action === 'hecha') {
          if (confirm(`¿Marcar "${tarea.nombre}" como hecha hoy?`)) {
            btn.disabled = true;
            btn.textContent = 'Guardando...';
            try {
              await api.adminMarcarHecha(id);
              toast('Tarea marcada al día ✅', 'success');
              await reloadTareas();
            } catch (err) {
              toast(err.message, 'error');
              btn.disabled = false;
              btn.textContent = '✅ Hecha hoy';
            }
          }
        } else if (action === 'historial') {
          mostrarHistorialTarea(id, casa, nombre);
        }
      });
    };

    await reloadTareas();
  }

  function mostrarModalTarea(tarea = null, reloadCb) {
    const isEdit = !!tarea;
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:9999;display:flex;justify-content:center;align-items:flex-end;backdrop-filter:blur(4px);';

    const casas = ['MIRADOR', 'CASON', 'GRATAL'];
    const ZONAS_POR_CASA = {
      'MIRADOR': ['Salón/Comedor', 'Cocina', 'Baño 1', 'Baño 2', 'Habitación 1', 'Habitación 2', 'Exterior/Terraza'],
      'CASON': ['Salón/Comedor', 'Cocina', 'Baño P.Baja', 'Baño P.Alta', 'Habitación 1', 'Habitación 2', 'Habitación 3', 'Exterior/Jardín'],
      'GRATAL': ['Salón/Cocina', 'Baño', 'Habitación', 'Exterior/Terraza']
    };

    modal.innerHTML = `
      <div style="background:var(--surface);width:100%;max-width:500px;border-radius:24px 24px 0 0;padding:24px;box-sizing:border-box;animation:slideUp .3s ease-out;max-height:90vh;overflow-y:auto; overflow-x:hidden;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
          <h2 style="margin:0;font-size:1.1rem;">${isEdit ? '✏️ Editar Tarea' : '✨ Nueva Tarea'}</h2>
          <button id="btn-cerrar-modal-tarea" style="background:none;border:none;font-size:1.5rem;color:var(--text);cursor:pointer;line-height:1;">&times;</button>
        </div>
        
        <form id="form-tarea" style="display:flex;flex-direction:column;gap:16px;">
          <div>
            <label style="display:block;font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:6px;letter-spacing:0.3px;">Casa</label>
            <select id="t-casa" required style="width:100%;font-size:1rem;padding:12px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.25);color:var(--text);box-sizing:border-box; -webkit-appearance:none;outline:none;">
              <option value="" disabled ${!isEdit ? 'selected' : ''}>Selecciona una casa...</option>
              ${casas.map(c => `<option value="${c}" ${isEdit && tarea.casa === c ? 'selected' : ''}>${c}</option>`).join('')}
            </select>
          </div>
          
          <div>
            <label style="display:block;font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:6px;letter-spacing:0.3px;">Zona</label>
            <select id="t-zona-select" required style="width:100%;font-size:1rem;padding:12px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.25);color:var(--text);box-sizing:border-box; -webkit-appearance:none;outline:none;margin-bottom:8px;">
               <option value="" disabled selected>Selecciona una casa primero...</option>
            </select>
            <input type="text" id="t-zona-otra" placeholder="Escribe la zona..." style="display:none;width:100%;font-size:1rem;padding:12px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.25);color:var(--text);box-sizing:border-box;outline:none;">
          </div>
          
          <div>
            <label style="display:block;font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:6px;letter-spacing:0.3px;">Nombre de la tarea</label>
            <input type="text" id="t-nombre" placeholder="Ej: Limpiar filtros" required value="${isEdit ? (tarea.nombre || '') : ''}" style="width:100%;font-size:1rem;padding:12px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.25);color:var(--text);box-sizing:border-box;outline:none;">
          </div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
              <div>
                <label style="display:block;font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:6px;letter-spacing:0.3px;">Frecuencia</label>
                <div style="display:flex;gap:8px;">
                  <input type="number" id="t-frec-valor" min="1" required value="${isEdit ? (tarea.frecuencia_valor || tarea.periodicidad_meses || 1) : 1}" style="flex:1;width:100%;font-size:1rem;padding:12px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.25);color:var(--text);box-sizing:border-box;outline:none;">
                  <select id="t-frec-unidad" required style="flex:2;width:100%;font-size:1rem;padding:12px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.25);color:var(--text);box-sizing:border-box; -webkit-appearance:none;outline:none;">
                    <option value="semanas" ${isEdit && tarea.frecuencia_unidad === 'semanas' ? 'selected' : ''}>Semanas</option>
                    <option value="meses" ${!isEdit || tarea.frecuencia_unidad === 'meses' || !tarea.frecuencia_unidad ? 'selected' : ''}>Meses</option>
                  </select>
                </div>
              </div>
              ${isEdit ? `
              <div>
                <label style="display:block;font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:6px;letter-spacing:0.3px;">¿Activa?</label>
                <select id="t-activa" style="width:100%;font-size:1rem;padding:12px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.25);color:var(--text);box-sizing:border-box; -webkit-appearance:none;outline:none;">
                    <option value="Sí" ${tarea.activa === 'Sí' ? 'selected' : ''}>Sí, Activa</option>
                    <option value="No" ${tarea.activa !== 'Sí' ? 'selected' : ''}>Inactiva</option>
                </select>
              </div>` : ''}
          </div>

          <div>
            <label style="display:block;font-size:.8rem;font-weight:600;color:var(--text);margin-bottom:6px;letter-spacing:0.3px;">Descripción / Notas</label>
            <textarea id="t-desc" placeholder="Opcional. Detalles adicionales de la tarea..." rows="3" style="width:100%;font-size:.95rem;padding:12px;border-radius:10px;background:rgba(0,0,0,.25);border:1px solid rgba(255,255,255,.25);color:var(--text);resize:none;box-sizing:border-box;outline:none;">${isEdit ? (tarea.descripcion || '') : ''}</textarea>
          </div>

          <button type="submit" id="btn-submit-tarea" class="btn" style="width:100%;margin-top:8px;border-radius:10px;font-size:1.05rem;padding:14px;font-weight:600;">${isEdit ? 'Guardar Cambios' : 'Crear Tarea'}</button>
        </form>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#btn-cerrar-modal-tarea').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    const selectCasa = modal.querySelector('#t-casa');
    const selectZona = modal.querySelector('#t-zona-select');
    const inputZonaOtra = modal.querySelector('#t-zona-otra');

    const updateZonas = () => {
      const casa = selectCasa.value;
      const zonas = ZONAS_POR_CASA[casa] || [];
      selectZona.innerHTML = '<option value="" disabled selected>Selecciona una zona...</option>' +
        zonas.map(z => `<option value="${z}">${z}</option>`).join('') +
        '<option value="otra">Otra zona...</option>';

      if (isEdit && tarea.casa === casa) {
        if (zonas.includes(tarea.zona)) {
          selectZona.value = tarea.zona;
          inputZonaOtra.style.display = 'none';
        } else if (tarea.zona) {
          selectZona.value = 'otra';
          inputZonaOtra.value = tarea.zona;
          inputZonaOtra.style.display = 'block';
        }
      } else {
        selectZona.value = '';
        inputZonaOtra.style.display = 'none';
      }
    };

    selectCasa.addEventListener('change', updateZonas);
    selectZona.addEventListener('change', () => {
      inputZonaOtra.style.display = selectZona.value === 'otra' ? 'block' : 'none';
      if (selectZona.value !== 'otra') inputZonaOtra.value = '';
      if (selectZona.value === 'otra') inputZonaOtra.focus();
    });

    if (isEdit && tarea.casa) updateZonas();

    modal.querySelector('#form-tarea').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = modal.querySelector('#btn-submit-tarea');

      let finalZona = selectZona.value === 'otra' ? inputZonaOtra.value.trim() : selectZona.value;
      if (!finalZona) {
        alert("Por favor, selecciona o escribe una zona.");
        return;
      }

      const data = {
        casa: selectCasa.value,
        zona: finalZona,
        nombre: modal.querySelector('#t-nombre').value.trim(),
        frecuencia_valor: parseInt(modal.querySelector('#t-frec-valor').value),
        frecuencia_unidad: modal.querySelector('#t-frec-unidad').value,
        descripcion: modal.querySelector('#t-desc').value.trim(),
      };

      if (isEdit) {
        data.activa = modal.querySelector('#t-activa').value;
      }

      btn.disabled = true;
      btn.textContent = 'Guardando...';

      try {
        if (isEdit) {
          await api.adminEditarTarea(tarea.id, data);
        } else {
          await api.adminCrearTarea(data);
        }
        toast(`Tarea ${isEdit ? 'actualizada' : 'creada'} ✅`, 'success');
        closeModal();
        reloadCb();
      } catch (err) {
        toast(err.message, 'error');
        btn.disabled = false;
        btn.textContent = isEdit ? 'Guardar Cambios' : 'Crear Tarea';
      }
    });
  }

  function mostrarHistorialTarea(taskId, casa, nombre) {
    const modal = document.createElement('div');
    modal.style.cssText = 'position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,.7);z-index:9999;display:flex;justify-content:center;align-items:flex-end;backdrop-filter:blur(4px);';

    modal.innerHTML = `
      <div style="background:var(--surface);width:100%;max-width:500px;border-radius:24px 24px 0 0;padding:24px;box-sizing:border-box;animation:slideUp .3s ease-out;max-height:85vh;display:flex;flex-direction:column;">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
          <div style="padding-right:12px;">
             <h2 style="margin:0;font-size:1.05rem;color:var(--text);line-height:1.2;">${nombre}</h2>
             <p style="font-size:.75rem;color:var(--text-muted);margin:4px 0 0;">Historial de ejecuciones</p>
          </div>
          <button id="btn-cerrar-historial" style="background:none;border:none;font-size:1.5rem;color:var(--text);cursor:pointer;padding:0;line-height:1;">&times;</button>
        </div>
        <div id="historial-content" style="flex:1;overflow-y:auto;min-height:200px;">
           <div style="display:flex;justify-content:center;padding:40px;"><div class="loading-spinner"></div></div>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const closeModal = () => modal.remove();
    modal.querySelector('#btn-cerrar-historial').addEventListener('click', closeModal);
    modal.addEventListener('click', e => { if (e.target === modal) closeModal(); });

    const content = modal.querySelector('#historial-content');

    // Fetch and render inside the modal
    api.adminTareasLog(casa)
      .then(logs => {
        // Filtrar localmente por task_id
        const taskLogs = logs.filter(l => l.task_id === taskId);

        if (!taskLogs.length) {
          content.innerHTML = '<div class="empty-state" style="padding:40px 0;"><div class="icon" style="font-size:2rem;margin-bottom:12px;">📝</div><p style="font-size:.85rem;color:var(--text-muted);">No hay registro de ejecuciones para esta tarea.</p></div>';
          return;
        }

        content.innerHTML = `
                <div class="data-list" style="margin-top:10px;">
                    ${taskLogs.map(l => {
          const dateObj = l.created_ts ? new Date(l.created_ts) : new Date(l.fecha);
          const dateStr = !isNaN(dateObj) ? formatDateMadrid(dateObj) : l.fecha;
          const user = l.usuario_nombre || l.user_id || 'Sistema';
          const isManual = l.parte_id === 'ADMIN-MANUAL';

          return `
                        <div class="data-row" style="padding:12px 14px;border-left:3px solid ${isManual ? 'var(--primary)' : 'var(--success)'};margin-bottom:8px;background:rgba(255,255,255,.02);border-radius:0 8px 8px 0;">
                            <div class="data-row-main">
                                <h4 style="font-size:.85rem;margin-bottom:4px;display:flex;align-items:center;justify-content:space-between;gap:6px;">
                                    <span>🗓️ ${dateStr}</span>
                                    ${isManual ? '<span class="badge" style="background:rgba(59,130,246,.2);color:#93c5fd;font-size:0.6rem;padding:2px 6px;">Admin</span>' : '<span class="badge" style="background:rgba(255,255,255,.1);color:var(--text-muted);font-size:0.6rem;padding:2px 6px;">Limpieza</span>'}
                                </h4>
                                <p style="font-size:.75rem;color:var(--text-muted);margin:0;">Ejecutada por: <strong style="color:var(--text);font-weight:600;">${user}</strong></p>
                                ${l.observaciones ? `<p style="font-size:.75rem;margin:6px 0 0 0;color:rgba(255,255,255,.8);background:rgba(0,0,0,.2);padding:6px 8px;border-radius:6px;border-left:2px solid var(--text-muted);">"${l.observaciones}"</p>` : ''}
                            </div>
                        </div>`;
        }).join('')}
                </div>
            `;
      })
      .catch(err => {
        content.innerHTML = `<div class="empty-state"><div class="icon">❌</div><p style="color:var(--danger);font-size:.85rem;">${err.message}</p></div>`;
      });
  }


  // ─── Temporada ─────────────────────────────────────────────────────────────
  async function temporada(el) {
    try {
      const pCfg = await api.config();
      const currentTemp = pCfg.temporada || 'entretiempo';
      const opts = ['invierno', 'entretiempo', 'verano'];

      el.innerHTML = `
      <style>
        .temp-grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 12px;
          margin-bottom: 32px;
        }
        .btn-temporada {
          background: rgba(255,255,255,0.05);
          color: var(--text);
          border: 1px solid var(--border);
          padding: 20px 16px;
          border-radius: 12px;
          font-size: 1.2rem;
          text-transform: capitalize;
          cursor: pointer;
          transition: all 0.2s;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          outline: none;
        }
        .btn-temporada:hover:not(.active) {
          background: rgba(255,255,255,0.08);
          border-color: var(--primary);
        }
        .btn-temporada.active {
          background: var(--primary);
          color: #fff;
          border-color: var(--primary);
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.3);
        }
        .btn-temporada .temp-icon { font-size: 1.5rem; }
        .btn-temporada .temp-label { 
          font-size: 0.9rem; 
          display: block; 
          margin-top: 8px; 
          font-weight: 600; 
        }

        @media (max-width: 500px) {
          .temp-grid {
            grid-template-columns: 1fr;
            gap: 10px;
          }
          .btn-temporada {
            flex-direction: row;
            justify-content: flex-start;
            gap: 16px;
            padding: 14px 20px;
          }
          .btn-temporada .temp-label {
            margin-top: 0;
            font-size: 1.05rem;
          }
          .btn-temporada .temp-icon {
            font-size: 1.3rem;
          }
        }
      </style>

      <div class="section-header"><h2>Configuración de Temporada</h2></div>
      
      <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:12px;padding:24px;max-width:600px;margin:0 auto;text-align:center;">
        <p style="color:var(--text-muted);font-size:0.95rem;margin-bottom:24px;line-height:1.5;text-align:left;">
          Selecciona la temporada activa del año. Esto ajustará automáticamente la visibilidad de tareas estacionales y checklists específicos.
        </p>

        <div class="temp-grid">
          ${opts.map(opt => `
            <button class="btn-temporada ${currentTemp === opt ? 'active' : ''}" data-val="${opt}">
              <span class="temp-icon">${opt === 'invierno' ? '❄️' : opt === 'verano' ? '☀️' : '🌤️'}</span>
              <span class="temp-label">${opt}</span>
            </button>
          `).join('')}
        </div>

        <button id="btn-save-temp" class="btn btn-primary" style="width:100%;max-width:300px;font-size:1.1rem;margin:0 auto;" disabled>Guardar Cambios</button>
      </div>
    `;

      let selectedTemp = currentTemp;

      el.querySelectorAll('.btn-temporada').forEach(btn => {
        btn.addEventListener('click', () => {
          el.querySelectorAll('.btn-temporada').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');

          selectedTemp = btn.dataset.val;
          el.querySelector('#btn-save-temp').disabled = (selectedTemp === currentTemp);
        });
      });

      el.querySelector('#btn-save-temp').addEventListener('click', async (e) => {
        e.target.disabled = true;
        e.target.textContent = 'Guardando...';
        try {
          await api.adminSetTemporada(selectedTemp);
          toast('Temporada actualizada con éxito', 'success');
          temporada(el); // recargar
        } catch (err) {
          toast('Error al guardar temporada: ' + err.message, 'error');
          e.target.disabled = false;
          e.target.textContent = 'Guardar Cambios';
        }
      });

    } catch (err) {
      el.innerHTML = `<div class="empty-state"><div class="icon">⚠️</div><p>Error cargando config: ${err.message}</p></div>`;
    }
  }

  // ─── Drilldown de Casa (Modal V1) ──────────────────────────────────────────
  function renderFichaCasa(casa, d, abiertosData) {
    const incCasa = (d.incidenciasAbiertas || []).filter(inc => inc.casa === casa);
    const consCasa = (d.consumiblesPendientes || []).filter(c => c.casa === casa);
    const todosLosPartes = (d.ultimosPartesPorCasa && d.ultimosPartesPorCasa[casa]) ? d.ultimosPartesPorCasa[casa] : [];
    const ultimos = todosLosPartes.slice(0, 5); // Para operativa mantengo 5
    const sinCerrarList = abiertosData.filter(a => a.casa === casa);
    const ultimaSalida = (d.ultimaSalidaPorCasa && d.ultimaSalidaPorCasa[casa]) ? d.ultimaSalidaPorCasa[casa] : null;

    let partesDesdeSalida = [];
    if (ultimaSalida) {
      partesDesdeSalida = todosLosPartes.filter(p => {
        let tsCompara = p.inicio_ts || p.fin_ts || p.fecha || '';
        if (tsCompara.length === 10) tsCompara += 'T23:59:59'; // Si es solo fecha, asume el final del día
        return tsCompara >= ultimaSalida;
      });
    } else {
      partesDesdeSalida = todosLosPartes; // Sin ancla de salida, usamos el total de recientes para el resumen
    }

    partesDesdeSalida.sort((a, b) => {
      const tsA = a.inicio_ts || a.fin_ts || a.fecha || '';
      const tsB = b.inicio_ts || b.fin_ts || b.fecha || '';
      return tsB.localeCompare(tsA);
    });

    const normalizaTelefonoParaTel = (telf) => telf ? telf.replace(/[\s\-\.\(\)]/g, '') : '';
    const normalizarHora = (h, fallback) => {
      if (!h || typeof h !== 'string' || !h.trim()) return fallback;
      const limpia = h.trim().substring(0, 5);
      return /^\d{2}:\d{2}$/.test(limpia) ? limpia : fallback;
    };

    const hoy = d.fecha;
    const hoyStr = hoy;

    const d30 = new Date(hoy + 'T00:00:00Z');
    d30.setUTCDate(d30.getUTCDate() + 30);
    const limite30Dias = d30.toISOString().slice(0, 10);

    const reservasCasa = (d.reservasCalendario || [])
      .filter(r => r.casa === casa && r.fecha_salida >= hoy && r.fecha_entrada <= limite30Dias);
    reservasCasa.sort((a, b) => a.fecha_entrada.localeCompare(b.fecha_entrada));


    const modalHtml = `
    <div class="modal overlay-modal" id="modal-ficha-casa">
      <div class="modal-content" style="max-width:600px; max-height:90vh; display:flex; flex-direction:column; padding:0;">
        <div style="padding:20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center; position:sticky; top:0; background:var(--bg-card); z-index:10; border-radius:12px 12px 0 0;">
          <h2 style="margin:0; font-size:1.4rem;">🏠 ${casa}</h2>
          <button class="btn-close-modal" style="background:none; border:none; font-size:1.5rem; color:var(--text-muted); cursor:pointer;">&times;</button>
        </div>
        
        <div style="display:flex; border-bottom:1px solid var(--border); padding:0 20px; overflow-x:auto;">
          <button class="ficha-tab active" data-fichatab="resumen" style="background:none; border:none; padding:12px 16px; color:var(--text); font-weight:600; cursor:pointer; border-bottom:3px solid var(--primary);">Resumen</button>
          <button class="ficha-tab" data-fichatab="reservas" style="background:none; border:none; padding:12px 16px; color:var(--text-muted); cursor:pointer; border-bottom:3px solid transparent;">Reservas</button>
          <button class="ficha-tab" data-fichatab="operativa" style="background:none; border:none; padding:12px 16px; color:var(--text-muted); cursor:pointer; border-bottom:3px solid transparent;">Operativa</button>
        </div>

        <div style="padding:20px; overflow-y:auto; flex:1;" id="ficha-content">
          ${renderFichaResumen()}
        </div>
      </div>
    </div>
  `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    const modal = document.getElementById('modal-ficha-casa');

    modal.querySelector('.btn-close-modal').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });

    modal.querySelectorAll('.ficha-tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        modal.querySelectorAll('.ficha-tab').forEach(t => {
          t.classList.remove('active');
          t.style.color = 'var(--text-muted)';
          t.style.borderBottomColor = 'transparent';
          t.style.fontWeight = 'normal';
        });
        const t = e.target;
        t.classList.add('active');
        t.style.color = 'var(--text)';
        t.style.borderBottomColor = 'var(--primary)';
        t.style.fontWeight = '600';

        const content = modal.querySelector('#ficha-content');
        const targetTab = t.dataset.fichatab;
        if (targetTab === 'resumen') content.innerHTML = renderFichaResumen();
        else if (targetTab === 'reservas') content.innerHTML = renderFichaReservas();
        else if (targetTab === 'operativa') content.innerHTML = renderFichaOperativa();
      });
    });

    function renderFichaResumen() {
      // Referencia Madrid coherente (YYYY-MM-DDTHH:MM)
      const formatter = new Intl.DateTimeFormat('sv-SE', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false
      });
      const ahoraMadridStr = formatter.format(new Date()).replace(' ', 'T');

      let reservaActual = null;
      let proximaReserva = null;

      for (const r of reservasCasa) {
        if (!isReservaActiva(r)) continue; // Saltar canceladas/anuladas
        if (reservaActual && proximaReserva) break;

        let inTime = normalizarHora(r.hora_entrada, '16:00');
        let outTime = normalizarHora(r.hora_salida, '11:00');

        const resInStr = `${r.fecha_entrada}T${inTime}:00`;
        const resOutStr = `${r.fecha_salida}T${outTime}:00`;

        if (ahoraMadridStr >= resInStr && ahoraMadridStr < resOutStr && !reservaActual) {
          reservaActual = r;
        } else if (ahoraMadridStr < resInStr && !proximaReserva) {
          proximaReserva = r;
        }
      }

      let reservasHtml = '';

      function genBloque(titulo, resObj, isActual) {
        const isHover = resObj.fecha_entrada === hoy || resObj.fecha_salida === hoy;
        let lblIn = resObj.fecha_entrada === hoy ? 'Entrada HOY' : `Entrada: ${formatDia(resObj.fecha_entrada)}`;
        let lblOut = resObj.fecha_salida === hoy ? 'Salida HOY' : `Salida: ${formatDia(resObj.fecha_salida)}`;

        const huespedes = resObj.huespedes || '?';
        const nombreViajero = resObj.viajero_nombre || 'Viajero no especificado';

        let telfHtml = '';
        if (resObj.telefono) {
          telfHtml = `<br><span style="font-size:0.9rem; color:var(--primary);">📞 <a href="tel:${normalizaTelefonoParaTel(resObj.telefono)}" style="color:var(--primary);text-decoration:none;font-weight:600;">${resObj.telefono}</a></span>`;
        }

        return `
        <div style="margin-bottom: 16px;">
          <h3 style="margin:0 0 10px 0; font-size:1rem; color:${isActual ? 'var(--primary)' : 'var(--text-muted)'}; text-transform:uppercase;">${titulo}</h3>
          <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
            <strong style="${isHover ? 'color:var(--primary);' : ''}">${lblIn}</strong><br>
            <span style="font-size:0.9rem; color:var(--text-muted);">${lblOut} · ${huespedes} pax</span><br>
            <span style="font-size:0.9rem; color:var(--text);">${nombreViajero}</span>${telfHtml}
            ${resObj.observaciones || resObj.observaciones_operativas ? `<div style="margin-top:8px;font-size:0.85rem;color:var(--warning);background:rgba(255,193,7,0.1);padding:6px;border-radius:4px;">📝 ${resObj.observaciones || resObj.observaciones_operativas}</div>` : ''}
          </div>
        </div>
      `;
      }

      if (reservaActual) reservasHtml += genBloque('▶️ Reserva Actual', reservaActual, true);
      if (proximaReserva) reservasHtml += genBloque(reservaActual ? '⏳ Próxima Reserva' : 'Próxima Reserva', proximaReserva, false);

      if (!reservasHtml) {
        reservasHtml = `
        <div style="margin-bottom: 16px;">
          <h3 style="margin:0 0 10px 0; font-size:1.1rem; color:var(--text-muted); text-transform:uppercase;">Próxima Reserva</h3>
          <p style="color:var(--text-muted);">No hay reservas inminentes.</p>
        </div>
      `;
      }

      let utHtml = '';
      if (partesDesdeSalida.length === 0) {
        if (ultimaSalida) {
          utHtml = `<p style="color:var(--urgent); font-weight:600;">⚠️ No hay ningún parte desde la última salida (${formatDia(ultimaSalida)}). Casa pendiente de preparación.</p>`;
        } else {
          utHtml = '<p style="color:var(--text-muted);">No hay partes recientes.</p>';
        }
      } else {
        const numPartes = partesDesdeSalida.length;
        const numPersonas = new Set(partesDesdeSalida.map(p => p.usuario_nombre)).size;
        let duracionAcumuladaMin = 0;
        let costeTotal = 0;

        partesDesdeSalida.forEach(p => {
          // Sumar duración
          if (p.duracion_min) duracionAcumuladaMin += parseInt(p.duracion_min);
          else {
            const dRaw = calcDuracion(p.inicio_ts, p.fin_ts, true);
            if (dRaw) duracionAcumuladaMin += dRaw;
          }
          // Sumar coste
          costeTotal += parseFloat(p.coste_estimado_eur || 0);
        });

        const hs = Math.floor(duracionAcumuladaMin / 60);
        const ms = duracionAcumuladaMin % 60;
        const durStr = duracionAcumuladaMin > 0 ? (ms > 0 ? `${hs}h ${ms}m` : `${hs}h`) : '0m';

        const listHtml = partesDesdeSalida.slice(0, 5).map(p => {
          const dStrObj = calcDuracion(p.inicio_ts, p.fin_ts);
          const stat = getStatusBadge(p.casa_lista);
          return `
           <div style="display:flex; justify-content:space-between; margin-top:8px; font-size:0.9rem; border-left:2px solid ${stat.class === 'badge-ok' ? 'var(--primary)' : (stat.class === 'badge-error' ? 'var(--urgent)' : 'var(--warning)')}; padding-left:8px;">
             <div>
               <strong style="color:var(--text);">${p.usuario_nombre || 'Limpiador'}</strong> · <span style="color:var(--text-muted);">${unificarTipo(p.tipo_limpieza)}</span>
             </div>
             <span style="color:var(--text-muted);">${dStrObj || '?'}</span>
           </div>
         `;
        }).join('');

        utHtml = `
        <div style="background:rgba(255,255,255,0.05); padding:12px; border-radius:8px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px; padding-bottom:10px; border-bottom:1px solid rgba(255,255,255,0.05);">
             <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.4;">
                <strong>${numPartes}</strong> ${numPartes === 1 ? 'parte' : 'partes'}<br>
                <strong>${numPersonas}</strong> ${numPersonas === 1 ? 'persona' : 'personas'} · <strong>${durStr}</strong>
             </div>
             <div style="text-align:right;">
                <div style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase; margin-bottom:2px;">Coste total</div>
                <div style="font-size:1.2rem; font-weight:bold; color:var(--primary);">${costeTotal.toFixed(2).replace('.', ',')} €</div>
             </div>
          </div>
          ${listHtml}
        </div>
      `;
      }

      return `
      <div style="display:flex; flex-direction:column; gap:8px;">
        ${reservasHtml}
        <div>
          <h3 style="margin:0 0 10px 0; font-size:1.1rem; color:var(--text-muted); text-transform:uppercase;">${ultimaSalida ? 'Partes desde última salida' : 'Partes Recientes'}</h3>
          ${utHtml}
        </div>
        <div style="display:grid; grid-template-columns:1fr 1fr 1fr; gap:12px; margin-top:8px;">
          <div style="background:var(--bg-card); border:1px solid var(--border); padding:16px; border-radius:8px; text-align:center;">
             <div style="font-size:1.5rem; font-weight:bold; color:${incCasa.length > 0 ? 'var(--urgent)' : 'var(--text)'};">${incCasa.length}</div>
             <div style="font-size:0.8rem; color:var(--text-muted);">Incidencias</div>
          </div>
          <div style="background:var(--bg-card); border:1px solid var(--border); padding:16px; border-radius:8px; text-align:center;">
             <div style="font-size:1.5rem; font-weight:bold; color:${consCasa.length > 0 ? 'var(--warning)' : 'var(--text)'};">${consCasa.length}</div>
             <div style="font-size:0.8rem; color:var(--text-muted);">Consumibles</div>
          </div>
          <div style="background:var(--bg-card); border:1px solid var(--border); padding:16px; border-radius:8px; text-align:center;">
             <div style="font-size:1.5rem; font-weight:bold; color:${sinCerrarList.length > 0 ? 'var(--warning)' : 'var(--text)'};">${sinCerrarList.length}</div>
             <div style="font-size:0.8rem; color:var(--text-muted);">Sin cerrar</div>
          </div>
        </div>
      </div>
    `;
    }

    function renderFichaReservas() {
      if (!reservasCasa.length) return `<div class="empty-state"><p>No hay reservas para los próximos 30 días.</p></div>`;

      return `
      <div style="display:flex; flex-direction:column; gap:12px;">
        ${reservasCasa.map(r => {
        const lblIn = formatDia(r.fecha_entrada);
        const lblOut = formatDia(r.fecha_salida);

        let telfHtml = '';
        if (r.telefono) {
          telfHtml = ` | 📞 <a href="tel:${normalizaTelefonoParaTel(r.telefono)}" style="color:var(--primary);text-decoration:none;font-weight:600;">${r.telefono}</a>`;
        }

        let emailHtml = '';
        if (r.email) {
          emailHtml = ` | ✉️ <a href="mailto:${r.email}" style="color:var(--text-muted);text-decoration:none;">${r.email}</a>`;
        }

        let badgeStatus = 'badge-ok';
        if (r.estado_reserva && ['cancelada', 'anulada'].includes(r.estado_reserva.toLowerCase())) badgeStatus = 'badge-error';
        if (r.estado_reserva && ['pendiente'].includes(r.estado_reserva.toLowerCase())) badgeStatus = 'badge-warning';

        return `
            <div style="background:var(--bg-card); border:1px solid var(--border); padding:16px; border-radius:8px;">
              <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
                <strong style="font-size:1.1rem; color:var(--text);">${r.viajero_nombre || 'Viajero Dsc.'}</strong>
                <span class="badge ${badgeStatus}">${r.estado_reserva || 'Confirmada'}</span>
              </div>
              
              <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px; margin-bottom:8px; font-size:0.9rem; color:var(--text-muted);">
                <div>📅 ${lblIn} ➡️ ${lblOut}</div>
                <div style="text-align:right;">👥 ${r.huespedes || '?'} pax</div>
              </div>
              
              <div style="font-size:0.85rem; color:var(--text-muted); padding-top:8px; border-top:1px solid var(--border);">
                ${r.canal ? `📢 ${r.canal}` : '📢 Directo'}
                ${telfHtml}
                ${emailHtml}
              </div>
            </div>
          `;
      }).join('')}
      </div>
    `;
    }

    function renderFichaOperativa() {
      let html = '';

      // 1. Incidencias Abiertas
      if (incCasa.length > 0) {
        html += `<h3 style="margin:0 0 12px 0; font-size:1.1rem; color:var(--text-muted); text-transform:uppercase;">Incidencias Abiertas (${incCasa.length})</h3>`;
        html += `<div class="data-list" style="margin-bottom:24px;">`;
        html += incCasa.map(inc => `
        <div class="data-row">
          <div class="data-row-main">
            <h4>${inc.prioridad === 'Urgente' ? '🚨 ' : ''}${inc.descripcion || 'Sin descripción'}</h4>
            <p>${(inc.fecha_creacion || '').slice(0, 10)} · Por: ${inc.responsable || 'Desconocido'}</p>
          </div>
          <span class="badge ${inc.prioridad === 'Urgente' ? 'badge-error' : 'badge-warning'}">${inc.estado || 'Abierta'}</span>
        </div>
      `).join('');
        html += `</div>`;
      } else {
        html += `<p style="color:var(--text-muted); margin-bottom:24px;">✅ No hay incidencias abiertas.</p>`;
      }

      // 2. Consumibles Pendientes
      if (consCasa.length > 0) {
        html += `<h3 style="margin:0 0 12px 0; font-size:1.1rem; color:var(--text-muted); text-transform:uppercase;">Consumibles Faltantes (${consCasa.length})</h3>`;
        html += `<div class="data-list" style="margin-bottom:24px;">`;
        html += consCasa.map(c => `
        <div class="data-row" style="flex-direction:column; align-items:flex-start; gap:4px; padding:12px;">
          <div style="display:flex; justify-content:space-between; width:100%; align-items:center;">
            <h4 style="margin:0;">${c.item === 'otro' ? (c.item_otro || 'Otro') : (c.item || 'S/D')}</h4>
            <span class="badge ${c.urgencia === 'Urgente' ? 'badge-error' : 'badge-pending'}" style="font-size:0.7rem;">${c.urgencia || 'Normal'}</span>
          </div>
          <p style="margin:0; font-size:0.85rem; color:var(--text-muted);">${c.fecha || ''} · Por: ${c.marcado_por || '?'}</p>
          ${c.nota ? `<div style="margin-top:4px; color:var(--warning); font-size:0.8rem; font-style:italic;">"${c.nota}"</div>` : ''}
        </div>
      `).join('');
        html += `</div>`;
      } else {
        html += `<p style="color:var(--text-muted); margin-bottom:24px;">✅ No hay consumibles pendientes.</p>`;
      }

      // 3. Últimos 5 partes
      if (ultimos.length > 0) {
        html += `<h3 style="margin:0 0 12px 0; font-size:1.1rem; color:var(--text-muted); text-transform:uppercase;">Últimos Partes</h3>`;
        html += `<div class="data-list" style="margin-bottom:24px;">`;
        html += ultimos.map(p => {
          const dur = calcDuracion(p.inicio_ts, p.fin_ts);
          const iniStr = p.inicio_ts ? p.inicio_ts.slice(11, 16) : '?';
          const finStr = p.fin_ts ? p.fin_ts.slice(11, 16) : '?';
          return `
          <div class="data-row">
            <div class="data-row-main">
              <h4>${unificarTipo(p.tipo_limpieza)} · ${p.usuario_nombre || ''}</h4>
              <p>${p.fecha || ''} · ${iniStr} a ${finStr} ${dur ? `(${dur})` : ''}</p>
            </div>
            <span class="badge ${getStatusBadge(p.casa_lista).class}">${getStatusBadge(p.casa_lista).text}</span>
          </div>
        `;
        }).join('');
        html += `</div>`;
      } else {
        html += `<p style="color:var(--text-muted);">No hay partes registrados recientes.</p>`;
      }

      return html;
    }

    function calcDuracion(ini, fin, rawMinutes = false) {
      if (!ini || !fin) return rawMinutes ? 0 : null;
      try {
        const d1 = new Date(ini);
        const d2 = new Date(fin);
        const diffMin = Math.round((d2 - d1) / 60000);
        if (diffMin < 0) return rawMinutes ? 0 : null;
        if (rawMinutes) return diffMin;
        if (diffMin < 60) return `${diffMin} min`;
        const h = Math.floor(diffMin / 60);
        const m = diffMin % 60;
        return m > 0 ? `${h}h ${m}m` : `${h}h`;
      } catch (e) { return rawMinutes ? 0 : null; }
    }
  }

