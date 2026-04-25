// ─── Admin: Consumibles ────────────────────────────────────────────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';

export async function renderConsumibles(container) {
    const data = await api.consumibles();

    let mainContentHtml = '';
    if (!data.length) {
        mainContentHtml = '<div class="empty-state" style="padding-top:40px;"><div class="icon">🛒</div><p>Sin registros de consumibles</p></div>';
    } else {
        // Agrupar por producto para resumen
        const resumen = {};
        data.forEach(r => {
            const prod = r.Producto || '';
            if (!resumen[prod]) resumen[prod] = 0;
            resumen[prod] += parseInt(r.Cantidad || 0);
        });

        mainContentHtml = `
          <div class="section-header"><h2>Resumen de consumo</h2></div>
          <div class="card" style="margin-bottom:20px;">
            ${Object.entries(resumen).sort((a, b) => b[1] - a[1]).map(([prod, total]) => `
              <div class="resumen-stat">
                <span class="label">${prod}</span>
                <strong class="value">${total} unidades</strong>
              </div>
            `).join('')}
          </div>

          <div class="section-header"><h2>Historial reciente</h2></div>
          <div class="data-list" style="padding-bottom: 80px;">
            ${data.slice(0, 30).map(r => `
              <div class="data-row">
                <div class="data-row-main">
                  <h4>${r.Producto || ''}</h4>
                  <p>${r.Fecha || ''} · ${r.Piso || ''} · ${r.Limpiador || ''}</p>
                </div>
                <span class="badge badge-pending">${r.Cantidad || 1} ud</span>
              </div>
            `).join('')}
          </div>
        `;
    }

    container.innerHTML = `
    <div>
      ${mainContentHtml}
    </div>
    
    <div class="bottom-actions">
      <button id="btn-add-cons" class="btn btn-primary w-full">➕ Añadir consumible</button>
    </div>
  `;

    // ─── LÓGICA DE AÑADIR CONSUMIBLE GLOBAL ────────────────────────────────
    container.querySelector('#btn-add-cons')?.addEventListener('click', () => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
        
        const fieldStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; width:100%; font-size:.85rem; height:50px; outline:none; transition:border-color .2s;`;
        
        modal.innerHTML = `
          <div style="background:var(--bg-surface);border-radius:20px 20px 0 0;padding:24px 20px 44px;width:100%;max-width:480px;border-top:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;color:var(--text);font-size:1.1rem;font-weight:800;">Añadir Consumible</h3>
              <button id="btn-close-modal-cons" style="background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer;">&times;</button>
            </div>
            
            <div style="margin-bottom:12px;">
              <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Casa</label>
              <select id="mc-casa" style="${fieldStyle}">
                <option value="MIRADOR">MIRADOR</option>
                <option value="CASON">CASON</option>
                <option value="GRATAL">GRATAL</option>
              </select>
            </div>
            
            <div style="margin-bottom:12px;">
              <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Producto</label>
              <input type="text" id="mc-prod" placeholder="Ej: Papel higiénico" style="${fieldStyle}">
            </div>

            <div style="margin-bottom:16px;">
              <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Cantidad</label>
              <input type="number" id="mc-cant" value="1" min="1" style="${fieldStyle}">
            </div>

            <button id="btn-save-cons" class="btn btn-primary w-full">Guardar consumible</button>
          </div>
        `;
        document.body.appendChild(modal);

        const close = () => modal.remove();
        modal.querySelector('#btn-close-modal-cons').onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };

        modal.querySelector('#btn-save-cons').onclick = async function() {
            const btn = this;
            const casa = modal.querySelector('#mc-casa').value;
            const prod = modal.querySelector('#mc-prod').value.trim();
            const cant = parseInt(modal.querySelector('#mc-cant').value) || 1;

            if (!prod) { 
                toast('Añade un nombre de producto', 'warning'); 
                return; 
            }

            btn.disabled = true;
            btn.textContent = 'Guardando...';

            try {
                await api.registrarConsumo({
                    casa,
                    productos: [{ item: prod, qty: cant }]
                });
                
                toast('Consumible registrado ✅', 'success');
                close();
                
                // Refresco in place
                renderConsumibles(container);
            } catch (err) {
                toast('Error: ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Guardar consumible';
            }
        };
    });
}
