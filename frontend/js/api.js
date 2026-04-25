// ─── API Client v2 — DG Limpiezas ─────────────────────────────────────────
const isLocal = window.location.hostname !== 'limpiezas.destinoguara.com';

const BASE = isLocal ? `http://${window.location.hostname}:3001` : '';

async function request(method, path, body = null, isFormData = false) {
    const opts = {
        method, credentials: 'include',
        headers: isFormData ? {} : { 'Content-Type': 'application/json' },
    };
    if (body) opts.body = isFormData ? body : JSON.stringify(body);

    let url = BASE + path;
    if (method === 'GET') {
        url += (url.includes('?') ? '&' : '?') + '_t=' + Date.now();
    }
    
    console.log(`[API_REQ] ${method} ${url} - At: ${new Date().toISOString()}`);
    
    const res = await fetch(url, opts);
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        // 409 = parte ya abierto: retornar body para que el caller pueda redirigir
        if (res.status === 409) return data;
        throw new Error(data.error || `Error ${res.status}`);
    }
    return data;
}

export const api = {
    // Auth
    login: (pin) => request('POST', '/api/auth/login', { pin }),
    logout: () => request('POST', '/api/auth/logout'),
    me: () => request('GET', '/api/auth/me'),
    register: (data) => request('POST', '/api/auth/register', data),

    // Config
    config: () => request('GET', '/api/config'),

    // Partes
    activeSession: (casa) => request('GET', `/api/partes/active?casa=${casa}`),
    openParte: () => request('GET', '/api/partes/open'),
    openPartsByCasa: (casa, excludeId, cleaningSessionId) =>
        request('GET', `/api/partes/open-by-casa?casa=${encodeURIComponent(casa)}&exclude_id=${encodeURIComponent(excludeId || '')}&csid=${encodeURIComponent(cleaningSessionId || '')}`),
    iniciarParte: (data) => request('POST', '/api/partes/iniciar', data),
    finalizarParte: (id, fd) => request('POST', `/api/partes/${id}/finalizar`, fd, true),
    pausarParte: (id) => request('POST', `/api/partes/${id}/pausar`),
    reanudarParte: (id) => request('POST', `/api/partes/${id}/reanudar`),
    partes: (p = {}) => request('GET', `/api/partes?${new URLSearchParams(p)}`),

    // Incidencias
    crearIncidencia: (fd) => request('POST', '/api/incidencias', fd, true),
    incidencias: (p = {}) => request('GET', `/api/incidencias?${new URLSearchParams(p)}`),
    updateIncidencia: (id, d) => request('PATCH', `/api/incidencias/${id}`, d),
    metaIncidencias: () => request('GET', '/api/incidencias/meta'),

    // Consumibles
    catalogoConsumo: (casa) => request('GET', `/api/consumibles/catalogo?casa=${casa}`),
    registrarConsumo: (data) => request('POST', '/api/consumibles', data),
    consumibles: (p = {}) => request('GET', `/api/consumibles?${new URLSearchParams(p)}`),
    updateConsumo: (id, d) => request('PATCH', `/api/consumibles/${id}`, d),

    // Consumibles — Propuestas
    crearPropuesta: (data) => request('POST', '/api/propuestas', data),
    propuestas: (p = {}) => request('GET', `/api/propuestas?${new URLSearchParams(p)}`),
    aprobarPropuesta: (id, data) => request('POST', `/api/propuestas/${id}/aprobar`, data),
    rechazarPropuesta: (id, data = {}) => request('POST', `/api/propuestas/${id}/rechazar`, data),

    // Admin
    dashboard: () => request('GET', '/api/admin/dashboard'),
    syncReservas: () => request('POST', '/api/admin/sync-reservas'),
    usuarios: () => request('GET', '/api/admin/usuarios'),
    adminCrearUsuario: (data) => request('POST', '/api/admin/usuarios', data),
    adminEditarUsuario: (id, data) => request('PUT', `/api/admin/usuarios/${id}`, data),
    adminSetTemporada: (temporada) => request('POST', '/api/admin/config/temporada', { temporada }),
    adminCambiarPinUsuario: (id, pin) => request('PATCH', `/api/admin/usuarios/${id}/pin`, { pin }),
    resumenMensual: (mes) => request('GET', `/api/admin/resumen-mensual${mes ? '?mes=' + mes : ''}`),
    partesAbiertos: () => request('GET', '/api/admin/partes-abiertos'),
    adminCrearParteManual: (data) => request('POST', '/api/admin/partes/manual', data),
    forceClose: (id, data) => request('POST', `/api/admin/partes/${id}/cerrar`, data),
    editTimestamps: (id, data) => request('POST', `/api/admin/partes/${id}/editar-horas`, data),
    ajustarTiempo: (id, data) => request('PATCH', `/api/admin/partes/${id}/ajustar-tiempo`, data),
    adminAnularParte: (id, data) => request('POST', `/api/admin/partes/${id}/anular`, data),

    // QR
    qrList: () => request('GET', '/api/qr'),

    // Tareas periódicas
    getTareasPeriodicasByCasa: (casa) => request('GET', `/api/tareas-periodicas?casa=${encodeURIComponent(casa)}`),

    // Tareas periódicas — Admin
    adminTareasPeriodicas: () => request('GET', '/api/admin/tareas-periodicas'),
    adminCrearTarea: (data) => request('POST', '/api/admin/tareas-periodicas', data),
    adminEditarTarea: (id, data) => request('PUT', `/api/admin/tareas-periodicas/${id}`, data),
    adminMarcarHecha: (id, data = {}) => request('POST', `/api/admin/tareas-periodicas/${id}/marcar-hecha`, data),
    adminTareasLog: (casa) => request('GET', `/api/admin/tareas-periodicas-log${casa ? '?casa=' + encodeURIComponent(casa) : ''}`),
    saveOverride: (data) => request('POST', '/api/admin/overrides', data),

    // Calendario (Trabajadoras & Admin)
    calendario: () => request('GET', '/api/partes/calendario'),
};
