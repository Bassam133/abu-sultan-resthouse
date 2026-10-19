/* ==========================================================================
   Modules A — Dashboard · Bookings · Income · Expenses
   ========================================================================== */
window.MODULES = window.MODULES || {};
window.AFTER = window.AFTER || {};
const M = window.MODULES;

/* =============================== DASHBOARD ================================ */
M.dashboard = function () {
  const m = todayRiyadh().slice(0, 7);
  const rev = rentalRevenueCollected(m + '-01', m + '-31');
  const exp = operatingExpenses(m + '-01', m + '-31');
  const profit = rev - exp;
  const cash = cashBalance(), bank = accountBalance('bank');
  const today = todayRiyadh();
  const active = activeBookings();
  const upcoming = active.filter(b => b.start_date >= today && b.status !== 'مكتمل')
    .sort((a, b) => a.start_date.localeCompare(b.start_date));
  const completed = active.filter(b => b.end_date < today || b.status === 'مكتمل');
  const out = tenantOutstanding();
  const suppliers = nonVoid(S.expenses).filter(e => e.pay_status !== 'مدفوع')
    .reduce((s, e) => s + halalas(e.amount), 0);

  const months = lastMonths(6);
  const bars = months.map(k => ({
    k, rev: rentalRevenueCollected(k + '-01', k + '-31') / 100,
    exp: operatingExpenses(k + '-01', k + '-31') / 100,
  }));
  const maxBar = Math.max(1, ...bars.map(b => Math.max(b.rev, b.exp)));

  const alerts = [];
  activeBookings().forEach(b => {
    const r = bookingRemaining(b);
    if (b.start_date === today) alerts.push(`دخول اليوم: ${b.tenant_name} (${b.id})`);
    if (r > 0 && b.end_date < today) alerts.push(`مبلغ غير محصّل ${fmtSAR(r)} للعميل ${b.tenant_name}`);
  });
  nonVoid(S.maintenance).forEach(x => {
    const next = x.next_date;
    if (next && next <= today) alerts.push(`صيانة مستحقة: ${x.item} — ${fmtDate(next)}`);
  });
  nonVoid(S.payroll).filter(p => p.status !== 'مدفوع').forEach(p =>
    alerts.push(`راتب مستحق ${fmtSAR(halalas(p.net))} — ${p.employee_name}`));

  const memberRows = S.members.map(mem => {
    const net = memberNet(mem.id);
    return `<tr><td>${esc(mem.name)}</td>
      <td class="num">${fmtSAR(memberContributions(mem.id))}</td>
      <td class="num">${fmtSAR(memberOwedForExpenses(mem.id))}</td>
      <td class="num" style="color:${net >= 0 ? 'var(--success)' : 'var(--danger)'}">${fmtSAR(Math.abs(net))}
      <span style="color:var(--text-2);font-weight:400">${net >= 0 ? 'له' : 'عليه'}</span></td></tr>`;
  }).join('');

  return `
  <div class="grid g4">
    ${stat('إيرادات الإيجار (محصّلة)', fmtSAR(rev), monthLabel(m), 'pos')}
    ${stat('المصاريف التشغيلية', fmtSAR(exp), monthLabel(m), 'warn')}
    ${stat('صافي التشغيل', fmtSAR(profit), profit >= 0 ? 'ربح تشغيلي' : 'خسارة تشغيلية', profit >= 0 ? 'pos' : 'neg')}
    ${stat('الرصيد النقدي والبنكي', fmtSAR(cash), `بنكي ${fmtSAR(bank)}`, 'info')}
    ${stat('مستحق من المستأجرين', fmtSAR(out), `${active.filter(b => bookingRemaining(b) > 0).length} حجز`, out > 0 ? 'warn' : 'pos')}
    ${stat('التزامات غير مسددة', fmtSAR(suppliers), 'مصاريف ورواتب', suppliers > 0 ? 'warn' : 'pos')}
    ${stat('الحجوزات القادمة', fmtNum(upcoming.length), upcoming[0] ? fmtDate(upcoming[0].start_date) : '—', 'info')}
    ${stat('الحجوزات المكتملة', fmtNum(completed.length), 'كل الفترات', 'info')}
  </div>

  <div class="card" style="margin-top:16px">
    <div class="section-head" style="margin:0 0 12px">
      <h3 style="margin:0">الإيرادات مقابل المصاريف — آخر 6 أشهر</h3>
      <span class="badge ok">إيراد</span> <span class="badge warn">مصروف</span>
    </div>
    <div class="spark">${bars.map(b => `
      <div class="col">
        <i class="in" style="height:${Math.round(b.rev / maxBar * 100)}%" title="${fmtSAR(b.rev * 100)}"></i>
        <i class="out" style="height:${Math.round(b.exp / maxBar * 100)}%" title="${fmtSAR(b.exp * 100)}"></i>
        <div class="lb">${monthLabel(b.k).split(' ')[0]}</div>
      </div>`).join('')}
    </div>
    <p class="hint" style="margin-top:10px">الأرباح لا تساوي الرصيد النقدي بالضرورة — المؤشران معروضان بشكل منفصل.</p>
  </div>

  <div class="section-head"><h3>ملخص حسابات الأعضاء</h3>
    <button class="btn sm sec" onclick="go('members')">التفاصيل</button></div>
  <div class="table-wrap"><table>
    <thead><tr><th>العضو</th><th class="num">المساهمات</th><th class="num">دفع بالنيابة</th><th class="num">الرصيد</th></tr></thead>
    <tbody>${memberRows}</tbody></table></div>

  <div class="section-head"><h3>التنبيهات</h3></div>
  ${alerts.length
    ? alerts.map(a => `<div class="banner" style="margin-bottom:8px">${esc(a)}</div>`).join('')
    : '<div class="banner ok">لا توجد تنبيهات — كل شيء منتظم.</div>'}

  ${S.settings.seeded_demo ? '' : `<div class="section-head"><h3>بيانات تجريبية</h3></div>
    <div class="banner">هذه نسخة جديدة وفارغة. لو تبي تجرّب النظام قبل إدخال بياناتك الحقيقية، أنشئ بيانات تجريبية — وتُوسم منفصلة ويمكن حذفها بالكامل.</div>
    <div class="btn-row"><button class="btn sec" onclick="seedDemo()">إنشاء بيانات تجريبية</button></div>`}
  `;
};
const stat = (k, v, sub, cls) =>
  `<div class="stat"><div class="k">${esc(k)}</div><div class="v ${cls || ''}">${v}</div>
   <div class="sub">${esc(sub || '')}</div></div>`;
