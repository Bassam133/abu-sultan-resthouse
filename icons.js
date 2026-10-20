/* ==========================================================================
   Apple-style line icons (SF Symbols inspired) — 24×24, stroke, currentColor
   ========================================================================== */
const ICONS = {
  dashboard: '<path d="M4 19V9M9.3 19V5M14.7 19v-7M20 19V8"/>',
  bookings: '<path d="M4 11.4 12 4l8 7.4"/><path d="M6.2 10.6V20h11.6v-9.4"/><path d="M10 20v-4.8h4V20"/>',
  income: '<rect x="3" y="6" width="18" height="12" rx="3"/><circle cx="12" cy="12" r="2.6"/><path d="M6.6 9.2v.01M17.4 14.8v.01"/>',
  expenses: '<path d="M6 3.5h8.5L19 8v12.5H6z"/><path d="M9 9.5h5.5M9 13h6.5M9 16.5h4"/>',
  members: '<circle cx="9.2" cy="8.8" r="3"/><path d="M3.6 19.4c0-3 2.5-5.2 5.6-5.2s5.6 2.2 5.6 5.2"/><circle cx="17.2" cy="9.8" r="2.3"/><path d="M15.8 14.3c2.2.3 3.8 1.8 3.8 4.2"/>',
  payroll: '<circle cx="12" cy="8" r="3.1"/><path d="M5.6 20c0-3.6 2.9-6 6.4-6s6.4 2.4 6.4 6"/><path d="M12 14.4V20"/>',
  maintenance: '<path d="M14.6 6.4a4.2 4.2 0 0 0 5.3 5.3L10.2 21.4a3 3 0 0 1-4.2-4.2z"/><path d="M17.6 3.4 20.2 6"/>',
  reports: '<path d="M4 16.6 9 11.4l3.8 3.2L20 7"/><path d="M4 20.4h16"/><path d="M16.6 7H20v3.4"/>',
  audit: '<circle cx="12" cy="12" r="7.8"/><path d="M12 7.8V12l3 1.9"/>',
  settings: '<circle cx="12" cy="12" r="3.1"/><path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9"/>',
  more: '<circle cx="6" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="18" cy="12" r="1.5"/>',
  download: '<path d="M12 4.2v9.6"/><path d="M8.4 10.4 12 14l3.6-3.6"/><path d="M5 17.6h14"/>',
  upload: '<path d="M12 14V4.4"/><path d="M8.4 8 12 4.4 15.6 8"/><path d="M5 17.6h14"/>',
  print: '<path d="M7 9.4V4.6h10v4.8"/><rect x="4.6" y="9.4" width="14.8" height="6.8" rx="2"/><path d="M7 14.4h10v5H7z"/>',
  plus: '<path d="M12 5.6v12.8M5.6 12h12.8"/>',
  minus: '<path d="M5.6 12h12.8"/>',
  trash: '<path d="M5 7h14"/><path d="M9.6 7V4.8h4.8V7"/><path d="M6.9 7l.8 12.2h8.6L17.1 7"/>',
  check: '<path d="M5.2 12.6 9.6 17 18.8 7.4"/>',
};

function svgIcon(name, size) {
  const p = ICONS[name] || ICONS.more;
  return `<svg viewBox="0 0 24 24" width="${size || 18}" height="${size || 18}" fill="none"
    stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"
    aria-hidden="true" focusable="false">${p}</svg>`;
}
/* glass tile wrapper — the translucent "liquid glass" chip behind each icon */
function iconTile(name, cls) {
  return `<span class="glass-ico ${cls || ''}">${svgIcon(name)}</span>`;
}
/* small inline icon for buttons/labels (replaces emoji) */
function uiIcon(name) {
  return `<span class="btn-ico" aria-hidden="true">${svgIcon(name, 16)}</span>`;
}
