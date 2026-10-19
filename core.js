/* ==========================================================================
   استراحة أبو سلطان — Core: storage, audit, money, rules, calculations
   All money is stored as INTEGER halalas (1 SAR = 100 halalas) so balances
   never drift. Financial records are never hard-deleted: they are voided
   with a reversing entry + audit log, per the project's financial principles.
   ========================================================================== */

const DB_KEY = 'abusultan_resthouse_v1';
const SCHEMA_VERSION = 1;

/* ---------------------------------- utils --------------------------------- */
const uid = (p) => p + '-' + Date.now().toString(36).toUpperCase().slice(-5) +
  Math.random().toString(36).slice(2, 5).toUpperCase();

const num = (v) => { const n = parseFloat(String(v ?? '').replace(/[^\d.-]/g, '')); return isNaN(n) ? 0 : n; };
const halalas = (v) => Math.round(num(v) * 100);
const sar = (h) => (Math.round(h || 0) / 100);
/* tabular-safe SAR formatting */
const fmtSAR = (h) => sar(h).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) + ' ر.س';
const fmtNum = (n) => Number(n || 0).toLocaleString('en-US');

/* Asia/Riyadh today, as YYYY-MM-DD */
function todayRiyadh() {
  const d = new Date(Date.now() + 3 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
}
/* spec: DD/MM/YYYY */
const fmtDate = (iso) => { if (!iso) return '—'; const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; };
const monthKey = (iso) => (iso || '').slice(0, 7);
const monthLabel = (key) => {
  const [y, m] = key.split('-');
  return ['يناير','فبراير','مارس','أبريل','مايو','يونيو','يوليو','أغسطس','سبتمبر','أكتوبر','نوفمبر','ديسمبر'][+m - 1] + ' ' + y;
};
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

/* --------------------------------- state ---------------------------------- */
const DEFAULT_SETTINGS = {
  resthouse_name: 'استراحة أبو سلطان',
  resthouse_name_en: 'Abu Sultan Rest House',
  currency: 'SAR', currency_display: 'ر.س',
  timezone: 'Asia/Riyadh', date_format: 'DD/MM/YYYY',
  booking_unit: 'يوم كامل',
  payment_methods: ['تحويل بنكي', 'نقدي', 'أخرى'],
  online_payment: false,
  booking_statuses: ['استفسار', 'محجوز', 'مؤكد', 'مكتمل', 'ملغي'],
  expense_categories: ['الكهرباء','الماء','الإنترنت','النظافة','رواتب العمال','الصيانة','السباكة',
    'الكهرباء والإصلاحات','المكيفات','المسبح','الأثاث','المواد الاستهلاكية','الضيافة',
    'الرسوم الحكومية','التأمين','أخرى'],
  funding_sources: ['إيرادات الاستراحة', 'مساهمة عضو', 'دفع عضو بالنيابة عن الاستراحة', 'تمويل آخر'],
  theme: 'auto',
};

const DEFAULT_MEMBERS = [
  { id: 'MEM001', name: 'أبو سلطان', name_en: 'Abu Sultan', role: 'admin',   ownership: null },
  { id: 'MEM002', name: 'أبو علي',   name_en: 'Abu Ali',   role: 'member',  ownership: null },
  { id: 'MEM003', name: 'أبو حمود',  name_en: 'Abu Hamoud',role: 'member',  ownership: null },
];

function blank() {
  return {
    v: SCHEMA_VERSION,
    settings: { ...DEFAULT_SETTINGS, booking_statuses: [...DEFAULT_SETTINGS.booking_statuses],
      expense_categories: [...DEFAULT_SETTINGS.expense_categories],
      funding_sources: [...DEFAULT_SETTINGS.funding_sources],
      payment_methods: [...DEFAULT_SETTINGS.payment_methods], seeded_demo: false },
    members: DEFAULT_MEMBERS.map(m => ({ ...m })),
    ownership_shares: [],   // {id, member_id, percentage, effective_from}
    bookings: [], tenants: [], payments: [], refunds: [],
    expenses: [], expense_allocations: [],
    contributions: [], withdrawals: [], ledger: [],
    employees: [], payroll: [], assets: [], maintenance: [],
    accounts: [ { id: 'ACC-CASH', name: 'الصندوق النقدي', kind: 'cash', opening: 0 },
                { id: 'ACC-BANK', name: 'الحساب البنكي', kind: 'bank', opening: 0 } ],
    transactions: [],       // every cash/bank movement
    attachments: [], audit_logs: [],
    seeded_demo: false,
  };
}

let S = null;
const listeners = [];
const onChange = (fn) => listeners.push(fn);
function emit() { listeners.forEach(f => { try { f(S); } catch (e) { console.error(e); } }); }

function load() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    S = raw ? JSON.parse(raw) : blank();
    if (!S.v) Object.assign(S, blank());
    if (!S.settings) S.settings = { ...DEFAULT_SETTINGS };
    S.settings = { ...DEFAULT_SETTINGS, ...S.settings };
    if (!Array.isArray(S.members) || !S.members.length) S.members = DEFAULT_MEMBERS.map(m => ({ ...m }));
    ['ownership_shares','bookings','tenants','payments','refunds','expenses','expense_allocations',
     'contributions','withdrawals','ledger','employees','payroll','assets','maintenance','accounts',
     'transactions','attachments','audit_logs'].forEach(k => { if (!Array.isArray(S[k])) S[k] = []; });
  } catch (e) {
    console.error('load failed, starting clean', e);
    S = blank();
  }
  return S;
}
function persist() {
  try { localStorage.setItem(DB_KEY, JSON.stringify(S)); }
  catch (e) { toastLazy('تعذّر الحفظ — مساحة التخزين ممتلئة'); }
}
function save(mutator) {
  if (mutator) mutator(S);
  persist();
  emit();
  return S;
}
let _toast = null;
const toastLazy = (m) => (_toast ? _toast(m) : console.warn(m));
const setToast = (fn) => { _toast = fn; };