function lastMonths(n) {
  const out = [], d = new Date(Date.now() + 3 * 3600 * 1000);
  d.setDate(1);
  for (let i = n - 1; i >= 0; i--) {
    const x = new Date(d); x.setMonth(d.getMonth() - i);
    out.push(x.toISOString().slice(0, 7));
  }
  return out;
}

/* ================================ BOOKINGS ================================ */
M.bookings = function () {
  const today = todayRiyadh();
  const k = uiState.bk || 'الكل';
  let list = S.bookings.slice().sort((a, b) => (b.start_date || '').localeCompare(a.start_date || ''));
  if (k !== 'الكل') list = list.filter(b => b.status === k);
  const rows = list.map(b => `
    <tr>
      <td style="font-weight:600">${esc(b.id)}</td>
      <td>${esc(b.tenant_name)}${b.tenant_phone ? `<div class="hint" dir="ltr">${esc(b.tenant_phone)}</div>` : ''}</td>
      <td>${fmtDate(b.start_date)} → ${fmtDate(b.end_date)}
        <div class="hint">${daysBetween(b.start_date, b.end_date)} يوم</div></td>
      <td class="num">${fmtSAR(halalas(b.rental_amount))}</td>
      <td class="num">${fmtSAR(bookingPaid(b.id))}</td>
      <td class="num" style="font-weight:700;color:${bookingRemaining(b) > 0 ? 'var(--danger)' : 'var(--success)'}">${fmtSAR(bookingRemaining(b))}</td>
      <td>${statusBadge(b.status)} ${payBadge(b)}</td>
      <td>
        <button class="btn sm sec" onclick="payBooking('${b.id}')">دفعة</button>
        <button class="btn sm ghost" onclick="bookingMenu('${b.id}')">⋯</button>
      </td>
    </tr>`).join('');

  const summary = S.settings.booking_statuses.map(s => {
    const n = S.bookings.filter(b => b.status === s).length;
    return `<span class="badge ${s === 'الكل' ? 'mute' : ''}">${esc(s)}: ${n}</span>`;
  }).join(' ');

  return `
  <div class="btn-row" style="margin:0 0 14px">
    <button class="btn" onclick="newBooking()">＋ حجز جديد</button>
    <button class="btn sec" onclick="window.print()">🖨 كشف الحجوزات</button>
    <button class="btn sec" onclick="exportBookingsCSV()">⬇ CSV</button>
  </div>
  <div class="seg" style="margin-bottom:14px">
    ${['الكل', ...S.settings.booking_statuses].map(s =>
      `<button aria-pressed="${k === s}" onclick="uiState.bk='${s}';render()">${esc(s)}</button>`).join('')}
  </div>
  <div class="card" style="padding:14px 16px;margin-bottom:14px;display:flex;gap:10px;flex-wrap:wrap;align-items:center">
    ${summary}
    <span style="margin-inline-start:auto;font-weight:700">مستحق من المستأجرين: ${fmtSAR(tenantOutstanding())}</span>
  </div>
  ${list.length ? `<div class="table-wrap"><table>
    <thead><tr><th>الرقم</th><th>المستأجر</th><th>الفترة</th><th class="num">الإيجار</th>
      <th class="num">المدفوع</th><th class="num">المتبقي</th><th>الحالة</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>`
    : '<div class="empty">لا توجد حجوزات بعد. ابدأ بـ «حجز جديد».</div>'}`;
};

