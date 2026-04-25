// ─── App Router v3 — DG Limpiezas (parte persistente) ─────────────────────
import { api } from './api.js';
import { setLanguage } from './i18n/index.js';
import { toast } from './components/toast.js';
import { renderLogin } from './pages/login.js';
import { renderReanudar } from './pages/reanudar.js';
import { renderSelector } from './pages/parte/selector.js';
import { renderRevision } from './pages/parte/revision.js';
import { renderInicio } from './pages/parte/inicio.js';
import { renderChecklist } from './pages/parte/checklist.js';
import { renderFotos } from './pages/parte/fotos.js';
import { renderCierre } from './pages/parte/cierre.js';
import { renderExito } from './pages/parte/exito.js';
import { renderAdmin } from './pages/admin/dashboard.js';
import { renderPartesAbiertos } from './pages/admin/partes-abiertos.js';
import { renderConsumiblesRapidos } from './pages/consumibles-rapidos.js';
import { renderCalendario } from './pages/calendario.js';

// ─── Estado global ─────────────────────────────────────────────────────────
export const state = {
    user: null,
    config: null,
    parte: {
        id: null, session_id: null, casa: null, tipo: null,
        inicio_ts: null, suciedad: null,
        checklist: [],
        consumibles: [],
        fotosCierre: {},
        fotosAntes: [],
        incidencia: null,
        lena: null, pellets: null,
        ropaSucia: null,
        casaLista: null, casaListaFalta: '',
        resumen: '', pendiente: '',
    },
    partes: [],   // FASE 4: lista de todos los partes abiertos (1 o 2 en Sabayés)
};

export function resetParte() {
    state.parte = {
        id: null, session_id: null, cleaning_session_id: null, casa: null, tipo: null,
        inicio_ts: null, suciedad: null,
        checklist: [], consumibles: [], fotosCierre: {}, fotosAntes: [],
        incidencia: null, lena: null, pellets: null,
        ropaSucia: null, casaLista: null, casaListaFalta: '',
        resumen: '', pendiente: '',
    };
}

export function resetApp() {
    state.user = null;
    state.partes = [];
    state.allOpenParts = [];
    resetParte();
}

// ── Destino post-autenticación — misma lógica para login y para salirSinLogout ──
// Devuelve la página destino ('selector' | 'admin')
export async function resolvePostLoginDest() {
    if (state.user?.rol === 'admin') return 'admin';
    try {
        const openRes = await api.openParte();
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
    } catch { }
    return 'selector';
}

// Salir desde el flujo sin cerrar sesión — reutiliza resolvePostLoginDest
export async function salirSinLogout(navigate) {
    try {
        navigate(await resolvePostLoginDest());
    } catch {
        navigate('selector');
    }
}

// ─── Poblar state.parte desde la respuesta de /api/partes/open ─────────────
export function loadParteFromOpen(parte, stale = false) {
    // Guard: no contaminar state si el objeto parte llega sin ID válido
    if (!parte?.id) {
        console.error('[loadParteFromOpen] parte.id inválido — state no modificado:', parte);
        return;  // return seguro, no throw — la limpiadora no ve error
    }
    state.parte.id = parte.id;
    state.parte.session_id = parte.session_id;
    state.parte.casa = parte.casa;
    state.parte.tipo = parte.tipo;
    state.parte.inicio_ts = parte.inicio_ts;
    state.parte.status = parte.status || 'ABIERTO';
    state.parte.stale = stale;
    // Si ya tiene suciedad guardada en el Sheet, la recuperamos para saltar P1 al reanudar
    if (parte.suciedad_1a5) state.parte.suciedad = parseInt(parte.suciedad_1a5) || null;
}

// ─── Navigation stack ──────────────────────────────────────────────────────
const ROOT_PAGES = new Set(['login', 'selector', 'reanudar', 'admin', 'admin-partes', 'exito']);
let navStack = [];

export function navigate(page, _params = {}) {
    if (!ROUTES[page]) return console.warn('Ruta no existe:', page);

    if (ROOT_PAGES.has(page)) {
        navStack = [];
    } else {
        if (navStack[navStack.length - 1] !== page) {
            navStack.push(page);
        }
    }

    currentPage = page;
    document.getElementById('page-container').innerHTML = '';
    document.getElementById('page-container').classList.remove('hidden');
    ROUTES[page]();
}

/**
 * Vuelve a la pantalla anterior (navStack pop).
 * Si stack vacío: va al 'selector'.
 */
export function goBack() {
    navStack.pop();
    const prev = navStack[navStack.length - 1];
    if (prev) {
        currentPage = prev;
        document.getElementById('page-container').innerHTML = '';
        ROUTES[prev]();
    } else {
        // Fallback: al selector
        navigate('selector');
    }
}

// ─── Router ────────────────────────────────────────────────────────────────
export let currentPage = null;

const ROUTES = {
    login: () => renderLogin(navigate),
    reanudar: () => renderReanudar(navigate, state),
    selector: () => renderSelector(navigate, state),
    revision: () => renderRevision(navigate, goBack, state),
    inicio: () => renderInicio(navigate, state),
    checklist: () => renderChecklist(navigate, state),
    fotos: () => renderFotos(navigate, state),
    cierre: () => renderCierre(navigate, state),
    exito: () => renderExito(navigate, state),
    admin: () => renderAdmin(navigate, state),
    'admin-partes': () => renderPartesAbiertos(),
    'consumibles-rapidos': () => renderConsumiblesRapidos(navigate, state),
    'calendario': () => renderCalendario(navigate, state),
};

// ─── Deep link parser ─────────────────────────────────────────────────────
function parseDeepLink() {
    const params = new URLSearchParams(window.location.search);
    const house = params.get('house');
    const path = window.location.pathname;

    if (path === '/new' && house) {
        const casa = house.toUpperCase();
        if (['MIRADOR', 'CASON', 'GRATAL'].includes(casa)) {
            state.parte.casa = casa;
            window.history.replaceState({}, '', '/');
            return 'selector';
        }
    }
    return null;
}

// ─── Bootstrap ────────────────────────────────────────────────────────────
async function init() {
    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/sw.js').catch(console.warn);
    }

    const loading = document.getElementById('loading-screen');

    try {
        const deepPage = parseDeepLink();
        let user = null;
        try { const me = await api.me(); user = me.user; } catch { }

        if (user) {
            state.user = user;
            setLanguage(user.idioma_ui);  // ← aplica idioma según usuario autenticado
            try { state.config = await api.config(); } catch { }

            // Determinar destino usando el mismo helper que salirSinLogout
            const dest = deepPage || await resolvePostLoginDest();
            navigate(dest);
        } else {
            if (deepPage) sessionStorage.setItem('post_login_page', deepPage);
            navigate('login');
        }
    } catch (err) {
        console.error(err);
        navigate('login');
    } finally {
        loading.style.display = 'none';
    }
}

window.toast = toast;
window.appState = state;
window.navigate = navigate;
window.goBack = goBack;

init();