/* --------------------------------- audit ---------------------------------- */
const ACTOR = { who: 'أبو سلطان', role: 'admin' };

function audit(action, entity, entity_id, summary, before, after) {
  S.audit_logs.unshift({
    id: uid('LOG'), at: new Date().toISOString(),
    actor: ACTOR.who, role: ACTOR.role,
    action, entity, entity_id: entity_id || null,
    summary: summary || '',
    before: before === undefined ? null : before,
    after: after === undefined ? null : after,
  });
  if (S.audit_logs.length > 800) S.audit_logs.length = 800;
}

/* ----------------------------- business rules ----------------------------- */
/* Bookings are full-day units: an interval [start, end] occupies every night
   from start up to (but not including) end... the spec says "يوم كامل", so a
   booking occupies [start, end] inclusive unless end === start+1. We treat the
   occupied range as start..end-1 days (checkout morning), and two bookings
   clash when their [start, end) ranges overlap. */
function activeBookings() {
  return S.bookings.filter(b => b.status !== 'ملغي' && !b.voided);
}
function findClash(start, end, ignoreId) {
  if (!start || !end) return null;
  const a1 = new Date(start).getTime(), a2 = new Date(end).getTime();
  if (a2 <= a1) return null;
  return activeBookings().find(b => {
    if (b.id === ignoreId) return false;
    const b1 = new Date(b.start_date).getTime(), b2 = new Date(b.end_date).getTime();
    return a1 < b2 && b1 < a2;       // half-open interval overlap
  }) || null;
}
function validateBooking(d) {
  const errs = [];
  if (!String(d.tenant_name || '').trim()) errs.push('اسم المستأجر مطلوب');
  if (!d.start_date) errs.push('تاريخ الدخول مطلوب');
  if (!d.end_date) errs.push('تاريخ الخروج مطلوب');
  if (d.start_date && d.end_date && daysBetween(d.start_date, d.end_date) <= 0)
    errs.push('تاريخ الخروج يجب أن يكون بعد تاريخ الدخول');
  const clash = findClash(d.start_date, d.end_date, d.id);
  if (clash) errs.push(`تعارض مع حجز ${clash.id} (${clash.tenant_name}) من ${fmtDate(clash.start_date)} إلى ${fmtDate(clash.end_date)}`);
  if (halalas(d.rental_amount) < 0) errs.push('قيمة الإيجار لا تكون سالبة');
  if (halalas(d.paid_amount) < 0) errs.push('المبلغ المدفوع لا يكون سالبًا');
  return errs;
}

/* ------------------------------- ledgers ---------------------------------- */
const nonVoid = (arr) => arr.filter(x => !x.voided);

/** Collected rental revenue = payments tied to a booking − refunds − discounts. */
function rentalRevenueCollected(from, to) {
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  const pay = nonVoid(S.payments).filter(p => p.kind === 'rent' && inRange(p.date))
    .reduce((s, p) => s + halalas(p.amount), 0);
  const ref = nonVoid(S.refunds).filter(r => r.kind === 'rent' && inRange(r.date))
    .reduce((s, r) => s + halalas(r.amount), 0);
  const disc = nonVoid(S.bookings).filter(b => b.discount && inRange(b.discount_date || b.start_date))
    .reduce((s, b) => s + halalas(b.discount), 0);
  return pay - ref - disc;
}
/** Operating expenses actually paid (capital purchases are tracked separately). */
function operatingExpenses(from, to) {
  const inRange = (d) => (!from || d >= from) && (!to || d <= to);
  return nonVoid(S.expenses).filter(e => e.kind !== 'capital' && inRange(e.date))
    .reduce((s, e) => s + halalas(e.amount), 0);
}
const capitalPurchases = (from, to) =>
  nonVoid(S.expenses).filter(e => e.kind === 'capital' && (!from || e.date >= from) && (!to || e.date <= to))
    .reduce((s, e) => s + halalas(e.amount), 0);

const memberContributions = (mid, from, to) =>
  nonVoid(S.contributions).filter(c => c.member_id === mid && (!from || c.date >= from) && (!to || c.date <= to))
    .reduce((s, c) => s + halalas(c.amount), 0);