function bookingForm(b) {
  b = b || {};
  const st = S.settings.booking_statuses;
  return `
    <div class="grid g2">
      ${fld('اسم المستأجر *', input('tenant_name', `value="${esc(b.tenant_name || '')}" placeholder="مثال: محمد العتيبي" required`))}
      ${fld('رقم الجوال', input('tenant_phone', `value="${esc(b.tenant_phone || '')}" placeholder="05xxxxxxxx" dir="ltr"`))}
      ${fld('تاريخ الدخول *', input('start_date', `type="date" value="${b.start_date || todayRiyadh()}" required`))}
      ${fld('تاريخ الخروج *', input('end_date', `type="date" value="${b.end_date || todayRiyadh()}" required`))}
      ${fld('قيمة الإيجار (ر.س) *', input('rental_amount', `type="number" min="0" step="0.01" value="${b.rental_amount ?? ''}" required`))}
      ${fld('العربون / المدفوع (ر.س)', input('paid_amount', `type="number" min="0" step="0.01" value="${b.paid_amount ?? 0}"`))}
      ${fld('تأمين مسترد (ر.س)', input('security_deposit', `type="number" min="0" step="0.01" value="${b.security_deposit ?? 0}"`))}
      ${fld('طريقة الدفع', select('payment_method', ['—', ...S.settings.payment_methods]))}
      ${fld('حالة الحجز', select('status', st, b.status ? '' : 'selected="مؤكد"'))}
      ${fld('مصدر الحجز', input('source', `value="${esc(b.source || '')}" placeholder="واتساب / اتصال / إحالة"`))}
    </div>
    <div style="margin-top:12px">${fld('ملاحظات وشروط الحجز', `<textarea name="notes" rows="3">${esc(b.notes || '')}</textarea>`)}</div>
    <p class="hint" style="margin-top:10px">التأمين المسترد يُسجَّل منفصلاً عن الإيراد ولا يُحتسب ضمن إيرادات الإيجار.</p>`;
}

