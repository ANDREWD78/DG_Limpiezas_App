// ─── Toast Notification Component ────────────────────────────────────────
const container = document.getElementById('toast-container');

export function toast(message, type = 'info', duration = 3000) {
    const icons = { success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️' };
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.innerHTML = `<span>${icons[type] || ''}</span><span>${message}</span>`;
    container.appendChild(el);

    setTimeout(() => {
        el.classList.add('out');
        setTimeout(() => el.remove(), 300);
    }, duration);
}
