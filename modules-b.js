/* ==========================================================================
   Modules B — Members · Payroll · Maintenance · Reports · Audit · Settings
   ========================================================================== */
window.MODULES = window.MODULES || {};
window.AFTER = window.AFTER || {};
const M2 = window.MODULES;

/* ================================= MEMBERS ================================ */
M2.members = function () {
  const sh = sharesConfigured();
  const cards = S.members.map(mem => {
    const net = memberNet(mem.id);
    const contrib = memberContributions(mem.id);
    const onBehalf = memberOwedForExpenses(mem.id);
    const wd = nonVoid(S.withdrawals).filter(x => x.member_id === mem.id)
      .reduce((s, x) => s + halalas(x.amount), 0);
    const pct = (S.ownership_shares.find(x => x.member_id === mem.id && !x.voided) || {}).percentage;
    return `
    <div class="card" style="margin-top:14px">
      <div class="section-head" style="margin:0 0 10px">
        <h3 style="margin:0">${esc(mem.name)}
          <span class="badge ${mem.role === 'admin' ? 'info' : 'mute'}">${mem.role === 'admin' ? 'مدير' : 'عضو'}</span>
          ${pct != null ? `<span class="badge mute">${pct}%</span>` : '<span class="badge warn">نسبة غير محددة</span>'}
        </h3>
        <span style="font-weight:700;color:${net >= 0 ? 'var(--success)' : 'var(--danger)'}">
          ${net >= 0 ? 'له' : 'عليه'} ${fmtSAR(Math.abs(net))}</span>
      </div>
      <div class="grid g4" style="margin-bottom:12px">
        ${stat('المساهمات', fmtSAR(contrib), 'إيداعات العضو', 'pos')}
        ${stat('دفع بالنيابة', fmtSAR(onBehalf), 'مستحق له', 'info')}
        ${stat('السحوبات', fmtSAR(wd), 'مسحوبات وردّيات', 'warn')}
        ${stat('صافي الرصيد', fmtSAR(Math.abs(net)), net >= 0 ? 'دائن (له)' : 'مدين (عليه)', net >= 0 ? 'pos' : 'neg')}
      </div>
      <div class="btn-row" style="margin-top:0">
        <button class="btn sm" onclick="addContribution('${mem.id}')">＋ مساهمة</button>
        <button class="btn sm sec" onclick="addWithdrawal('${mem.id}')">− سحب / ردّ مبلغ</button>
        <button class="btn sm ghost" onclick="memberStatement('${mem.id}')">كشف حساب</button>
      </div>
    </div>`;
  }).join('');

  return `
  ${!sh.valid ? `<div class="banner" style="margin-bottom:16px">
    <b>نسب الملكية غير مكتملة.</b> لا يمكن اعتماد توزيع أرباح قبل تحديد نسب لجميع الأعضاء بمجموع 100%.
    <div style="margin-top:8px"><button class="btn sm sec" onclick="editShares()">تحديد النسب</button></div></div>`
   : `<div class="banner ok" style="margin-bottom:16px">نسب الملكية معتمدة — المجموع ${sh.total}%.</div>`}
  ${cards}
  <div class="section-head"><h3>سجل قيود الأعضاء</h3></div>
  ${nonVoid(S.ledger).length ? `<div class="table-wrap"><table>
    <thead><tr><th>التاريخ</th><th>العضو</th><th>النوع</th><th class="num">المبلغ</th><th>ملاحظة</th></tr></thead>
    <tbody>${nonVoid(S.ledger).map(l => `<tr><td>${fmtDate(l.date)}</td>
      <td>${esc((S.members.find(m => m.id === l.member_id) || {}).name || '')}</td>
      <td>${l.kind === 'credit' ? 'دائن (له)' : 'مدين (عليه)'}</td>
      <td class="num">${fmtSAR(halalas(l.amount))}</td><td>${esc(l.note || '')}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">لا قيود تسوية.</div>'}`;
};
function addContribution(mid) {
  const mem = S.members.find(x => x.id === mid);
  openSheet(`مساهمة — ${mem.name}`,
    `<div class="grid g2">
      ${fld('المبلغ (ر.س) *', input('amount', 'type="number" min="0.01" step="0.01" required'))}
      ${fld('التاريخ', input('date', `type="date" value="${todayRiyadh()}"`))}
      ${fld('طريقة الدفع', select('method', S.settings.payment_methods))}
      ${fld('إلى حساب', select('account', [{ v: 'cash', l: 'الصندوق' }, { v: 'bank', l: 'البنك' }]))}
     </div>`, 'تسجيل المساهمة', (d) => {
      const amt = halalas(d.amount); if (amt <= 0) { toast('⛔ مبلغ غير صالح'); return false; }
      const id = uid('CT');
      S.contributions.push({ id, date: d.date, member_id: mid, amount: sar(amt),
        method: d.method, account_kind: d.account, voided: false });
      postTransaction({ date: d.date, amount: amt, direction: 'in', account_kind: d.account,
        source_type: 'contribution', source_id: id, note: mem.name });
      audit('إضافة', 'contributions', id, `مساهمة ${mem.name} ${fmtSAR(amt)}`);
      toast('✅ سُجّلت المساهمة (ليست إيرادًا تشغيليًا)');
    });
}
function addWithdrawal(mid) {
  const mem = S.members.find(x => x.id === mid);
  openSheet(`سحب / ردّ مبلغ — ${mem.name}`,
    `<div class="grid g2">
      ${fld('النوع', select('kind', [{ v: 'withdrawal', l: 'سحب عضو' }, { v: 'reimbursement', l: 'ردّ مصروف دفع بالنيابة' }]))}
      ${fld('المبلغ (ر.س) *', input('amount', 'type="number" min="0.01" step="0.01" required'))}
      ${fld('التاريخ', input('date', `type="date" value="${todayRiyadh()}"`))}
      ${fld('من حساب', select('account', [{ v: 'cash', l: 'الصندوق' }, { v: 'bank', l: 'البنك' }]))}
     </div>`, 'تسجيل', (d) => {
      const amt = halalas(d.amount); if (amt <= 0) { toast('⛔ مبلغ غير صالح'); return false; }
      const id = uid('WD');
      S.withdrawals.push({ id, date: d.date, member_id: mid, kind: d.kind,
        amount: sar(amt), account_kind: d.account, voided: false });
      postTransaction({ date: d.date, amount: amt, direction: 'out', account_kind: d.account,
        source_type: 'withdrawal', source_id: id, note: mem.name });
      audit('إضافة', 'withdrawals', id, `${d.kind === 'reimbursement' ? 'ردّ مبلغ' : 'سحب'} ${mem.name} ${fmtSAR(amt)}`);
      toast('✅ تم التسجيل');
    });
}
function memberStatement(mid) {
  const mem = S.members.find(x => x.id === mid);
  const rows = [
    ...nonVoid(S.contributions).filter(x => x.member_id === mid)
      .map(x => [x.date, 'مساهمة مالية', halalas(x.amount), 0]),
    ...nonVoid(S.expenses).filter(x => x.payer_member_id === mid && x.funding_source === 'دفع عضو بالنيابة عن الاستراحة')
      .map(x => [x.date, `دفع بالنيابة — ${x.category}`, halalas(x.amount), 0]),
    ...nonVoid(S.withdrawals).filter(x => x.member_id === mid)
      .map(x => [x.date, x.kind === 'reimbursement' ? 'ردّ مبلغ' : 'سحب', 0, halalas(x.amount)]),
    ...nonVoid(S.ledger).filter(x => x.member_id === mid)
      .map(x => [x.date, x.kind === 'credit' ? 'تسوية دائنة' : 'تسوية مدينة',
        x.kind === 'credit' ? halalas(x.amount) : 0, x.kind === 'debit' ? halalas(x.amount) : 0]),
  ].sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  const net = memberNet(mid);
  openSheet(`كشف حساب — ${mem.name}`,
    `<div class="banner ${net >= 0 ? 'ok' : 'danger'}" style="margin-bottom:12px">
      الرصيد النهائي: <b>${net >= 0 ? 'له' : 'عليه'} ${fmtSAR(Math.abs(net))}</b></div>
     <div class="table-wrap"><table>
      <thead><tr><th>التاريخ</th><th>البيان</th><th class="num">له</th><th class="num">عليه</th></tr></thead>
      <tbody>${rows.length ? rows.map(r => `<tr><td>${fmtDate(r[0])}</td><td>${esc(r[1])}</td>
        <td class="num">${r[2] ? fmtSAR(r[2]) : '—'}</td>
        <td class="num">${r[3] ? fmtSAR(r[3]) : '—'}</td></tr>`).join('')
        : '<tr><td colspan="4" class="empty">لا حركات</td></tr>'}</tbody></table></div>`,
    'طباعة', () => { setTimeout(() => window.print(), 120); return true; });
}

/* ================================= PAYROLL ================================ */
M2.payroll = function () {
  const rows = nonVoid(S.payroll).map(p => `<tr>
    <td>${esc(p.employee_name)}</td><td>${esc(p.month)}</td>
    <td class="num">${fmtSAR(halalas(p.basic))}</td>
    <td class="num">${fmtSAR(halalas(p.advances))}</td>
    <td class="num">${fmtSAR(halalas(p.deductions))}</td>
    <td class="num">${fmtSAR(halalas(p.bonuses))}</td>
    <td class="num" style="font-weight:700">${fmtSAR(halalas(p.net))}</td>
    <td>${p.status === 'مدفوع' ? '<span class="badge ok">مدفوع</span>' : '<span class="badge warn">مستحق</span>'}</td>
    <td>${p.status !== 'مدفوع' ? `<button class="btn sm" onclick="paySalary('${p.id}')">صرف</button>` : ''}</td>
  </tr>`).join('');
  const due = nonVoid(S.payroll).filter(p => p.status !== 'مدفوع')
    .reduce((s, p) => s + halalas(p.net), 0);

  return `
  <div class="grid g4">
    ${stat('العمال المسجّلون', fmtNum(S.employees.length), 'قائمة العاملين', 'info')}
    ${stat('رواتب مستحقة', fmtSAR(due), 'غير مصروفة', due > 0 ? 'warn' : 'pos')}
    ${stat('رواتب مصروفة (الكل)', fmtSAR(nonVoid(S.payroll).filter(p => p.status === 'مدفوع')
      .reduce((s, p) => s + halalas(p.net), 0)), 'إجمالي', 'info')}
    ${stat('عدد كشوف الرواتب', fmtNum(S.payroll.length), 'سجلات', 'info')}
  </div>
  <div class="btn-row" style="margin-top:16px">
    <button class="btn" onclick="newEmployee()">＋ عامل جديد</button>
    <button class="btn sec" onclick="newPayroll()">＋ كشف راتب</button>
  </div>
  <div class="section-head"><h3>العاملون</h3></div>
  ${S.employees.length ? `<div class="table-wrap"><table>
    <thead><tr><th>الاسم</th><th>الجوال</th><th>المهمة</th><th class="num">الراتب الشهري</th></tr></thead>
    <tbody>${S.employees.map(e => `<tr><td>${esc(e.name)}</td><td dir="ltr">${esc(e.phone || '—')}</td>
      <td>${esc(e.job || '—')}</td><td class="num">${fmtSAR(halalas(e.salary))}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">لا عمال مسجّلين.</div>'}
  <div class="section-head"><h3>سجل الرواتب</h3></div>
  ${S.payroll.length ? `<div class="table-wrap"><table>
    <thead><tr><th>العامل</th><th>الشهر</th><th class="num">الأساسي</th><th class="num">سلف</th>
      <th class="num">خصومات</th><th class="num">إضافات</th><th class="num">الصافي</th><th>الحالة</th><th></th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : '<div class="empty">لا كشوف رواتب.</div>'}`;
};
function newEmployee() {
  openSheet('عامل جديد',
    `<div class="grid g2">
      ${fld('الاسم *', input('name', 'required'))}
      ${fld('الجوال', input('phone', 'dir="ltr"'))}
      ${fld('المهمة', input('job', 'placeholder="عامل / منظّف / حارس"'))}
      ${fld('الراتب الشهري (ر.س) *', input('salary', 'type="number" min="0" step="0.01" required'))}
     </div>`, 'حفظ', (d) => {
      S.employees.push({ id: uid('EMP'), ...d, salary: num(d.salary) });
      audit('إضافة', 'employees', null, `عامل جديد ${d.name}`);
      toast('✅ تم الحفظ');
    });
}
function newPayroll() {
  if (!S.employees.length) { toast('⛔ أضف عاملًا أولاً'); return; }
  const opts = S.employees.map(e => ({ v: e.id, l: `${e.name} (${e.salary} ر.س)` }));
  openSheet('كشف راتب',
    `<div class="grid g2">
      ${fld('العامل *', select('employee_id', opts))}
      ${fld('الشهر *', input('month', `type="month" value="${todayRiyadh().slice(0, 7)}" required`))}
      ${fld('الراتب الأساسي (ر.س)', input('basic', 'type="number" min="0" step="0.01"'))}
      ${fld('سلف / دفعات مقدمة', input('advances', 'type="number" min="0" step="0.01" value="0"'))}
      ${fld('خصومات', input('deductions', 'type="number" min="0" step="0.01" value="0"'))}
      ${fld('إضافات / مكافآت', input('bonuses', 'type="number" min="0" step="0.01" value="0"'))}
      ${fld('طريقة الدفع', select('method', S.settings.payment_methods))}
      ${fld('الحالة', select('status', ['مستحق', 'مدفوع']))}
     </div>`, 'حفظ الكشف', (d) => {
      const emp = S.employees.find(e => e.id === d.employee_id);
      const basic = d.basic ? halalas(d.basic) : halalas(emp.salary);
      const net = basic - halalas(d.advances) - halalas(d.deductions) + halalas(d.bonuses);
      const id = uid('PR');
      S.payroll.push({ id, employee_id: emp.id, employee_name: emp.name, month: d.month,
        basic: sar(basic), advances: num(d.advances), deductions: num(d.deductions),
        bonuses: num(d.bonuses), net: sar(net), status: d.status, method: d.method, voided: false });
      audit('إضافة', 'payroll', id, `كشف راتب ${emp.name} ${d.month} صافي ${fmtSAR(net)}`);
      toast('✅ تم حفظ الكشف');
    });
}
function paySalary(id) {
  const p = S.payroll.find(x => x.id === id); if (!p) return;
  confirmDialog(`صرف راتب ${p.employee_name} بمبلغ ${fmtSAR(halalas(p.net))}؟`, () => {
    p.status = 'مدفوع';
    postTransaction({ date: todayRiyadh(), amount: halalas(p.net), direction: 'out',
      account_kind: p.method === 'تحويل بنكي' ? 'bank' : 'cash',
      source_type: 'payroll', source_id: p.id, note: p.employee_name });
    audit('اعتماد', 'payroll', p.id, `صرف راتب ${p.employee_name} ${fmtSAR(halalas(p.net))}`);
    toast('✅ تم الصرف');
  }, 'صرف');
}

/* =============================== MAINTENANCE ============================== */
M2.maintenance = function () {
  const today = todayRiyadh();
  const rows = nonVoid(S.maintenance).map(x => {
    const late = x.next_date && x.next_date <= today;
    return `<tr><td>${esc(x.item)}</td><td>${esc(x.kind)}</td>
      <td>${fmtDate(x.date)}</td><td class="num">${fmtSAR(halalas(x.cost))}</td>
      <td>${esc(x.vendor || '—')}</td>
      <td>${x.next_date ? fmtDate(x.next_date) : '—'} ${late ? '<span class="badge danger">مستحقة</span>' : ''}</td>
      <td>${esc(x.note || '')}</td></tr>`;
  }).join('');
  const due = nonVoid(S.maintenance).filter(x => x.next_date && x.next_date <= today).length;

  return `
  <div class="grid g4">
    ${stat('الأصول المسجّلة', fmtNum(S.assets.length), 'أجهزة ومعدات', 'info')}
    ${stat('قيمة الأصول', fmtSAR(S.assets.reduce((s, a) => s + halalas(a.cost), 0)), 'تكلفة الشراء', 'info')}
    ${stat('سجلات الصيانة', fmtNum(S.maintenance.length), 'كل الفترات', 'info')}
    ${stat('صيانة مستحقة', fmtNum(due), 'تحتاج مراجعة', due ? 'warn' : 'pos')}
  </div>
  <div class="btn-row" style="margin-top:16px">
    <button class="btn" onclick="newAsset()">＋ أصل جديد</button>
    <button class="btn sec" onclick="newMaintenance()">＋ سجل صيانة</button>
  </div>
  <div class="section-head"><h3>الأصول والأجهزة</h3></div>
  ${S.assets.length ? `<div class="table-wrap"><table>
    <thead><tr><th>الأصل</th><th>التصنيف</th><th>تاريخ الشراء</th><th class="num">التكلفة</th><th>الضمان حتى</th></tr></thead>
    <tbody>${S.assets.map(a => `<tr><td>${esc(a.name)}</td><td>${esc(a.type || '—')}</td>
      <td>${fmtDate(a.purchase_date)}</td><td class="num">${fmtSAR(halalas(a.cost))}</td>
      <td>${a.warranty_until ? fmtDate(a.warranty_until) : '—'}</td></tr>`).join('')}
    </tbody></table></div>` : '<div class="empty">لا أصول مسجّلة.</div>'}
  <div class="section-head"><h3>سجل الصيانة والأعطال</h3></div>
  ${S.maintenance.length ? `<div class="table-wrap"><table>
    <thead><tr><th>العنصر</th><th>النوع</th><th>التاريخ</th><th class="num">التكلفة</th>
      <th>المورد</th><th>الصيانة القادمة</th><th>ملاحظة</th></tr></thead>
    <tbody>${rows}</tbody></table></div>` : '<div class="empty">لا سجلات صيانة.</div>'}`;
};
function newAsset() {
  openSheet('أصل جديد',
    `<div class="grid g2">
      ${fld('اسم الأصل *', input('name', 'placeholder="مكيف سبليت / مضخة مسبح" required'))}
      ${fld('التصنيف', input('type', 'placeholder="تكييف / سباكة / أثاث"'))}
      ${fld('تاريخ الشراء', input('purchase_date', `type="date" value="${todayRiyadh()}"`))}
      ${fld('التكلفة (ر.س) *', input('cost', 'type="number" min="0" step="0.01" required'))}
      ${fld('الضمان حتى', input('warranty_until', 'type="date"'))}
      ${fld('المورد', input('vendor', ''))}
     </div>`, 'حفظ الأصل', (d) => {
      S.assets.push({ id: uid('AST'), ...d, cost: num(d.cost) });
      audit('إضافة', 'assets', null, `أصل جديد ${d.name}`);
      toast('✅ تم الحفظ');
    });
}
function newMaintenance() {
  const items = S.assets.map(a => ({ v: a.name, l: a.name }));
  openSheet('سجل صيانة',
    `<div class="grid g2">
      ${fld('العنصر *', items.length ? select('item', items) : input('item', 'required'))}
      ${fld('النوع *', select('kind', ['صيانة دورية', 'إصلاح عطل', 'استبدال', 'فحص']))}
      ${fld('التاريخ *', input('date', `type="date" value="${todayRiyadh()}" required`))}
      ${fld('التكلفة (ر.س)', input('cost', 'type="number" min="0" step="0.01" value="0"'))}
      ${fld('المورد المسؤول', input('vendor', ''))}
      ${fld('موعد الصيانة القادمة', input('next_date', 'type="date"'))}
     </div>
     <div style="margin-top:12px">${fld('وصف العطل / الأعمال', `<textarea name="note" rows="2"></textarea>`)}</div>`,
    'حفظ السجل', (d) => {
      const id = uid('MNT');
      S.maintenance.push({ id, ...d, cost: num(d.cost), voided: false });
      audit('إضافة', 'maintenance', id, `صيانة ${d.item} — ${d.kind}`);
      toast('✅ تم الحفظ');
    });
}

/* ================================= REPORTS ================================ */
M2.reports = function () {
  const from = uiState.from || (todayRiyadh().slice(0, 7) + '-01');
  const to = uiState.to || todayRiyadh();
  const rev = rentalRevenueCollected(from, to);
  const exp = operatingExpenses(from, to);
  const cap = capitalPurchases(from, to);
  const profit = rev - exp;
  const contributions = nonVoid(S.contributions)
    .filter(c => c.date >= from && c.date <= to).reduce((s, c) => s + halalas(c.amount), 0);
  const inflows = nonVoid(S.transactions).filter(t => t.date >= from && t.date <= to && t.direction === 'in')
    .reduce((s, t) => s + halalas(t.amount), 0);
  const outflows = nonVoid(S.transactions).filter(t => t.date >= from && t.date <= to && t.direction === 'out')
    .reduce((s, t) => s + halalas(t.amount), 0);

  const memberRows = S.members.map(mem => `<tr><td>${esc(mem.name)}</td>
    <td class="num">${fmtSAR(memberContributions(mem.id, from, to))}</td>
    <td class="num">${fmtSAR(memberOwedForExpenses(mem.id))}</td>
    <td class="num" style="font-weight:700">${fmtSAR(Math.abs(memberNet(mem.id)))} ${memberNet(mem.id) >= 0 ? 'له' : 'عليه'}</td>
   </tr>`).join('');

  const debtRows = activeBookings().filter(b => bookingRemaining(b) > 0)
    .sort((a, b) => bookingRemaining(b) - bookingRemaining(a)).map(b => `<tr>
      <td>${esc(b.tenant_name)}</td><td>${esc(b.id)}</td><td>${fmtDate(b.start_date)}</td>
      <td class="num" style="color:var(--danger)">${fmtSAR(bookingRemaining(b))}</td></tr>`).join('');

  const catRows = (() => {
    const by = {};
    nonVoid(S.expenses).filter(e => e.date >= from && e.date <= to).forEach(e => {
      by[e.category] = (by[e.category] || 0) + halalas(e.amount);
    });
    return Object.entries(by).sort((a, b) => b[1] - a[1]).map(([c, v]) =>
      `<tr><td>${esc(c)}</td><td class="num">${fmtSAR(v)}</td></tr>`).join('');
  })();

  return `
  <div class="card">
    <div class="grid g3">
      ${fld('من تاريخ', input('from', `type="date" value="${from}" onchange="uiState.from=this.value;render()"`))}
      ${fld('إلى تاريخ', input('to', `type="date" value="${to}" onchange="uiState.to=this.value;render()"`))}
      <div><label>&nbsp;</label><div class="btn-row" style="margin:0">
        <button class="btn sec" onclick="window.print()">🖨 طباعة / PDF</button>
        <button class="btn sec" onclick="exportReportCSV()">⬇ CSV</button></div></div>
    </div>
  </div>

  <div class="grid g4" style="margin-top:16px">
    ${stat('إيراد الإيجار المحصّل', fmtSAR(rev), 'بعد الاسترجاعات والخصومات', 'pos')}
    ${stat('المصاريف التشغيلية', fmtSAR(exp), 'معتمدة', 'warn')}
    ${stat('صافي التشغيل', fmtSAR(profit), profit >= 0 ? 'ربح' : 'خسارة', profit >= 0 ? 'pos' : 'neg')}
    ${stat('الرصيد النقدي والبنكي', fmtSAR(cashBalance()), 'لحظة العرض', 'info')}
    ${stat('مشتريات رأسمالية', fmtSAR(cap), 'منفصلة عن التشغيل', 'info')}
    ${stat('مساهمات الأعضاء بالفترة', fmtSAR(contributions), 'ليست إيراد إيجار', 'info')}
    ${stat('التدفق الداخل', fmtSAR(inflows), 'كل المصادر', 'pos')}
    ${stat('التدفق الخارج', fmtSAR(outflows), 'كل المدفوعات', 'warn')}
  </div>

  <div class="section-head"><h3>الإيراد مقابل المصروف</h3></div>
  <div class="card">
    <div class="bar" style="margin-bottom:8px"><i style="width:${rev + exp ? Math.round(rev / (rev + exp) * 100) : 0}%;background:var(--success)"></i></div>
    <p class="hint">إيراد ${fmtSAR(rev)} · مصروف ${fmtSAR(exp)} — نسبة التغطية
      ${exp ? Math.round(rev / exp * 100) + '%' : '—'}</p>
  </div>

  <div class="section-head"><h3>حسابات الأعضاء</h3></div>
  <div class="table-wrap"><table>
    <thead><tr><th>العضو</th><th class="num">مساهمات الفترة</th><th class="num">دفع بالنيابة</th><th class="num">الرصيد</th></tr></thead>
    <tbody>${memberRows}</tbody></table></div>

  <div class="section-head"><h3>مستحقات المستأجرين</h3></div>
  ${debtRows ? `<div class="table-wrap"><table>
    <thead><tr><th>المستأجر</th><th>الحجز</th><th>الدخول</th><th class="num">المتبقي</th></tr></thead>
    <tbody>${debtRows}</tbody></table></div>` : '<div class="empty">لا مستحقات — كل الحجوزات محصّلة.</div>'}

  <div class="section-head"><h3>المصاريف حسب التصنيف</h3></div>
  ${catRows ? `<div class="table-wrap"><table>
    <thead><tr><th>التصنيف</th><th class="num">الإجمالي</th></tr></thead><tbody>${catRows}</tbody></table></div>`
    : '<div class="empty">لا مصاريف في هذه الفترة.</div>'}

  <div class="banner" style="margin-top:16px">
    <b>ملاحظة محاسبية:</b> الأرباح لا تساوي الرصيد النقدي — قد تكون هناك مستحقات للمستأجرين أو التزامات للموردين.
    الرصيد النقدي محسوب من الحركات الفعلية على الصندوق والبنك.
  </div>`;
};
function exportReportCSV() {
  const from = uiState.from || (todayRiyadh().slice(0, 7) + '-01'), to = uiState.to || todayRiyadh();
  downloadCSV(`report-${from}_${to}.csv`, [
    ['إيراد الإيجار المحصّل', sar(rentalRevenueCollected(from, to))],
    ['المصاريف التشغيلية', sar(operatingExpenses(from, to))],
    ['صافي التشغيل', sar(rentalRevenueCollected(from, to) - operatingExpenses(from, to))],
    ['مشتريات رأسمالية', sar(capitalPurchases(from, to))],
    ['الرصيد النقدي والبنكي', sar(cashBalance())],
    ['مستحق من المستأجرين', sar(tenantOutstanding())],
  ], ['البند', 'المبلغ (ر.س)']);
  toast('⬇ تم تصدير التقرير');
}

/* ================================== AUDIT ================================= */
M2.audit = function () {
  if (!S.audit_logs.length) return '<div class="empty">لا تعديلات مسجّلة بعد.</div>';
  return `<p class="hint" style="margin-bottom:12px">كل إضافة وتعديل واعتماد وإلغاء يُسجَّل مع القيمة السابقة والجديدة.</p>
  <div class="table-wrap"><table>
    <thead><tr><th>الوقت</th><th>الإجراء</th><th>الكيان</th><th>الملخص</th><th>المنفّذ</th></tr></thead>
    <tbody>${S.audit_logs.slice(0, 300).map(l => `<tr>
      <td dir="ltr">${new Date(l.at).toLocaleString('en-GB', { timeZone: 'Asia/Riyadh' })}</td>
      <td><span class="badge ${l.action === 'إلغاء' ? 'danger' : l.action === 'إضافة' ? 'ok' : 'info'}">${esc(l.action)}</span></td>
      <td>${esc(l.entity)}</td><td>${esc(l.summary)}</td><td>${esc(l.actor)}</td>
    </tr>`).join('')}</tbody></table></div>`;
};

/* ================================ SETTINGS ================================ */
M2.settings = function () {
  const sh = sharesConfigured();
  return `
  <div class="card">
    <h3>بيانات الاستراحة</h3>
    <div class="grid g2">
      ${fld('الاسم بالعربية', input('rn', `value="${esc(S.settings.resthouse_name)}" onchange="setSetting('resthouse_name',this.value)"`))}
      ${fld('الاسم بالإنجليزية', input('rn_en', `value="${esc(S.settings.resthouse_name_en)}" dir="ltr" onchange="setSetting('resthouse_name_en',this.value)"`))}
    </div>
    <p class="hint" style="margin-top:10px">العملة: ريال سعودي (ر.س) · المنطقة الزمنية: ${esc(S.settings.timezone)} · صيغة التاريخ: DD/MM/YYYY · وحدة الحجز: يوم كامل</p>
  </div>

  <div class="card">
    <h3>المظهر</h3>
    <div class="seg">
      ${[['auto', 'تلقائي'], ['light', 'فاتح'], ['dark', 'داكن']].map(([v, l]) =>
        `<button aria-pressed="${S.settings.theme === v}" onclick="setSetting('theme','${v}');applyTheme()">${l}</button>`).join('')}
    </div>
    <p class="hint" style="margin-top:10px">يتبع إعداد النظام عند اختيار «تلقائي».</p>
  </div>

  <div class="card">
    <h3>الأعضاء ونسب الملكية</h3>
    <div class="table-wrap"><table>
      <thead><tr><th>العضو</th><th>الدور</th><th class="num">النسبة</th></tr></thead>
      <tbody>${S.members.map(m => {
        const p = (S.ownership_shares.find(x => x.member_id === m.id && !x.voided) || {}).percentage;
        return `<tr><td>${esc(m.name)}</td><td>${m.role === 'admin' ? 'مدير' : 'عضو'}</td>
        <td class="num">${p != null ? p + '%' : '<span class="badge warn">غير محددة</span>'}</td></tr>`;
      }).join('')}</tbody></table></div>
    ${sh.valid ? `<p class="hint" style="margin-top:10px">المجموع ${sh.total}% ✅</p>`
      : `<p class="hint" style="margin-top:10px">المجموع الحالي ${sh.total}% — يجب أن يكون 100% قبل أي توزيع أرباح.</p>`}
    <div class="btn-row">
      <button class="btn sec" onclick="editShares()">تعديل النسب</button>
      <button class="btn ghost" onclick="renameMember()">تعديل أسماء الأعضاء</button>
    </div>
  </div>

  <div class="card">
    <h3>النسخ الاحتياطي والبيانات</h3>
    <div class="btn-row" style="margin-top:0">
      <button class="btn" onclick="exportBackup()">⬇ تصدير نسخة احتياطية</button>
      <button class="btn sec" onclick="$('#fImport').click()">⬆ استعادة نسخة</button>
      <button class="btn sec" onclick="exportAllCSV()">⬇ تصدير CSV</button>
      ${S.settings.seeded_demo ? `<button class="btn danger" onclick="clearDemo()">حذف البيانات التجريبية</button>` : ''}
      <button class="btn danger" onclick="resetAll()">تفريغ كل البيانات</button>
    </div>
    <input type="file" id="fImport" accept=".json" style="display:none" onchange="doImport(this)">
    <p class="hint" style="margin-top:10px">البيانات محفوظة على هذا الجهاز فقط. لا توجد مزامنة بين الأجهزة حتى يتم ربط قاعدة بيانات مشتركة.</p>
  </div>

  <div class="card">
    <h3>الإعدادات التشغيلية</h3>
    <p class="hint">تصنيفات المصاريف (${S.settings.expense_categories.length}) · حالات الحجز (${S.settings.booking_statuses.length}) ·
      طرق الدفع (${S.settings.payment_methods.length}) · مصادر التمويل (${S.settings.funding_sources.length})</p>
    <div class="btn-row"><button class="btn ghost" onclick="toast('التصنيفات قابلة للتعديل في نسخة الخادم')">تعديل التصنيفات</button></div>
  </div>`;
};
function setSetting(k, v) { S.settings[k] = v; save(); audit('تعديل', 'settings', null, `${k} → ${v}`); toast('✅ حُفظ'); }
function editShares() {
  openSheet('نسب الملكية',
    S.members.map(m => fld(m.name + ' (%)', input('sh_' + m.id, `type="number" min="0" max="100" step="0.01"
      value="${(S.ownership_shares.find(x => x.member_id === m.id && !x.voided) || {}).percentage ?? ''}"`))).join('')
    + '<div class="banner" style="margin-top:12px">يجب أن يكون المجموع 100% بالضبط. لا يُفترض التوزيع المتساوي تلقائيًا.</div>',
    'حفظ النسب', (d) => {
      const total = S.members.reduce((s, m) => s + num(d['sh_' + m.id]), 0);
      if (Math.abs(total - 100) > 0.001) { toast(`⛔ المجموع ${total}% — يجب أن يكون 100%`); return false; }
      S.members.forEach(m => {
        const arr = S.ownership_shares;
        arr.filter(x => x.member_id === m.id && !x.voided).forEach(x => { x.voided = true; });
        arr.push({ id: uid('OS'), member_id: m.id, percentage: num(d['sh_' + m.id]),
          effective_from: todayRiyadh(), voided: false });
      });
      audit('اعتماد', 'ownership_shares', null, `تحديد نسب الملكية — المجموع ${total}%`);
      toast('✅ اعتُمدت النسب');
    });
}
function renameMember() {
  openSheet('تعديل أسماء الأعضاء',
    S.members.map(m => fld(m.name, input('nm_' + m.id, `value="${esc(m.name)}"`))).join(''),
    'حفظ', (d) => {
      S.members.forEach(m => { const v = String(d['nm_' + m.id] || '').trim(); if (v) m.name = v; });
      audit('تعديل', 'members', null, 'تعديل أسماء الأعضاء');
      toast('✅ تم التعديل');
    });
}
function doImport(el) {
  const f = el.files[0]; if (!f) return;
  const r = new FileReader();
  r.onload = () => {
    try { importBackup(r.result); audit('استعادة', 'database', null, 'استعادة نسخة احتياطية');
      toast('✅ تمت الاستعادة'); render(); }
    catch (e) { toast('⛔ ملف غير صالح'); }
  };
  r.readAsText(f);
}
function exportAllCSV() { exportBookingsCSV(); setTimeout(exportExpensesCSV, 400); setTimeout(exportIncomeCSV, 800); }
function resetAll() {
  confirmDialog('تفريغ كل البيانات نهائيًا؟ لا يمكن التراجع. صدّر نسخة احتياطية أولاً.', () => {
    localStorage.removeItem(DB_KEY); load(); save(); render(); toast('تم تفريغ البيانات');
  }, 'تفريغ نهائي');
}
function clearDemo() {
  confirmDialog('حذف البيانات التجريبية فقط؟', () => {
    S.bookings = []; S.payments = []; S.refunds = []; S.expenses = []; S.contributions = [];
    S.withdrawals = []; S.ledger = []; S.payroll = []; S.employees = []; S.assets = [];
    S.maintenance = []; S.transactions = []; S.settings.seeded_demo = false;
    save(); toast('تم حذف البيانات التجريبية');
  }, 'حذف');
}

/* ================================== MORE ================================== */
M2.more = function () {
  const items = NAV.filter(n => !n.mobile && n.id !== 'more');
  return `<div class="card"><h3>أقسام أخرى</h3>
    <div class="btn-row" style="margin:0;flex-direction:column;align-items:stretch">
      ${items.map(n => `<button class="btn sec" style="justify-content:flex-start"
        onclick="go('${n.id}')"><span style="font-size:17px">${n.ico}</span> ${esc(n.ar)}</button>`).join('')}
    </div></div>`;
};

/* ============================== DEMO DATA ================================= */
function seedDemo() {
  const d = (n) => { const x = new Date(Date.now() + 3 * 3600 * 1000); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  S.bookings = [
    { id: uid('BK'), tenant_name: 'محمد العتيبي', tenant_phone: '0551112233', start_date: d(-6), end_date: d(-3),
      rental_amount: 1800, security_deposit: 300, discount: 0, status: 'مكتمل', payment_method: 'تحويل بنكي', source: 'واتساب' },
    { id: uid('BK'), tenant_name: 'خالد الشمري', tenant_phone: '0567778899', start_date: d(-2), end_date: d(1),
      rental_amount: 2200, security_deposit: 300, discount: 100, status: 'مؤكد', payment_method: 'نقدي', source: 'اتصال' },
    { id: uid('BK'), tenant_name: 'سعد الحربي', tenant_phone: '0503334455', start_date: d(4), end_date: d(6),
      rental_amount: 1900, security_deposit: 0, discount: 0, status: 'محجوز', payment_method: 'تحويل بنكي', source: 'إحالة' },
  ].map(b => ({ ...b, voided: false, created_at: new Date().toISOString() }));

  const p1 = uid('PM'), p2 = uid('PM');
  S.payments = [
    { id: p1, date: d(-6), booking_id: S.bookings[0].id, kind: 'rent', amount: 1800, method: 'تحويل بنكي', voided: false },
    { id: p2, date: d(-2), booking_id: S.bookings[1].id, kind: 'rent', amount: 1100, method: 'نقدي', voided: false },
  ];
  S.transactions = [
    { id: uid('TRX'), date: d(-6), amount: 180000, direction: 'in', account_kind: 'bank', source_type: 'payment', source_id: p1, voided: false },
    { id: uid('TRX'), date: d(-2), amount: 110000, direction: 'in', account_kind: 'cash', source_type: 'payment', source_id: p2, voided: false },
  ];
  const e1 = uid('EX'), e2 = uid('EX'), e3 = uid('EX');
  S.expenses = [
    { id: e1, date: d(-5), amount: 420, category: 'الكهرباء', vendor: 'شركة الكهرباء', payer: 'أبو سلطان',
      method: 'تحويل بنكي', funding_source: 'إيرادات الاستراحة', kind: 'operating', pay_status: 'مدفوع', voided: false },
    { id: e2, date: d(-4), amount: 350, category: 'النظافة', vendor: 'مؤسسة النقاء', payer: 'أبو علي',
      method: 'نقدي', funding_source: 'دفع عضو بالنيابة عن الاستراحة', payer_member_id: 'MEM002',
      kind: 'operating', pay_status: 'مدفوع', voided: false },
    { id: e3, date: d(-3), amount: 1500, category: 'المكيفات', vendor: 'مؤسسة التبريد', payer: 'أبو حمود',
      method: 'نقدي', funding_source: 'دفع عضو بالنيابة عن الاستراحة', payer_member_id: 'MEM003',
      kind: 'capital', pay_status: 'مدفوع', voided: false },
  ];
  S.transactions.push({ id: uid('TRX'), date: d(-5), amount: 42000, direction: 'out', account_kind: 'bank',
    source_type: 'expense', source_id: e1, voided: false });
  const c1 = uid('CT');
  S.contributions = [{ id: c1, date: d(-10), member_id: 'MEM001', amount: 3000, method: 'تحويل بنكي', account_kind: 'bank', voided: false }];
  S.transactions.push({ id: uid('TRX'), date: d(-10), amount: 300000, direction: 'in', account_kind: 'bank',
    source_type: 'contribution', source_id: c1, voided: false });
  S.employees = [{ id: 'EMP001', name: 'عبدالله (عامل)', phone: '0570001122', job: 'عامل', salary: 1800 }];
  S.payroll = [{ id: uid('PR'), employee_id: 'EMP001', employee_name: 'عبدالله (عامل)',
    month: todayRiyadh().slice(0, 7), basic: 1800, advances: 200, deductions: 0, bonuses: 0,
    net: 1600, status: 'مستحق', method: 'نقدي', voided: false }];
  S.assets = [{ id: uid('AST'), name: 'مكيف سبليت 24', type: 'تكييف', purchase_date: d(-3), cost: 1500, vendor: 'مؤسسة التبريد' }];
  S.maintenance = [{ id: uid('MNT'), item: 'مكيف سبليت 24', kind: 'إصلاح عطل', date: d(-3), cost: 1500,
    vendor: 'مؤسسة التبريد', next_date: d(60), note: 'تغيير كمبروسر', voided: false }];
  S.settings.seeded_demo = true;
  audit('إضافة', 'database', null, 'إنشاء بيانات تجريبية (منفصلة عن البيانات الحقيقية)');
  save();
  toast('✅ أُنشئت بيانات تجريبية — يمكن حذفها من الإعدادات');
}
window.seedDemo = seedDemo;