function newBooking() {
  openSheet('حجز جديد', bookingForm(), 'حفظ الحجز', (d) => {
    const errs = validateBooking(d);
    if (errs.length) { toast('⛔ ' + errs[0]); return false; }
    const id = uid('BK');
    S.bookings.push({
      id, ...d, rental_amount: num(d.rental_amount), paid_amount: 0,
      security_deposit: num(d.security_deposit), discount: 0,
      created_at: new Date().toISOString(), voided: false,
    });
    const paid = halalas(d.paid_amount);
    if (paid > 0) {
      S.payments.push({ id: uid('PM'), date: todayRiyadh(), booking_id: id, kind: 'rent',
        amount: sar(paid), method: d.payment_method || 'نقدي', note: 'عربون عند الحجز', voided: false });
      postTransaction({ date: todayRiyadh(), amount: paid, direction: 'in',
        account_kind: d.payment_method === 'تحويل بنكي' ? 'bank' : 'cash',
        source_type: 'payment', source_id: id });
    }
    audit('إضافة', 'bookings', id, `حجز جديد للمستأجر ${d.tenant_name}`, null, d);
    toast('✅ تم حفظ الحجز ' + id);
  });
}

function payBooking(id) {
  const b = S.bookings.find(x => x.id === id); if (!b) return;
  const rem = bookingRemaining(b);
  openSheet(`تسجيل دفعة — ${b.tenant_name}`,
    `<div class="banner" style="margin-bottom:14px">المتبقي على هذا الحجز: <b>${fmtSAR(rem)}</b></div>
     <div class="grid g2">
       ${fld('المبلغ (ر.س) *', input('amount', `type="number" min="0.01" step="0.01" value="${sar(rem)}" required`))}
       ${fld('التاريخ', input('date', `type="date" value="${todayRiyadh()}"`))}
       ${fld('طريقة الدفع', select('method', S.settings.payment_methods))}
       ${fld('نوع الحركة', select('kind', [{ v: 'rent', l: 'دفعة إيجار' }, { v: 'deposit', l: 'تأمين مسترد' }]))}
     </div>
     <div style="margin-top:12px">${fld('ملاحظة', input('note', 'placeholder="رقم الإيصال أو ملاحظة"'))}</div>`,
    'تسجيل الدفعة', (d) => {
      const amt = halalas(d.amount);
      if (amt <= 0) { toast('⛔ المبلغ يجب أن يكون أكبر من صفر'); return false; }
      const pid = uid('PM');
      S.payments.push({ id: pid, date: d.date, booking_id: b.id, kind: d.kind,
        amount: sar(amt), method: d.method, note: d.note || '', voided: false });
      const r = postTransaction({ date: d.date, amount: amt, direction: 'in',
        account_kind: d.method === 'تحويل بنكي' ? 'bank' : 'cash',
        source_type: 'payment', source_id: pid, note: b.id });
      if (!r.ok) { S.payments = S.payments.filter(p => p.id !== pid); toast('⛔ ' + r.reason); return false; }
      audit('إضافة', 'payments', pid, `دفعة ${fmtSAR(amt)} على الحجز ${b.id}`);
      toast('✅ سُجّلت الدفعة ' + fmtSAR(amt));
    });
}

