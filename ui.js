/* ==========================================================================
   استراحة أبو سلطان — UI shell: router, theme, sheets, toasts, helpers
   ========================================================================== */

const NAV = [
  { id: 'dashboard',   ar: 'لوحة التحكم',        ico: 'dashboard',   desktop: true,  mobile: true },
  { id: 'bookings',    ar: 'الحجوزات والإيجارات', ico: 'bookings',    desktop: true,  mobile: true },
  { id: 'expenses',    ar: 'المصاريف والمشتريات', ico: 'expenses',    desktop: true,  mobile: true },
  { id: 'members',     ar: 'حسابات الأعضاء',      ico: 'members',     desktop: true,  mobile: true },
  { id: 'payroll',     ar: 'رواتب العمال',        ico: 'payroll',     desktop: true,  mobile: false },
  { id: 'maintenance', ar: 'الصيانة والأصول',     ico: 'maintenance', desktop: true,  mobile: false },
  { id: 'reports',     ar: 'التقارير المالية',     ico: 'reports',     desktop: true,  mobile: false },
  { id: 'audit',       ar: 'سجل التعديلات',       ico: 'audit',       desktop: true,  mobile: false },
  { id: 'settings',    ar: 'الإعدادات',          ico: 'settings',    desktop: true,  mobile: false },
  { id: 'more',        ar: 'المزيد',             ico: 'more',        desktop: false, mobile: true },
];
const MOBILE_ONLY = ['more'];
let route = 'dashboard';
let uiState = {};

const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

/* --------------------------------- theme ---------------------------------- */
function applyTheme() {
  const t = S.settings.theme || 'auto';
  if (t === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.setAttribute('data-theme', t);
  const m = document.querySelector('meta[name=theme-color]');
  if (m) {
    const dark = t === 'dark' || (t === 'auto' && matchMedia('(prefers-color-scheme: dark)').matches);
    m.setAttribute('content', dark ? '#000000' : '#F5F5F7');
  }
}

/* --------------------------------- toast --------------------------------- */
let toastTimer;
function toast(msg) {
  const old = $('.toast'); if (old) old.remove();
  const el = document.createElement('div');
  el.className = 'toast'; el.textContent = msg;
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.setAttribute('aria-atomic', 'true');
  document.body.appendChild(el);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.remove(), 2600);
}
setToast(toast);

