// [LEGACY/OUT OF USE] 
// ATENCIÓN: Este archivo está huérfano y fuera de uso.
// La lógica real y activa de incidencias vive actualmente en frontend/js/pages/admin/dashboard.js
// ─── Admin: Incidencias ────────────────────────────────────────────────────
import { api } from '../../api.js';
import { toast } from '../../components/toast.js';

let currentFilters = { estado: 'todos', casa: 'todas' };

export async function renderIncidencias(container) {
    const params = {};
    if (currentFilters.estado && currentFilters.estado !== 'todos') params.estado = currentFilters.estado;
    if (currentFilters.casa && currentFilters.casa !== 'todas') params.casa = currentFilters.casa;

    const data = await api.incidencias(params);

    const pendientes = data.filter(i => {
        const est = (i.estado || i.Estado || '').toLowerCase();
        return est !== 'resuelta' && est !== 'descartada';
    });

    const chipStyle = (isActive) => `padding: 6px 12px; border-radius: 20px; font-size: 0.8rem; font-weight: 500; border: 1px solid ${isActive ? 'var(--primary)' : 'var(--border)'}; background: ${isActive ? 'var(--primary)' : 'transparent'}; color: ${isActive ? '#fff' : 'var(--text-muted)'}; cursor: pointer; flex-shrink: 0; transition: all 0.2s; -webkit-tap-highlight-color: transparent;`;

    const filtersHtml = `
      <div style="background:var(--bg-surface); padding:14px; border-radius:12px; margin-bottom:16px; border:1px solid var(--border); display:flex; flex-direction:column; gap:12px;">
        <div style="display:flex; gap:8px; align-items:center; overflow-x:auto; scrollbar-width:none;">
          <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600; white-space:nowrap; margin-right:4px;">Estado:</span>
          <button class="inc-filter-btn" data-filter="estado" data-val="todos" style="${chipStyle(currentFilters.estado === 'todos')}">Todos</button>
          <button class="inc-filter-btn" data-filter="estado" data-val="Pendiente" style="${chipStyle(currentFilters.estado === 'Pendiente')}">Pendiente</button>
          <button class="inc-filter-btn" data-filter="estado" data-val="En Curso" style="${chipStyle(currentFilters.estado === 'En Curso')}">En curso</button>
          <button class="inc-filter-btn" data-filter="estado" data-val="Resuelta" style="${chipStyle(currentFilters.estado === 'Resuelta')}">Resuelta</button>
          <button class="inc-filter-btn" data-filter="estado" data-val="Descartada" style="${chipStyle(currentFilters.estado === 'Descartada')}">Descartada</button>
        </div>
        <div style="display:flex; gap:8px; align-items:center; overflow-x:auto; scrollbar-width:none;">
          <span style="font-size:0.8rem; color:var(--text-muted); font-weight:600; white-space:nowrap; margin-right:12px;">Casa:</span>
          <button class="inc-filter-btn" data-filter="casa" data-val="todas" style="${chipStyle(currentFilters.casa === 'todas')}">Todas</button>
          <button class="inc-filter-btn" data-filter="casa" data-val="MIRADOR" style="${chipStyle(currentFilters.casa === 'MIRADOR')}">MIRADOR</button>
          <button class="inc-filter-btn" data-filter="casa" data-val="CASON" style="${chipStyle(currentFilters.casa === 'CASON')}">CASON</button>
          <button class="inc-filter-btn" data-filter="casa" data-val="GRATAL" style="${chipStyle(currentFilters.casa === 'GRATAL')}">GRATAL</button>
        </div>
      </div>
    `;

    let mainContentHtml = `
      <div class="section-header">
        <h2>Incidencias</h2>
        <span class="badge badge-error">${pendientes.length} pendientes</span>
      </div>
      ${filtersHtml}
    `;

    if (!data.length) {
        mainContentHtml += '<div class="empty-state" style="padding-top:40px;"><div class="icon">✅</div><p>No hay incidencias para este filtro</p></div>';
    } else {
        mainContentHtml += `
          <div class="data-list" id="incidencias-list">
            ${buildList(data)}
          </div>
        `;
    }

    container.innerHTML = `
    <div style="padding-bottom: 80px;">
      ${mainContentHtml}
    </div>
    <div class="bottom-actions">
      <button id="btn-add-inc" class="btn btn-primary w-full">➕ Añadir incidencia</button>
    </div>
  `;

  // Asignar eventos de filtros
  container.querySelectorAll('.inc-filter-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
          const type = btn.dataset.filter;
          const val = btn.dataset.val;
          currentFilters[type] = val;
          renderIncidencias(container); // Recargar
      });
  });

    // ─── LÓGICA DE AÑADIR INCIDENCIA GLOBAL ────────────────────────────────
    container.querySelector('#btn-add-inc').addEventListener('click', () => {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.7);z-index:9999;display:flex;align-items:flex-end;justify-content:center;';
        
        const fieldStyle = `background:#0b1220; border:1px solid rgba(148,163,184,.35); border-radius:12px; padding:12px 14px; color:#f8fafc; width:100%; font-size:.85rem; height:50px; outline:none; transition:border-color .2s;`;
        
        modal.innerHTML = `
          <div style="background:var(--bg-surface);border-radius:20px 20px 0 0;padding:24px 20px 44px;width:100%;max-width:480px;border-top:1px solid var(--border);">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
              <h3 style="margin:0;color:var(--text);font-size:1.1rem;font-weight:800;">Añadir Incidencia</h3>
              <button id="btn-close-modal" style="background:none;border:none;color:var(--text);font-size:1.5rem;cursor:pointer;">&times;</button>
            </div>
            
            <div style="margin-bottom:12px;">
              <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Casa</label>
              <select id="m-casa" style="${fieldStyle}">
                <option value="MIRADOR">MIRADOR</option>
                <option value="CASON">CASON</option>
                <option value="GRATAL">GRATAL</option>
              </select>
            </div>
            
            <div style="margin-bottom:12px;">
              <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Categoría</label>
              <select id="m-cat" style="${fieldStyle}">
                <option value="Mantenimiento y Reparaciones">Mantenimiento y Reparaciones</option>
                <option value="Mobiliario y Enseres">Mobiliario y Enseres</option>
                <option value="Limpieza Extraordinaria">Limpieza Extraordinaria</option>
                <option value="Suministros Básicos">Suministros Básicos</option>
              </select>
            </div>

            <div style="margin-bottom:12px;">
              <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">Descripción</label>
              <input type="text" id="m-desc" placeholder="Ej: Pila del baño atascada" style="${fieldStyle}">
            </div>

            <div style="margin-bottom:16px;">
              <label style="display:block;margin-bottom:6px;font-size:.8rem;font-weight:600;">📷 Fotos o vídeo (opcional)</label>
              <div class="foto-grid" id="m-grid">
                <label class="foto-add-btn" for="m-media0">
                  <span class="plus">+</span><span>Foto/vídeo</span>
                </label>
                <input type="file" id="m-media0" accept="image/*,video/*" multiple style="display:none"/>
              </div>
            </div>

            <button id="btn-save-inc" class="btn btn-primary w-full">Guardar incidencia</button>
          </div>
        `;
        document.body.appendChild(modal);

        // ── Media: fotos + vídeo ───────────────────────────────────────────────
        let incFotos = [];   // solo imágenes
        let incVideo = null; // un único vídeo
        let incMediaIdx = 1;

        function esVideoFile(f) { return f.type.startsWith('video/'); }

        function refreshGrid() {
          const grid = modal.querySelector('#m-grid');
          const idx = incMediaIdx++;
          const fotosThumb = incFotos.map((f, i) =>
            `<img class="foto-thumb" src="${URL.createObjectURL(f)}" alt="${i}"/>`
          ).join('');
          const videoThumb = incVideo
            ? `<div class="foto-thumb" style="display:flex;align-items:center;justify-content:center;background:#1e293b;font-size:1.8rem;" title="${incVideo.name}">🎬</div>`
            : '';
          const puedeAnadirFotos = incFotos.length < 5;
          const puedeAnadirVideo = !incVideo;
          const addBtn = (puedeAnadirFotos || puedeAnadirVideo) ? `
            <label class="foto-add-btn" for="m-media${idx}">
              <span class="plus">+</span><span>Más</span>
            </label>
            <input type="file" id="m-media${idx}" accept="image/*,video/*"
                   ${puedeAnadirFotos ? 'multiple' : ''} style="display:none"/>
          ` : '';
          grid.innerHTML = fotosThumb + videoThumb + addBtn;
          if (puedeAnadirFotos || puedeAnadirVideo) bindMedia(`m-media${idx}`);
        }

        function bindMedia(id) {
          modal.querySelector(`#${id}`)?.addEventListener('change', e => {
            Array.from(e.target.files).forEach(f => {
              if (esVideoFile(f)) {
                if (!incVideo) incVideo = f;
              } else {
                if (incFotos.length < 5) incFotos.push(f);
              }
            });
            refreshGrid();
          });
        }
        bindMedia('m-media0');

        const close = () => modal.remove();
        modal.querySelector('#btn-close-modal').onclick = close;
        modal.onclick = (e) => { if (e.target === modal) close(); };

        modal.querySelector('#btn-save-inc').onclick = async function() {
            const btn = this;
            const casa = modal.querySelector('#m-casa').value;
            const cat = modal.querySelector('#m-cat').value;
            const desc = modal.querySelector('#m-desc').value.trim();

            if (!desc) { toast('Añade una descripción', 'warning'); return; }

            btn.disabled = true;
            btn.textContent = 'Guardando...';

            try {
                const fd = new FormData();
                fd.append('casa', casa);
                fd.append('categoria', cat);
                fd.append('ubicacion', 'General'); // Hardcoded genérico admin
                fd.append('prioridad', 'Normal');
                fd.append('descripcion', desc);
                incFotos.forEach(f => fd.append('fotos', f));
                if (incVideo) fd.append('video', incVideo);

                await api.crearIncidencia(fd);
                toast('Incidencia creada ✅', 'success');
                close();
                
                // Refresco in place
                renderIncidencias(container);
            } catch (err) {
                toast('Error: ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Guardar incidencia';
            }
        };
    });

    const incList = container.querySelector('#incidencias-list');
    if (incList) {
        incList.addEventListener('click', async (e) => {
            const btn = e.target.closest('.btn-resolver');
            if (!btn) return;
            const id = btn.dataset.id;
            btn.disabled = true;
            btn.textContent = '...';
            try {
                await api.resolverIncidencia(id);
                toast('Incidencia marcada como resuelta ✅', 'success');
                // Refrescar
                renderIncidencias(container);
            } catch (err) {
                toast('Error: ' + err.message, 'error');
                btn.disabled = false;
                btn.textContent = 'Resolver';
            }
        });
    }

    function renderIncMediaBadgesLocal(i) {
      // Signed URLs generadas por el backend (bucket privado)
      // Fallback a campo legacy 'Foto URL'
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

    function buildList(items) {
        return items.map(i => {
            const id = i.ticket_id || i.ID || '';
            const casa = i.casa || i.Piso || '';
            const desc = i.descripcion || i.Descripcion || i['Descripción'] || '';
            const resp = i.responsable || i['Reportado por'] || i.Limpiador || '';
            const est = i.estado || i.Estado || 'Pendiente';
            const isResuelta = est.toLowerCase() === 'resuelta';
            const isDescartada = est.toLowerCase() === 'descartada';
            const isCerrada = isResuelta || isDescartada;
            
            let fecha = i.fecha_creacion || i.Fecha || '';
            if (i.fecha_creacion && i.fecha_creacion.includes('T')) {
                const d = new Date(i.fecha_creacion);
                if (!isNaN(d)) {
                    fecha = `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
                }
            }

            return `
      <div class="data-row" data-id="${id}">
        <div class="data-row-main">
          <h4>${casa} · ${desc}</h4>
          <p>${fecha} · ${resp}</p>
          ${renderIncMediaBadgesLocal(i)}
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:6px;">
          <span class="badge ${isCerrada ? 'badge-ok' : 'badge-error'}" ${isDescartada ? 'style="background: #475569; color: #f8fafc;"' : ''}>
            ${isResuelta ? '\u2705 Resuelta' : isDescartada ? '\u26d4 Descartada' : '\ud83d\udd34 ' + est}
          </span>
          ${!isCerrada ? `<button class="btn btn-sm btn-success btn-resolver" data-id="${id}" style="width:auto;padding:6px 10px;">Resolver</button>` : ''}
        </div>
      </div>
    `}).join('');
    }
}
