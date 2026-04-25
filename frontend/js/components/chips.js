// ─── Helper: chips "¿Qué has hecho tú?" ──────────────────────────────────────
// Genera la lista de chips multi-select por casa y temporada.
// Los datos se guardan como "Cocina|Baños|Suelos" (pipe-separated).

/**
 * Devuelve un array de labels de chips para la casa y temporada dada.
 */
export function getChips(casa, temporada) {
    const common = [
        'Cocina', 'Baños', 'Habitaciones', 'Salón / zonas comunes',
        'Suelos', 'Exterior / jardín', 'Ropa de cama / toallas',
        'Basuras', 'Reposición consumibles',
    ];

    const conditional = [];
    if (temporada === 'verano' && (casa === 'MIRADOR' || casa === 'GRATAL')) {
        conditional.push('Piscina');
    }
    if (casa === 'MIRADOR' || casa === 'GRATAL') {
        conditional.push('Sala de juegos');
    }
    if (casa === 'MIRADOR') {
        conditional.push('Despensa');
    }
    if (casa === 'CASON') {
        conditional.push('Hogar', 'Leña');
        if (temporada === 'invierno') conditional.push('Rellenar pellets');
    }
    if (casa === 'GRATAL') {
        conditional.push('Barbacoa', 'Patio delantero');
    }

    return [...common, ...conditional];
}

/**
 * Genera el HTML del bloque de chips multi-select.
 * Los chips se aplican una clase 'chip-active' al seleccionarse.
 */
export function chipsBlockHTML(casa, temporada) {
    const chips = getChips(casa, temporada);
    return `
    <div class="section-header mt-16"><h2>🙋 ¿Qué tareas has hecho tú hoy?</h2></div>
    <div class="card">
      <p style="font-size:.82rem;color:var(--text-muted);margin-bottom:12px;">
        Marca solo las tareas que has hecho tú (1 toque — opcional)
      </p>
      <div id="chips-wrap" style="display:flex;flex-wrap:wrap;gap:8px;">
        ${chips.map(c => `
          <button type="button" class="chip" data-chip="${c}">
            ${c}
          </button>
        `).join('')}
      </div>
    </div>
  `;
}

/**
 * Vincula el comportamiento de toggle en los chips.
 * Llamar después de que el HTML esté en el DOM.
 */
export function bindChips(container) {
    container.querySelector('#chips-wrap')?.addEventListener('click', e => {
        const chip = e.target.closest('.chip');
        if (!chip) return;
        chip.classList.toggle('chip-active');
    });
}

/**
 * Lee los chips activos y devuelve la string "A|B|C".
 */
export function readChips(container) {
    return [...container.querySelectorAll('.chip.chip-active')]
        .map(c => c.dataset.chip)
        .join('|');
}