function bookingMenu(id) {
  const b = S.bookings.find(x => x.id === id); if (!b) return;
  openSheet('خيارات الحجز ' + b.id,
    `<div class="btn-row" style="margin:0;flex-direction:column;align-items:stretch">
      <button type="button" class="btn sec" onclick="refundBooking('${id}')">تسجيل استرجاع</button>
      <button type="button" class="btn sec" onclick="discountBooking('${id}')">تسجيل خصم</button>
      <button type="button" class="btn sec" onclick="editBooking('${id}')">تعديل بيانات الحجز</button>
      <button type="button" class="btn danger" onclick="cancelBooking('${id}')">إلغاء الحجز</button>
     </div>
     <p class="hint" style="margin-top:12px">الحجوزات المعتمدة لا تُحذف نهائيًا — الإلغاء يسجّل قيدًا عكسيًا في سجل التدقيق.</p>`,
    'إغلاق', () => true);
}
function refundBooking(id) {
  const b = S.bookings.find(x => x.id === id);
  closeSheet();
  openSheet(`استرجاع — ${b.tenant_name}`,
    `<div class="grid g2">
      ${fld('المبلغ (ر.س) *', input('amount', 'type="number" min="0.01" step="0.01" required'))}
      ${fld('التاريخ', input('date', `type="date" value="${todayRiyadh()}"`))}
     </div><div style="margin-top:12px">${fld('السبب', input('note', 'placeholder="سبب الاسترجاع"'))}</div>`,
    'تسجيل الاسترجاع', (d) => {
      const amt = halalas(d.amount); if (amt <= 0) { toast('⛔ مبلغ غير صالح'); return false; }
      const rid = uid('RF');
      S.refunds.push({ id: rid, date: d.date, booking_id: b.id, kind: 'rent',
        amount: sar(amt), note: d.note || '', voided: false });
      postTransaction({ date: d.date, amount: amt, direction: 'out', account_kind: 'cash',
        source_type: 'refund', source_id: rid, note: b.id });
      audit('اعتماد', 'refunds', rid, `استرجاع ${fmtSAR(amt)} للحجز ${b.id}`);
      toast('✅ سُجّل الاسترجاع');
    });
}
function discountBooking(id) {
  const b = S.bookings.find(x => x.id === id);
  closeSheet();
  openSheet(`خصم — ${b.tenant_name}`,
    fld('قيمة الخصم (ر.س) *', input('discount', `type="number" min="0.01" step="0.01" value="${b.discount || ''}" required`)),
    'تسجيل الخصم', (d) => {
      const amt = halalas(d.discount); if (amt <= 0) { toast('⛔ مبلغ غير صالح'); return false; }
      const before = b.discount;
      b.discount = sar(amt); b.discount_date = todayRiyadh();
      audit('تعديل', 'bookings', b.id, `خصم ${fmtSAR(amt)} على الحجز ${b.id}`, { discount: before }, { discount: b.discount });
      toast('✅ سُجّل الخصم');
    });
}
function editBooking(id) {
  const b = S.bookings.find(x => x.id === id);
  closeSheet();
  openSheet('تعديل الحجز ' + b.id, bookingForm(b), 'حفظ التعديلات', (d) => {
    const errs = validateBooking({ ...b, ...d });
    if (errs.length) { toast('⛔ ' + errs[0]); return false; }
    const before = { ...b };
    Object.assign(b, {
      tenant_name: d.tenant_name, tenant_phone: d.tenant_phone,
      start_date: d.start_date, end_date: d.end_date,
      rental_amount: num(d.rental_amount), security_deposit: num(d.security_deposit),
      payment_method: d.payment_method, status: d.status, source: d.source, notes: d.notes,
    });
    audit('تعديل', 'bookings', b.id, 'تعديل بيانات الحجز', before, { ...b });
    toast('✅ تم التعديل');
  });
}
function cancelBooking(id) {
  const b = S.bookings.find(x => x.id === id);
  closeSheet();
  confirmDialog(`إلغاء الحجز ${b.id} للمستأجر ${b.tenant_name}؟ سيُسجَّل قيد عكسي في سجل التدقيق ولن يُحذف السجل.`,
    () => {
      const before = b.status; b.status = 'ملغي'; b.voided_at = new Date().toISOString();
      audit('إلغاء', 'bookings', b.id, `إلغاء الحجز ${b.id}`, { status: before }, { status: 'ملغي' });
      toast('تم إلغاء الحجز');
    }, 'إلغاء الحجز');
}
function exportBookingsCSV() {
  downloadCSV('bookings.csv', S.bookings.map(b => [b.id, b.tenant_name, b.tenant_phone || '',
    b.start_date, b.end_date, sar(halalas(b.rental_amount)), sar(bookingPaid(b.id)),
    sar(bookingRemaining(b)), b.status]),
    ['الرقم', 'المستأجر', 'الجوال', 'الدخول', 'الخروج', 'الإيجار', 'المدفوع', 'المتبقي', 'الحالة']);
  toast('⬇ تم تصدير الملف');
}

