// ─── Admin: Usuarios ────────────────────────────────────────────────────────
import { api } from '../../api.js';

let currentUsers = [];

export async function renderUsuarios(container) {
    container.innerHTML = `
        <div class="section-header" style="display:flex; justify-content:space-between; align-items:flex-end;">
            <h2>👥 Usuarios</h2>
            <button id="btn-crear-usuario" class="btn btn-sm btn-primary" style="padding:6px 12px; border-radius:8px; font-weight:600; font-size:0.85rem; width:auto;">+ Nuevo usuario</button>
        </div>
        <div id="usuarios-list-container">
            <div style="text-align:center; padding:20px; color:var(--text-muted);">Cargando usuarios...</div>
        </div>

        <!-- Overlay Crear / Editar Usuario -->
        <div id="modal-usuario" class="modal-overlay" style="z-index:999; display:none; position:fixed; inset:0; background:var(--bg); overflow-y:auto; padding:0;">
            <div class="modal" style="display:flex; flex-direction:column; width:100%; min-height:100%; background:var(--bg); padding:24px 20px;">
                <div class="modal-header" style="margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">
                    <h3 id="modal-usuario-title" style="margin:0; font-size:1.4rem; font-weight:700; color:var(--text);">Usuario</h3>
                    <button id="btn-cerrar-usuario" style="background:none; border:none; font-size:1.5rem; color:var(--text); opacity:0.8; cursor:pointer; padding:8px; margin-right:-8px;">&times;</button>
                </div>
                <p id="usuario-error" class="pin-error" style="margin-top:0; margin-bottom:16px; text-align:left;"></p>
                <form id="form-usuario" style="display:flex; flex-direction:column; gap:16px; flex-grow:1;">
                    <input type="hidden" name="user_id" id="edit-user-id">
                    
                    <div>
                        <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Nombre *</label>
                        <input type="text" name="nombre" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit;">
                    </div>
                    
                    <div>
                        <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Apellidos</label>
                        <input type="text" name="apellidos" class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit;">
                    </div>
                    
                    <div>
                        <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Teléfono *</label>
                        <input type="tel" name="telefono" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit;">
                    </div>
                    
                    <div>
                        <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Email *</label>
                        <input type="email" name="email" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit;">
                    </div>

                    <div style="display:flex; gap:12px;">
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Rol *</label>
                            <select name="rol" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit; background:transparent; color:var(--text);">
                                <option value="limpieza" style="background:var(--bg); color:var(--text);">Limpieza</option>
                                <option value="mantenimiento" style="background:var(--bg); color:var(--text);">Mantenimiento</option>
                                <option value="admin" style="background:var(--bg); color:var(--text);">Admin</option>
                            </select>
                        </div>
                        <div style="flex:1;">
                            <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Activo *</label>
                            <select name="activo" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit; background:transparent; color:var(--text);">
                                <option value="Sí" style="background:var(--bg); color:var(--text);">Sí</option>
                                <option value="No" style="background:var(--bg); color:var(--text);">No</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Tarifa (€/h) <small style="font-weight:normal">(ej: 20,57)</small></label>
                        <input type="text" name="tarifa_eur_hora" class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit;" inputmode="decimal">
                    </div>

                    <div id="pin-section" style="margin-top:8px;">
                        <!-- Solamente se muestra en CREAR -->
                        <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">PIN (4 cifras) *</label>
                        <input type="password" name="pin" id="input-crear-pin" title="4 números" pattern="\\d{4}" maxlength="4" class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1.1rem; font-family:inherit; text-align:center; letter-spacing:3px;" inputmode="numeric">
                    </div>
                    
                    <div style="margin-top:auto; padding-top:24px; padding-bottom:16px;">
                        <button type="submit" id="btn-submit-usuario" class="btn btn-primary" style="width:100%; padding:16px; font-weight:700; font-size:1.1rem; border-radius:10px; border:none; background:var(--primary); color:white; cursor:pointer;">Guardar Usuario</button>
                    </div>
                </form>
            </div>
        </div>

        <!-- Overlay Cambiar PIN -->
        <div id="modal-pin" class="modal-overlay" style="z-index:999; display:none; position:fixed; inset:0; background:var(--bg); overflow-y:auto; padding:0;">
            <div class="modal" style="display:flex; flex-direction:column; width:100%; min-height:100%; background:var(--bg); padding:24px 20px;">
                <div class="modal-header" style="margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">
                    <h3 style="margin:0; font-size:1.4rem; font-weight:700; color:var(--text);">Cambiar PIN</h3>
                    <button id="btn-cerrar-pin" style="background:none; border:none; font-size:1.5rem; color:var(--text); opacity:0.8; cursor:pointer; padding:8px; margin-right:-8px;">&times;</button>
                </div>
                
                <p style="color:var(--text-muted); font-size:0.95rem; margin-bottom:20px; text-align:center;">
                    Establece un nuevo PIN para <strong id="lbl-pin-nombre" style="color:var(--text);"></strong>.
                </p>

                <p id="pin-error" class="pin-error" style="margin-top:0; margin-bottom:16px; text-align:left;"></p>
                
                <form id="form-pin" style="display:flex; flex-direction:column; gap:16px; flex-grow:1;">
                    <input type="hidden" name="user_id" id="pin-user-id">
                    
                    <div style="display:flex; flex-direction:column; align-items:center; gap:16px;">
                        <input type="password" name="pin" placeholder="Nuevo PIN (4 cifras)" title="4 números" pattern="\\d{4}" maxlength="4" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:70%; box-sizing:border-box; font-size:1.5rem; font-family:inherit; text-align:center; letter-spacing:6px;" inputmode="numeric">
                        <input type="password" name="pin2" placeholder="Repetir PIN" title="4 números" pattern="\\d{4}" maxlength="4" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:70%; box-sizing:border-box; font-size:1.5rem; font-family:inherit; text-align:center; letter-spacing:6px;" inputmode="numeric">
                    </div>
                    
                    <div style="margin-top:auto; padding-top:24px; padding-bottom:16px;">
                        <button type="submit" id="btn-submit-pin" class="btn btn-primary" style="width:100%; padding:16px; font-weight:700; font-size:1.1rem; border-radius:10px; border:none; background:var(--primary); color:white; cursor:pointer;">Guardar Nuevo PIN</button>
                    </div>
                </form>
            </div>
        </div>
    `;

    // DOM Elements
    const listContainer = container.querySelector('#usuarios-list-container');
    const btnCrear = container.querySelector('#btn-crear-usuario');
    
    const modalUsuario = container.querySelector('#modal-usuario');
    const formUsuario = container.querySelector('#form-usuario');
    const btnCerrarUsuario = container.querySelector('#btn-cerrar-usuario');
    const titleUsuario = container.querySelector('#modal-usuario-title');
    const errUsuario = container.querySelector('#usuario-error');
    const inputPinCrear = container.querySelector('#input-crear-pin');
    const secPinCrear = container.querySelector('#pin-section');

    const modalPin = container.querySelector('#modal-pin');
    const formPin = container.querySelector('#form-pin');
    const btnCerrarPin = container.querySelector('#btn-cerrar-pin');
    const titlePinNombre = container.querySelector('#lbl-pin-nombre');
    const errPin = container.querySelector('#pin-error');

    async function reloadList() {
        try {
            currentUsers = await api.usuarios();
            renderList();
        } catch (e) {
            listContainer.innerHTML = `<div class="pin-error">Error al cargar: ${e.message}</div>`;
        }
    }

    function renderList() {
        if (!currentUsers?.length) {
            listContainer.innerHTML = '<div class="empty-state"><div class="icon">👥</div><p>No hay usuarios configurados</p></div>';
            return;
        }

        const sorted = [...currentUsers].sort((a, b) => {
            const actA = a.activo?.toLowerCase() === 'no' || a.Activo?.toLowerCase() === 'no' ? 0 : 1;
            const actB = b.activo?.toLowerCase() === 'no' || b.Activo?.toLowerCase() === 'no' ? 0 : 1;
            if (actA !== actB) return actB - actA; // Activos primero
            const nameA = (a.nombre || a.Nombre || '').toLowerCase();
            const nameB = (b.nombre || b.Nombre || '').toLowerCase();
            return nameA.localeCompare(nameB);
        });

        listContainer.innerHTML = `
            <div class="data-list">
            ${sorted.map(u => {
                const isInactive = u.activo?.toLowerCase() === 'no' || u.Activo?.toLowerCase() === 'no';
                const opacity = isInactive ? '0.6' : '1';
                
                // Normalizar la vista de la tarifa (punto -> coma)
                const tarifaBase = u.tarifa_eur_hora || u.Tarifa || '12';
                const tarifaUi = tarifaBase.replace('.', ',');

                const fullNombre = [u.nombre || u.Nombre, u.apellidos || ''].filter(Boolean).join(' ') || '—';
                const rolUi = u.rol || u.Rol || 'limpieza';
                const idAttr = u.user_id ? `data-id="${u.user_id}"` : '';

                return `
                    <div class="data-row" style="opacity: ${opacity}; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; padding: 12px 16px; background:var(--surface); border:1px solid rgba(255,255,255,.05); border-radius:12px;">
                        
                        <div style="flex:1; min-width:200px;">
                            <div style="display:flex; align-items:center; gap:8px; margin-bottom:4px;">
                                <h4 style="margin:0; font-size:1rem; color:var(--text); font-weight:700;">${fullNombre}</h4>
                                <span class="badge ${isInactive ? 'badge-error' : 'badge-ok'}" style="font-size:0.65rem; padding:2px 6px;">${isInactive ? 'Inactivo' : 'Activo'}</span>
                            </div>
                            <div style="font-size:0.8rem; color:var(--text-muted); text-transform:capitalize; margin-bottom:6px;">
                                <span style="font-weight:600; color:var(--text);">${rolUi}</span> · ${tarifaUi}€/h
                            </div>
                            
                            ${(u.telefono || u.email) ? `
                            <div style="display:flex; flex-direction:column; gap:2px;">
                                ${u.telefono ? `<div style="font-size:0.75rem; color:var(--text-muted);"><span style="opacity:0.7; margin-right:4px;">📞</span>${u.telefono}</div>` : ''}
                                ${u.email ? `<div style="font-size:0.75rem; color:var(--text-muted);"><span style="opacity:0.7; margin-right:4px;">✉️</span>${u.email}</div>` : ''}
                            </div>
                            ` : ''}
                        </div>

                        <div style="display:flex; gap:8px; align-items:center; flex-shrink:0;">
                            ${u.user_id ? `
                                <button type="button" class="btn btn-sm btn-secondary btn-edit" ${idAttr} style="padding:6px 10px; font-size:0.75rem;">✏️ Editar</button>
                                <button type="button" class="btn btn-sm btn-secondary btn-pin" ${idAttr} style="padding:6px 10px; font-size:0.75rem;">🔑 PIN</button>
                            ` : `
                                <em style="font-size:0.75rem; color:var(--text-muted); font-style:italic;">Solo lectura</em>
                            `}
                        </div>
                    </div>
                `;
            }).join('')}
            </div>
            <div class="card mt-16" style="border-color:rgba(59,130,246,0.3);">
                <div class="card-title">ℹ️ Nota de seguridad</div>
                <p style="font-size:.85rem;color:var(--text-muted);line-height:1.6; margin:0;">
                    El borrado físico está desactivado para no corromper el histórico de limpieza. Si un empleado no continúa, pon su estado a <strong>Inactivo</strong>. (Los usuarios heredados antiguos sin \`user_id\` creado deben gestionarse desde Drive).
                </p>
            </div>
        `;
    }

    listContainer.addEventListener('click', (e) => {
        const btnEdit = e.target.closest('.btn-edit');
        if (btnEdit) {
            const id = btnEdit.dataset.id;
            const u = currentUsers.find(x => x.user_id === id);
            if (u) openEditUser(u);
            return;
        }
        
        const btnPin = e.target.closest('.btn-pin');
        if (btnPin) {
            const id = btnPin.dataset.id;
            const u = currentUsers.find(x => x.user_id === id);
            if (u) openEditPin(u);
            return;
        }
    });

    btnCrear.addEventListener('click', () => {
        formUsuario.reset();
        formUsuario.elements.user_id.value = '';
        formUsuario.elements.rol.value = 'limpieza';
        formUsuario.elements.activo.value = 'Sí';
        titleUsuario.textContent = 'Crear Usuario';
        errUsuario.textContent = '';
        secPinCrear.style.display = 'block';
        inputPinCrear.required = true;
        
        modalUsuario.style.display = 'block';
    });

    btnCerrarUsuario.addEventListener('click', () => modalUsuario.style.display = 'none');
    btnCerrarPin.addEventListener('click', () => modalPin.style.display = 'none');

    function openEditUser(u) {
        formUsuario.reset();
        formUsuario.elements.user_id.value = u.user_id;
        formUsuario.elements.nombre.value = u.nombre || u.Nombre || '';
        formUsuario.elements.apellidos.value = u.apellidos || '';
        formUsuario.elements.telefono.value = u.telefono || '';
        formUsuario.elements.email.value = u.email || '';
        formUsuario.elements.rol.value = u.rol || u.Rol || 'limpieza';
        formUsuario.elements.activo.value = u.activo || u.Activo || 'Sí';
        formUsuario.elements.tarifa_eur_hora.value = (u.tarifa_eur_hora || u.Tarifa || '').replace('.', ',');
        
        titleUsuario.textContent = 'Editar Usuario';
        errUsuario.textContent = '';
        
        secPinCrear.style.display = 'none';
        inputPinCrear.required = false;

        modalUsuario.style.display = 'block';
    }

    function openEditPin(u) {
        formPin.reset();
        formPin.elements.user_id.value = u.user_id;
        titlePinNombre.textContent = [u.nombre || u.Nombre, u.apellidos].filter(Boolean).join(' ');
        errPin.textContent = '';
        modalPin.style.display = 'block';
    }

    formUsuario.addEventListener('submit', async (e) => {
        e.preventDefault();
        errUsuario.textContent = '';
        const fd = new FormData(formUsuario);
        const data = Object.fromEntries(fd.entries());
        const id = data.user_id;

        const btnSubmit = formUsuario.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Guardando...';
        btnSubmit.style.opacity = '0.7';

        try {
            if (id) {
                await api.adminEditarUsuario(id, data);
            } else {
                await api.adminCrearUsuario(data);
            }
            modalUsuario.style.display = 'none';
            await reloadList();
        } catch (err) {
            errUsuario.textContent = err.message || 'Error al guardar';
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Guardar Usuario';
            btnSubmit.style.opacity = '1';
        }
    });

    formPin.addEventListener('submit', async (e) => {
        e.preventDefault();
        errPin.textContent = '';
        const fd = new FormData(formPin);
        const data = Object.fromEntries(fd.entries());
        
        if (data.pin !== data.pin2) {
            errPin.textContent = 'Los PIN no coinciden';
            return;
        }

        const btnSubmit = formPin.querySelector('button[type="submit"]');
        btnSubmit.disabled = true;
        btnSubmit.textContent = 'Guardando...';
        btnSubmit.style.opacity = '0.7';

        try {
            await api.adminCambiarPinUsuario(data.user_id, data.pin);
            modalPin.style.display = 'none';
        } catch (err) {
            errPin.textContent = err.message || 'Error al cambiar PIN';
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.textContent = 'Guardar Nuevo PIN';
            btnSubmit.style.opacity = '1';
        }
    });

    // Carga inicial
    await reloadList();
}
