// ─── Login Page — Destino Guara v3 ─────────────────────────────────────────
// Logos sin fondo: copia 10 (horizontal) / copia 9 (cuadrado)
// PIN: 4 dígitos
import { api } from '../api.js';
import { setLanguage } from '../i18n/index.js';
import { state, loadParteFromOpen, resetApp } from '../app.js';

// Rutas a los logos originales sin fondo
const LOGO_H = '/img/logo-dg-horizontal.svg';  // copia 10 — horizontal
const LOGO_SQ = '/img/logo-dg-cuadrado.svg';   // copia 9  — cuadrado

// HTML exports para otras pantallas
export const DG_LOGO_HTML = `<img src="${LOGO_H}"  alt="Destino Guara" class="dg-logo-horizontal"/>`;
export const DG_ICON_HTML = `<img src="${LOGO_SQ}" alt="Destino Guara" class="dg-logo-cuadrado"/>`;
export const DG_ICON = `<img src="/img/logo-dg-icono.svg" alt="DG" width="30" height="30" style="display:block;">`; // icono sin texto — usado en headers de app

export function renderLogin(navigate) {
  const container = document.getElementById('page-container');
  let pin = '';
  const MAX_PIN = 4;

  container.innerHTML = `
    <div class="login-wrap" style="gap:14px;">

      <!-- Logo Destino Guara — horizontal sin fondo -->
      <div class="login-logo" style="width:min(260px,85vw);">
        <img src="${LOGO_H}" alt="Destino Guara"/>
      </div>

      <!-- Título principal de la app -->
      <p class="login-subtitle" style="font-size:1.75rem;color:var(--text);letter-spacing:-.01em;font-weight:800;text-transform:none;margin:0;text-align:center;">Gestión Operaciones DG</p>

      <!-- Card PIN -->
      <div class="login-card">
        <p class="login-title">Introduce tu PIN</p>

        <!-- 4 indicadores -->
        <div class="pin-dots" id="pin-display">
          ${Array(MAX_PIN).fill('<div class="pin-dot"></div>').join('')}
        </div>

        <p class="pin-error" id="pin-error"></p>

        <!-- Teclado 3×4 — touch-action:manipulation evita zoom por doble toque en iOS -->
        <div class="pin-pad" id="pin-pad" style="touch-action:manipulation;">
          ${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', '0', '⌫'].map(k => {
    if (k === '') return '<div class="pin-key-empty"></div>';
    const cls = k === '⌫' ? 'pin-key pin-key-del' : 'pin-key';
    return `<button type="button" class="${cls}" data-key="${k}" aria-label="${k === '⌫' ? 'Borrar' : k}" style="touch-action:manipulation;">${k}</button>`;
  }).join('')}
        </div>

        <div style="text-align:center; margin-top:16px;">
          <button type="button" id="btn-alta" style="background:none; border:none; color:var(--primary); font-size:0.95rem; font-weight:600; cursor:pointer; padding:8px;">Darse de alta</button>
        </div>

      </div>

      <!-- Pantalla Alta (Fullscreen Overlay) -->
      <div id="modal-alta" class="modal-overlay" style="z-index:999; display:none; position:fixed; inset:0; background:var(--bg); overflow-y:auto; padding:0;">
        <div class="modal" style="display:flex; flex-direction:column; width:100%; min-height:100%; background:var(--bg); padding:24px 20px;">
          
          <div class="modal-header" style="margin-bottom:24px; display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:1.4rem; font-weight:700; color:var(--text);">Darse de alta</h3>
            <button id="btn-cerrar-alta" style="background:none; border:none; font-size:1.5rem; color:var(--text); opacity:0.8; cursor:pointer; padding:8px; margin-right:-8px;">&times;</button>
          </div>
          
          <p id="alta-error" class="pin-error" style="margin-top:0; margin-bottom:16px; text-align:left;"></p>
          
          <form id="form-alta" style="display:flex; flex-direction:column; gap:16px; flex-grow:1;">
            <input type="text" name="nombre" placeholder="Nombre (obligatorio)" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit;">
            <input type="text" name="apellidos" placeholder="Apellidos" class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit;">
            <div>
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Teléfono *</label>
                    <input type="tel" name="telefono" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit;">
                </div>
                
                <div>
                    <label style="display:block; font-size:0.85rem; color:var(--text-muted); margin-bottom:4px;">Email *</label>
                    <input type="email" name="email" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:100%; box-sizing:border-box; font-size:1rem; font-family:inherit;">
                </div>         <div style="display:flex; gap:12px; margin-top:8px;">
               <input type="password" name="pin" placeholder="PIN (4 cifras)" title="4 números" pattern="\\d{4}" maxlength="4" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:50%; box-sizing:border-box; font-size:1.1rem; font-family:inherit; text-align:center; letter-spacing:3px;" inputmode="numeric">
               <input type="password" name="pin2" placeholder="Repetir PIN" title="4 números" pattern="\\d{4}" maxlength="4" required class="form-input" style="padding:14px; border-radius:10px; border:1px solid #cbd5e1; width:50%; box-sizing:border-box; font-size:1.1rem; font-family:inherit; text-align:center; letter-spacing:3px;" inputmode="numeric">
            </div>
            
            <div style="margin-top:auto; padding-top:24px; padding-bottom:16px;">
              <button type="submit" class="btn btn-primary" style="width:100%; padding:16px; font-weight:700; font-size:1.1rem; border-radius:10px; border:none; background:var(--primary); color:white; cursor:pointer;">Guardar y entrar</button>
            </div>
          </form>

        </div>
      </div>

    </div>
  `;

  const display = container.querySelector('#pin-display');
  const errorEl = container.querySelector('#pin-error');
  const dots = display.querySelectorAll('.pin-dot');

  function updateDisplay() {
    dots.forEach((d, i) => d.classList.toggle('filled', i < pin.length));
    errorEl.style.color = ''; // Restore default error color
    errorEl.textContent = '';
  }

  async function tryLogin() {
    let loginOk = false;
    // Bloquear el pad durante el intento — evita doble-submit
    const pad = container.querySelector('#pin-pad');
    if (pad) pad.style.pointerEvents = 'none';
    try {
      const res = await api.login(pin);
      loginOk = true;
      resetApp();
      state.user = res.user;
      setLanguage(res.user.idioma_ui);  // ← activa idioma justo tras login, antes de navegar
      console.log(`[LOGIN_SUCCESS] Usuario actual identity: ${state.user.nombre} (${state.user.rol})`);
      try { state.config = await api.config(); } catch { /* continuar */ }


      if (res.user.rol !== 'admin') {
        // La carga de partes se ha delegado de forma estricta a selector.js
        // para garantizar la coherencia antes de renderizar la UI.
      }

      navigate(res.user.rol === 'admin' ? 'admin' : 'selector');
    } catch (err) {
      errorEl.textContent = err.message || 'PIN incorrecto';
      pin = '';
      updateDisplay();
      if (navigator.vibrate) navigator.vibrate([50, 50, 50]);
    } finally {
      // CRÍTICO: solo restaurar el pad si el login falló.
      // Si loginOk=true, el DOM ya ha cambiado por navigate() —
      // modificar nodos desmontados lanza excepción silenciosa en iOS Safari
      // que puede cancelar el navigate antes de completarse.
      if (!loginOk) {
        const p = container.querySelector('#pin-pad');
        if (p) p.style.pointerEvents = '';
      }
    }
  }

  container.querySelector('#pin-pad').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-key]');
    if (!btn) return;
    const key = btn.dataset.key;

    if (navigator.vibrate) navigator.vibrate(10);
    btn.classList.add('pressed');
    setTimeout(() => btn.classList.remove('pressed'), 120);

    if (key === '⌫') {
      pin = pin.slice(0, -1);
    } else if (pin.length < MAX_PIN) {
      pin += key;
    }
    updateDisplay();
    if (pin.length === MAX_PIN) tryLogin();
  });

  // ─── Lógica del Modal Alta ────────────────────────────────────────────────
  const btnAlta = container.querySelector('#btn-alta');
  const modalAlta = container.querySelector('#modal-alta');
  const btnCerrarAlta = container.querySelector('#btn-cerrar-alta');
  const formAlta = container.querySelector('#form-alta');
  const altaError = container.querySelector('#alta-error');

  btnAlta.addEventListener('click', () => {
    modalAlta.style.display = 'block'; // Ocupa toda la pantalla nativamente
    formAlta.reset();
    altaError.textContent = '';
  });

  btnCerrarAlta.addEventListener('click', () => {
    modalAlta.style.display = 'none';
  });

  formAlta.addEventListener('submit', async (e) => {
    e.preventDefault();
    altaError.textContent = '';
    
    const formData = new FormData(formAlta);
    const data = Object.fromEntries(formData.entries());

    if (!data.telefono.trim() && !data.email.trim()) {
      altaError.textContent = 'Debes proporcionar al menos un teléfono o email';
      return;
    }

    if (data.pin !== data.pin2) {
      altaError.textContent = 'Los PIN no coinciden. Por favor, revísalos.';
      return;
    }

    const btnSubmit = formAlta.querySelector('button[type="submit"]');
    btnSubmit.disabled = true;
    btnSubmit.textContent = 'Guardando...';
    btnSubmit.style.opacity = '0.7';

    try {
      await api.register(data);
      // Éxito: cerrar modal y avisar en la pantalla principal
      modalAlta.style.display = 'none';
      errorEl.style.color = '#10b981'; // Un verde esmeralda para éxito
      errorEl.textContent = 'Alta completada. Ya puedes entrar con tu PIN.';
      pin = ''; // resetear pin digitado por si acaso
      dots.forEach(d => d.classList.remove('filled'));
    } catch (err) {
      altaError.textContent = err.message || 'Error al completar el alta';
    } finally {
      btnSubmit.disabled = false;
      btnSubmit.textContent = 'Guardar y entrar';
      btnSubmit.style.opacity = '1';
    }
  });
}