/* ================================= INCOME ================================= */
M.income = function () {
  const pays = nonVoid(S.payments).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const total = pays.reduce((s, p) => s + halalas(p.amount), 0);
  const collected = rentalRevenueCollected();
  const rows = pays.map(p => {
    const b = S.bookings.find(x => x.id === p.booking_id);
    return `<tr><td>${fmtDate(p.date)}</td><td>${esc(b ? b.tenant_name : '—')}</td>
      <td>${esc(p.booking_id || '—')}</td>
      <td>${p.kind === 'rent' ? 'دفعة إيجار' : 'تأمين مسترد'}</td>
      <td>${esc(p.method || '—')}</td>
      <td class="num">${fmtSAR(halalas(p.amount))}</td></tr>`;
  }).join('');
  const refs = nonVoid(S.refunds).map(r =>
    `<tr><td>${fmtDate(r.date)}</td><td>${esc(r.booking_id || '—')}</td><td>استرجاع</td>
     <td class="num" style="color:var(--danger)">− ${fmtSAR(halalas(r.amount))}</td></tr>`).join('');

  return `
  <div class="grid g4">
    ${stat('إجمالي المقبوضات', fmtSAR(total), `${pays.length} دفعة`, 'pos')}
    ${stat('إيراد الإيجار المحصّل', fmtSAR(collected), 'بعد الاسترجاعات والخصومات', 'pos')}
    ${stat('الرصيد النقدي', fmtSAR(accountBalance('cash')), 'الصندوق', 'info')}
    ${stat('الرصيد البنكي', fmtSAR(accountBalance('bank')), 'الحساب البنكي', 'info')}
  </div>
  <div class="btn-row" style="margin-top:16px">
    <button class="btn" onclick="quickIncome()">＋ تسجيل مقبوض</button>
    <button class="btn sec" onclick="exportIncomeCSV()">⬇ CSV</button>
  </div>
  <div class="section-head"><h3>سجل المقبوضات</h3></div>
  ${pays.length ? `<div class="table-wrap"><table>
    <thead><tr><th>التاريخ</th><th>المستأجر</th><th>الحجز</th><th>النوع</th><th>الطريقة</th><th class="num">المبلغ</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : '<div class="empty">لا توجد مقبوضات بعد.</div>'}
  ${refs ? `<div class="section-head"><h3>الاسترجاعات</h3></div>
    <div class="table-wrap"><table><thead><tr><th>التاريخ</th><th>الحجز</th><th>النوع</th><th class="num">المبلغ</th></tr></thead>
    <tbody>${refs}</tbody></table></div>` : ''}
  <div class="banner" style="margin-top:16px">مساهمات الأعضاء تُسجَّل في «حسابات الأعضاء» ولا تُحتسب إيرادات إيجار تشغيلية.</div>`;
};
function quickIncome() {
  const active = activeBookings();
  openSheet('تسجيل مقبوض',
    `<div class="grid g2">
      ${fld('مرتبط بحجز', select('booking_id', active.map(b => ({ v: b.id, l: `${b.id} — ${b.tenant_name}` }))))}
      ${fld('المبلغ (ر.س) *', input('amount', 'type="number" min="0.01" step="0.01" required'))}
      ${fld('التاريخ', input('date', `type="date" value="${todayRiyadh()}"`))}
      ${fld('طريقة الدفع', select('method', S.settings.payment_methods))}
     </div>`, 'تسجيل', (d) => {
      const amt = halalas(d.amount); if (amt <= 0) { toast('⛔ مبلغ غير صالح'); return false; }
      const pid = uid('PM');
      S.payments.push({ id: pid, date: d.date, booking_id: d.booking_id, kind: 'rent',
        amount: sar(amt), method: d.method, note: '', voided: false });
      postTransaction({ date: d.date, amount: amt, direction: 'in',
        account_kind: d.method === 'تحويل بنكي' ? 'bank' : 'cash', source_type: 'payment', source_id: pid });
      audit('إضافة', 'payments', pid, `مقبوض ${fmtSAR(amt)}`);
      toast('✅ تم التسجيل');
    });
}
function exportIncomeCSV() {
  downloadCSV('income.csv', nonVoid(S.payments).map(p => [p.date, p.booking_id || '', sar(halalas(p.amount)), p.method || '']),
    ['التاريخ', 'الحجز', 'المبلغ', 'الطريقة']);
  toast('⬇ تم التصدير');
}

/* ================================ EXPENSES ================================ */
M.expenses = function () {
  const k = uiState.exk || 'الكل';
  let list = nonVoid(S.expenses).slice().sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  if (k !== 'الكل') list = list.filter(e => e.category === k);
  const m = todayRiyadh().slice(0, 7);
  const paid = list.reduce((s, e) => s + halalas(e.amount), 0);
  const byCat = {};
  nonVoid(S.expenses).forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + halalas(e.amount); });
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 5);

  const rows = list.map(e => `<tr>
      <td>${fmtDate(e.date)}</td><td>${esc(e.category)}</td>
      <td>${esc(e.vendor || '—')}</td>
      <td>${esc(e.payer || '—')}</td>
      <td>${esc(e.funding_source || '—')}</td>
      <td>${e.kind === 'capital' ? '<span class="badge info">رأسمالي</span>' : '<span class="badge mute">تشغيلي</span>'}</td>
      <td class="num">${fmtSAR(halalas(e.amount))}</td>
      <td>${e.pay_status === 'مدفوع' ? '<span class="badge ok">مدفوع</span>' : '<span class="badge warn">مستحق</span>'}</td>
    </tr>`).join('');

  return `
  <div class="grid g4">
    ${stat('مصاريف الشهر', fmtSAR(operatingExpenses(m + '-01', m + '-31')), monthLabel(m), 'warn')}
    ${stat('إجمالي المعروض', fmtSAR(paid), `${list.length} سجل`, 'warn')}
    ${stat('مشتريات رأسمالية', fmtSAR(capitalPurchases()), 'منفصلة عن التشغيل', 'info')}
    ${stat('أكبر تصنيف', top[0] ? top[0][0] : '—', top[0] ? fmtSAR(top[0][1]) : '—', 'info')}
  </div>
  <div class="btn-row" style="margin-top:16px">
    <button class="btn" onclick="newExpense()">＋ مصروف جديد</button>
    <button class="btn sec" onclick="exportExpensesCSV()">⬇ CSV</button>
    <button class="btn sec" onclick="window.print()">🖨 طباعة</button>
  </div>
  <div class="seg" style="margin:14px 0;flex-wrap:wrap">
    ${['الكل', ...S.settings.expense_categories].slice(0, 9).map(c =>
      `<button aria-pressed="${k === c}" onclick="uiState.exk='${c}';render()">${esc(c)}</button>`).join('')}
  </div>
  ${list.length ? `<div class="table-wrap"><table>
    <thead><tr><th>التاريخ</th><th>التصنيف</th><th>المستفيد</th><th>الدافع</th><th>التمويل</th>
      <th>النوع</th><th class="num">المبلغ</th><th>السداد</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : '<div class="empty">لا توجد مصاريف مسجّلة.</div>'}`;
};
function newExpense() {
  const members = S.members.map(mm => ({ v: mm.id, l: mm.name }));
  openSheet('مصروف جديد',
    `<div class="grid g2">
      ${fld('التاريخ *', input('date', `type="date" value="${todayRiyadh()}" required`))}
      ${fld('المبلغ (ر.س) *', input('amount', 'type="number" min="0.01" step="0.01" required'))}
      ${fld('التصنيف *', select('category', S.settings.expense_categories))}
      ${fld('المستفيد / المورد', input('vendor', 'placeholder="اسم المورد أو الجهة"'))}
      ${fld('الدافع', input('payer', `value="${esc(S.members[0].name)}"`))}
      ${fld('طريقة الدفع', select('method', S.settings.payment_methods))}
      ${fld('مصدر التمويل *', select('funding_source', S.settings.funding_sources))}
      ${fld('عضو مُموِّل (عند الدفع بالنيابة)', select('payer_member_id', [{ v: '', l: '—' }, ...members]))}
      ${fld('نوع المصروف', select('kind', [{ v: 'operating', l: 'تشغيلي' }, { v: 'capital', l: 'رأسمالي (أصل)' }]))}
      ${fld('حالة السداد', select('pay_status', ['مدفوع', 'مستحق']))}
      ${fld('متكرر؟', select('recurring', [{ v: 'لا', l: 'لمرة واحدة' }, { v: 'شهري', l: 'شهري' }]))}
     </div>
     <div style="margin-top:12px">${fld('ملاحظة / وصف', input('note', 'placeholder="تفاصيل المصروف"'))}</div>
     <div class="banner" style="margin-top:14px">عند «دفع عضو بالنيابة عن الاستراحة» يُسجَّل المصروف <b>مرة واحدة</b>، ويُثبَّت المبلغ مستحقًا للعضو في كشف حسابه.</div>`,
    'حفظ المصروف', (d) => {
      const amt = halalas(d.amount);
      if (amt <= 0) { toast('⛔ المبلغ غير صالح'); return false; }
      if (d.funding_source === 'دفع عضو بالنيابة عن الاستراحة' && !d.payer_member_id) {
        toast('⛔ اختر العضو الذي دفع بالنيابة'); return false;
      }
      const id = uid('EX');
      S.expenses.push({
        id, date: d.date, amount: sar(amt), category: d.category, vendor: d.vendor,
        payer: d.payer, method: d.method, funding_source: d.funding_source,
        payer_member_id: d.payer_member_id || null, kind: d.kind, pay_status: d.pay_status,
        recurring: d.recurring, note: d.note, voided: false, created_at: new Date().toISOString(),
      });
      // exactly one cash effect — keyed to the expense so it can never post twice
      if (d.pay_status === 'مدفوع' && d.funding_source !== 'دفع عضو بالنيابة عن الاستراحة') {
        postTransaction({ date: d.date, amount: amt, direction: 'out',
          account_kind: d.method === 'تحويل بنكي' ? 'bank' : 'cash',
          source_type: 'expense', source_id: id, note: d.category });
      }
      audit('إضافة', 'expenses', id, `مصروف ${d.category} ${fmtSAR(amt)}`, null, { ...d });
      toast('✅ سُجّل المصروف — مرة واحدة فقط');
    });
}
function exportExpensesCSV() {
  downloadCSV('expenses.csv', nonVoid(S.expenses).map(e => [e.date, e.category, e.vendor || '',
    e.amount, e.funding_source || '', e.kind, e.pay_status]),
    ['التاريخ', 'التصنيف', 'المستفيد', 'المبلغ', 'التمويل', 'النوع', 'السداد']);
  toast('⬇ تم التصدير');
}