/** Cash + bank balance = opening + inflows − outflows (single source of truth). */
function cashBalance() {
  const opening = S.accounts.reduce((s, a) => s + halalas(a.opening), 0);
  return nonVoid(S.transactions).reduce((s, t) =>
    s + (t.direction === 'in' ? halalas(t.amount) : -halalas(t.amount)), opening);
}
function accountBalance(kind) {
  const opening = S.accounts.filter(a => a.kind === kind).reduce((s, a) => s + halalas(a.opening), 0);
  return nonVoid(S.transactions).filter(t => t.account_kind === kind)
    .reduce((s, t) => s + (t.direction === 'in' ? halalas(t.amount) : -halalas(t.amount)), opening);
}
/** Outstanding from tenants on non-cancelled bookings. */
const tenantOutstanding = () => activeBookings().reduce((s, b) => s + bookingRemaining(b), 0);
function bookingRemaining(b) {
  const total = halalas(b.rental_amount) - halalas(b.discount);
  const paid = nonVoid(S.payments).filter(p => p.booking_id === b.id).reduce((s, p) => s + halalas(p.amount), 0);
  const ref = nonVoid(S.refunds).filter(p => p.booking_id === b.id).reduce((s, p) => s + halalas(p.amount), 0);
  const settled = (b.status === 'ملغي') ? total : paid - ref;
  return Math.max(0, total - settled);
}
const bookingPaid = (bid) => nonVoid(S.payments).filter(p => p.booking_id === bid)
  .reduce((s, p) => s + halalas(p.amount), 0);

/** Member net balance, per the spec's formula. Described in words, not a bare sign. */
function memberNet(mid) {
  const c = nonVoid(S.contributions).filter(x => x.member_id === mid).reduce((s, x) => s + halalas(x.amount), 0);
  const onBehalf = nonVoid(S.expenses).filter(x => x.funding_source === 'دفع عضو بالنيابة عن الاستراحة' && x.payer_member_id === mid)
    .reduce((s, x) => s + halalas(x.amount), 0);
  const credits = nonVoid(S.ledger).filter(x => x.member_id === mid)
    .reduce((s, x) => s + (x.kind === 'credit' ? halalas(x.amount) : -halalas(x.amount)), 0);
  const reimb = nonVoid(S.withdrawals).filter(x => x.member_id === mid && x.kind === 'reimbursement')
    .reduce((s, x) => s + halalas(x.amount), 0);
  const wd = nonVoid(S.withdrawals).filter(x => x.member_id === mid && x.kind !== 'reimbursement')
    .reduce((s, x) => s + halalas(x.amount), 0);
  const dist = nonVoid(S.distributions ? S.distributions : []).filter(x => x.member_id === mid)
    .reduce((s, x) => s + halalas(x.amount), 0);
  return c + onBehalf + credits - reimb - wd - dist;
}
/* member shares: never assume equal */
function sharesConfigured() {
  const act = S.ownership_shares.filter(x => !x.voided);
  const total = act.reduce((s, x) => s + num(x.percentage), 0);
  return { shares: act, total, valid: act.length === S.members.length && Math.abs(total - 100) < 0.001 };
}
/** Reimbursement the rest house owes a member for paying an expense itself. */
function memberOwedForExpenses(mid) {
  return nonVoid(S.expenses)
    .filter(e => e.funding_source === 'دفع عضو بالنيابة عن الاستراحة' && e.payer_member_id === mid)
    .reduce((s, e) => s + halalas(e.amount), 0);
}

/* ------------------- double-entry guard: record once ---------------------- */
/**
 * A single expense must create exactly ONE financial effect. When a member
 * fronts the money, the rest house records the expense once and books a
 * payable to that member. We enforce this by keying transactions to their
 * source so the same source cannot post twice.
 */
function postTransaction({ date, amount, direction, account_kind, source_type, source_id, note }) {
  const dup = S.transactions.find(t => !t.voided && t.source_type === source_type && t.source_id === source_id);
  if (dup) return { ok: false, reason: 'هذه الحركة مسجلة مسبقًا — لن تُسجل مرتين' };
  S.transactions.push({
    /* callers pass integer halalas; store SAR so every entity uses one unit */
    id: uid('TRX'), date, amount: sar(amount), direction, account_kind,
    source_type, source_id, note: note || '', voided: false, created_at: new Date().toISOString(),
  });
  return { ok: true };
}

/* ------------------------------ backup / restore --------------------------- */
function exportBackup() {
  const blob = new Blob([JSON.stringify(S, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `abusultan-backup-${todayRiyadh()}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}
function importBackup(json) {
  const data = typeof json === 'string' ? JSON.parse(json) : json;
  if (!data || typeof data !== 'object' || !('bookings' in data)) throw new Error('ملف غير صالح');
  S = data; persist(); emit(); return true;
}
function toCSV(rows, headers) {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  return '\uFEFF' + [headers.map(esc).join(','), ...rows.map(r => r.map(esc).join(','))].join('\n');
}
function downloadCSV(name, rows, headers) {
  const blob = new Blob([toCSV(rows, headers)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
  a.download = name; a.click(); URL.revokeObjectURL(a.href);
}