/* --------------------------------- sheet --------------------------------- */
let sheetSubmit = null;
let lastFocus = null;
function openSheet(title, bodyHTML, submitLabel, onSubmit) {
  closeSheet();
  lastFocus = document.activeElement;
  const back = document.createElement('div');
  back.className = 'sheet-back';
  back.innerHTML = `<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
      <h3 id="sheetTitle">${esc(title)}</h3>
      <form id="sheetForm">${bodyHTML}
        <div class="actions">
          <button type="submit" class="btn">${esc(submitLabel || 'حفظ')}</button>
          <button type="button" class="btn ghost" data-close>إلغاء</button>
        </div>
      </form></div>`;
  document.body.appendChild(back);
  back.addEventListener('click', e => { if (e.target === back || e.target.hasAttribute('data-close')) closeSheet(); });
  /* keep keyboard focus inside the dialog (HIG: predictable navigation) */
  back.addEventListener('keydown', e => {
    if (e.key !== 'Tab') return;
    const f = [...back.querySelectorAll(
      'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
    )].filter(el => el.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
  sheetSubmit = onSubmit;
  back.querySelector('#sheetForm').addEventListener('submit', e => {
    e.preventDefault();
    if (!sheetSubmit) return;
    const r = sheetSubmit(Object.fromEntries(new FormData(e.target).entries()));
    if (r !== false) { save(); closeSheet(); render(); }
  });
  const first = back.querySelector('input,select,textarea');
  if (first) setTimeout(() => first.focus(), 60);
}
function closeSheet() {
  const b = $('.sheet-back'); if (b) b.remove();
  sheetSubmit = null;
  if (lastFocus && typeof lastFocus.focus === 'function' && document.contains(lastFocus)) {
    try { lastFocus.focus(); } catch (e) {}
  }
  lastFocus = null;
}
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSheet(); });

function confirmDialog(msg, onYes, label) {
  openSheet('تأكيد', `<p style="font-size:15.5px;line-height:1.7">${esc(msg)}</p>`, label || 'تأكيد',
    () => { onYes(); return true; });
}

/* -------------------------------- helpers -------------------------------- */
const fld = (label, inner) => `<div><label>${esc(label)}</label>${inner}</div>`;
const input = (name, attrs) => `<input name="${name}" ${attrs || ''}>`;
const select = (name, options, attrs) =>
  `<select name="${name}" ${attrs || ''}>${options.map(o => {
    const v = typeof o === 'string' ? o : o.v, l = typeof o === 'string' ? o : o.l;
    const sel = typeof o === 'object' && o.sel ? ' selected' : '';
    return `<option value="${esc(v)}"${sel}>${esc(l)}</option>`;
  }).join('')}</select>`;
const statusBadge = (s) => {
  const map = { 'مؤكد': 'ok', 'محجوز': 'info', 'مكتمل': 'mute', 'استفسار': 'warn', 'ملغي': 'danger' };
  return `<span class="badge ${map[s] || 'mute'}">${esc(s)}</span>`;
};
const payBadge = (b) => {
  const t = halalas(b.rental_amount) - halalas(b.discount);
  const p = bookingPaid(b.id);
  if (b.status === 'ملغي') return '<span class="badge mute">ملغي</span>';
  if (p <= 0) return '<span class="badge danger">غير مدفوعة</span>';
  if (p >= t) return '<span class="badge ok">مدفوعة بالكامل</span>';
  return '<span class="badge warn">مدفوعة جزئياً</span>';
};

/* ------------------------------- rendering -------------------------------- */
function render() {
  applyTheme();
  const item = NAV.find(n => n.id === route) || NAV[0];
  document.title = item.ar + ' — ' + (S.settings.resthouse_name || 'استراحة أبو سلطان');
  const h2 = $('.topbar h2'); if (h2) h2.textContent = item.ar;
  $$('.nav-list button, .tabbar button').forEach(b => {
    if (b.dataset.route === route) b.setAttribute('aria-current', 'page');
    else b.removeAttribute('aria-current');
  });
  const host = $('#content');
  if (!host) return;
  const fn = (window.MODULES || {})[route];
  host.innerHTML = fn ? fn() : '<div class="empty">قيد الإنشاء</div>';
  if (typeof (window.AFTER || {})[route] === 'function') (window.AFTER)[route]();
}
function go(r) {
  route = r; uiState = {};
  window.scrollTo({ top: 0 });
  render();
}

/* --------------------------------- boot ----------------------------------- */
function boot() {
  load();
  const sidebar = $('.nav-list');
  sidebar.innerHTML = NAV.filter(n => n.desktop && !MOBILE_ONLY.includes(n.id)).map(n =>
    `<li><button data-route="${n.id}">${iconTile(n.ico)}<span>${esc(n.ar)}</span></button></li>`).join('');
  $('.tabbar').innerHTML = NAV.filter(n => n.mobile).map(n =>
    `<button data-route="${n.id}">${iconTile(n.ico)}<span>${esc(n.ar)}</span></button>`).join('');
  $$('[data-route]').forEach(b => b.addEventListener('click', () => go(b.dataset.route)));
  $('#brandName').textContent = S.settings.resthouse_name || 'استراحة أبو سلطان';
  render();
  if (!document.body.dataset.listeners) {
    document.body.dataset.listeners = '1';
    onChange(render);
  }
}
document.addEventListener('DOMContentLoaded', boot);
