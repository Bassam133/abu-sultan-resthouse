/* ==========================================================================
   Personal-use mode — no rentals at all.
   Removes booking/income routes and rebuilds dashboard + reports around
   expenses, member contributions and cash only.
   ========================================================================== */
window.MODULES = window.MODULES || {};

(function () {
  ['bookings', 'income'].forEach(id => {
    for (let i = NAV.length - 1; i >= 0; i--) if (NAV[i].id === id) NAV.splice(i, 1);
  });
  if (route === 'bookings' || route === 'income') route = 'dashboard';
  if (typeof S !== 'undefined' && S && S.settings) S.settings.mode = 'personal';
})();

/* ------------------------------- DASHBOARD -------------------------------- */
MODULES.dashboard = function () {
  const m = todayRiyadh().slice(0, 7);
  const exp = operatingExpenses(m + '-01', m + '-31');
  const cap = capitalPurchases(m + '-01', m + '-31');
  const cash = accountBalance('cash'), bank = accountBalance('bank');
  const contrib = nonVoid(S.contributions).reduce((s, c) => s + halalas(c.amount), 0);
  const owed = S.members.reduce((s, mm) => s + memberOwedForExpenses(mm.id), 0);
  const unpaid = nonVoid(S.expenses).filter(e => e.pay_status !== 'مدفوع')
    .reduce((s, e) => s + halalas(e.amount), 0);
  const salaryDue = nonVoid(S.payroll).filter(p => p.status !== 'مدفوع')
    .reduce((s, p) => s + halalas(p.net), 0);
  const today = todayRiyadh();

  const months = lastMonths(6);
  const bars = months.map(k => ({ k, exp: operatingExpenses(k + '-01', k + '-31') / 100 }));
  const maxBar = Math.max(1, ...bars.map(b => b.exp));

  const alerts = [];
  nonVoid(S.maintenance).forEach(x => {
    if (x.next_date && x.next_date <= today) alerts.push(`صيانة مستحقة: ${x.item} — ${fmtDate(x.next_date)}`);
  });
  nonVoid(S.payroll).filter(p => p.status !== 'مدفوع').forEach(p =>
    alerts.push(`راتب مستحق ${fmtSAR(halalas(p.net))} — ${p.employee_name}`));
  nonVoid(S.expenses).filter(e => e.pay_status !== 'مدفوع').forEach(e =>
    alerts.push(`مصروف غير مسدد: ${e.category} ${fmtSAR(halalas(e.amount))}`));

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
    ${stat('مصاريف الشهر', fmtSAR(exp), monthLabel(m), 'warn')}
    ${stat('الرصيد النقدي', fmtSAR(cash), 'الصندوق', 'info')}
    ${stat('الرصيد البنكي', fmtSAR(bank), 'الحساب البنكي', 'info')}
    ${stat('إجمالي الأرصدة', fmtSAR(cash + bank), 'نقد + بنك', 'pos')}
    ${stat('مساهمات الأعضاء', fmtSAR(contrib), 'ليست إيرادات', 'info')}
    ${stat('مستحق للأعضاء', fmtSAR(owed), 'دفعوا بالنيابة', owed > 0 ? 'warn' : 'pos')}
    ${stat('التزامات غير مسددة', fmtSAR(unpaid + salaryDue), 'مصاريف + رواتب', (unpaid + salaryDue) > 0 ? 'warn' : 'pos')}
    ${stat('مشتريات رأسمالية', fmtSAR(cap), 'هذا الشهر', 'info')}
  </div>

  <div class="card" style="margin-top:16px">
    <div class="section-head" style="margin:0 0 12px">
      <h3 style="margin:0">المصاريف — آخر 6 أشهر</h3>
    </div>
    <div class="spark">${bars.map(b => `
      <div class="col">
        <i class="out" style="height:${Math.round(b.exp / maxBar * 100)}%" title="${fmtSAR(b.exp * 100)}"></i>
        <div class="lb">${monthLabel(b.k).split(' ')[0]}</div>
      </div>`).join('')}
    </div>
    <p class="hint" style="margin-top:10px">الاستراحة للاستخدام الشخصي — المؤشرات كلها على المصروفات والمساهمات.</p>
  </div>

  <div class="section-head"><h3>ملخص حسابات الأعضاء</h3>
    <button class="btn sm sec" onclick="go('members')">التفاصيل</button></div>
  <div class="table-wrap"><table>
    <thead><tr><th>العضو</th><th class="num">المساهمات</th><th class="num">دفع بالنيابة</th><th class="num">الرصيد</th></tr></thead>
    <tbody>${memberRows}</tbody></table></div>

  <div class="section-head"><h3>التنبيهات</h3></div>
  ${alerts.length
    ? alerts.slice(0, 8).map(a => `<div class="banner" style="margin-bottom:8px">${esc(a)}</div>`).join('')
    : '<div class="banner ok">لا توجد تنبيهات — كل شيء منتظم.</div>'}

  ${S.settings.seeded_demo ? '' : `<div class="section-head"><h3>بيانات تجريبية</h3></div>
    <div class="banner">النظام فارغ. لو تبي تجرّبه قبل إدخال بياناتك الحقيقية، أنشئ بيانات تجريبية — ويمكن حذفها بالكامل.</div>
    <div class="btn-row"><button class="btn sec" onclick="seedDemo()">إنشاء بيانات تجريبية</button></div>`}
  `;
};

/* --------------------------------- REPORTS -------------------------------- */
MODULES.reports = function () {
  const from = uiState.from || (todayRiyadh().slice(0, 7) + '-01');
  const to = uiState.to || todayRiyadh();
  const exp = operatingExpenses(from, to);
  const cap = capitalPurchases(from, to);
  const contrib = nonVoid(S.contributions)
    .filter(c => c.date >= from && c.date <= to).reduce((s, c) => s + halalas(c.amount), 0);
  const inflows = nonVoid(S.transactions).filter(t => t.date >= from && t.date <= to && t.direction === 'in')
    .reduce((s, t) => s + halalas(t.amount), 0);
  const outflows = nonVoid(S.transactions).filter(t => t.date >= from && t.date <= to && t.direction === 'out')
    .reduce((s, t) => s + halalas(t.amount), 0);
  const salaries = nonVoid(S.payroll).filter(p => p.month >= from.slice(0, 7) && p.month <= to.slice(0, 7))
    .reduce((s, p) => s + halalas(p.net), 0);
  const maint = nonVoid(S.maintenance).filter(x => x.date >= from && x.date <= to)
    .reduce((s, x) => s + halalas(x.cost), 0);

  const memberRows = S.members.map(mem => `<tr><td>${esc(mem.name)}</td>
    <td class="num">${fmtSAR(memberContributions(mem.id, from, to))}</td>
    <td class="num">${fmtSAR(memberOwedForExpenses(mem.id))}</td>
    <td class="num" style="font-weight:700">${fmtSAR(Math.abs(memberNet(mem.id)))} ${memberNet(mem.id) >= 0 ? 'له' : 'عليه'}</td>
   </tr>`).join('');

  const by = {};
  nonVoid(S.expenses).filter(e => e.date >= from && e.date <= to).forEach(e => {
    by[e.category] = (by[e.category] || 0) + halalas(e.amount);
  });
  const catRows = Object.entries(by).sort((a, b) => b[1] - a[1])
    .map(([c, v]) => `<tr><td>${esc(c)}</td><td class="num">${fmtSAR(v)}</td></tr>`).join('');

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
    ${stat('المصاريف التشغيلية', fmtSAR(exp), 'معتمدة', 'warn')}
    ${stat('المشتريات الرأسمالية', fmtSAR(cap), 'منفصلة', 'info')}
    ${stat('الرواتب', fmtSAR(salaries), 'بالفترة', 'info')}
    ${stat('الصيانة', fmtSAR(maint), 'بالفترة', 'info')}
    ${stat('مساهمات الأعضاء', fmtSAR(contrib), 'ليست إيرادًا', 'info')}
    ${stat('الرصيد النقدي والبنكي', fmtSAR(cashBalance()), 'لحظة العرض', 'pos')}
    ${stat('التدفق الداخل', fmtSAR(inflows), 'مساهمات وإيداعات', 'pos')}
    ${stat('التدفق الخارج', fmtSAR(outflows), 'مدفوعات', 'warn')}
  </div>

  <div class="section-head"><h3>حسابات الأعضاء</h3></div>
  <div class="table-wrap"><table>
    <thead><tr><th>العضو</th><th class="num">مساهمات الفترة</th><th class="num">دفع بالنيابة</th><th class="num">الرصيد</th></tr></thead>
    <tbody>${memberRows}</tbody></table></div>

  <div class="section-head"><h3>المصاريف حسب التصنيف</h3></div>
  ${catRows ? `<div class="table-wrap"><table>
    <thead><tr><th>التصنيف</th><th class="num">الإجمالي</th></tr></thead><tbody>${catRows}</tbody></table></div>`
    : '<div class="empty">لا مصاريف في هذه الفترة.</div>'}

  <div class="banner" style="margin-top:16px">
    <b>ملاحظة:</b> الاستراحة للاستخدام الشخصي — لا تُحتسب أي إيرادات إيجار.
    الأرصدة محسوبة من الحركات الفعلية على الصندوق والبنك.
  </div>`;
};

window.exportReportCSV = function () {
  const from = uiState.from || (todayRiyadh().slice(0, 7) + '-01'), to = uiState.to || todayRiyadh();
  downloadCSV(`report-${from}_${to}.csv`, [
    ['المصاريف التشغيلية', sar(operatingExpenses(from, to))],
    ['المشتريات الرأسمالية', sar(capitalPurchases(from, to))],
    ['مساهمات الأعضاء', sar(nonVoid(S.contributions).filter(c => c.date >= from && c.date <= to)
      .reduce((s, c) => s + halalas(c.amount), 0))],
    ['الرصيد النقدي والبنكي', sar(cashBalance())],
    ['مستحق للأعضاء', sar(S.members.reduce((s, m) => s + memberOwedForExpenses(m.id), 0))],
  ], ['البند', 'المبلغ (ر.س)']);
  toast('⬇ تم تصدير التقرير');
};

/* ------------------------------- DEMO DATA -------------------------------- */
window.seedDemo = function () {
  const d = (n) => { const x = new Date(Date.now() + 3 * 3600 * 1000); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
  S.bookings = []; S.payments = []; S.refunds = [];
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
  S.transactions = [{ id: uid('TRX'), date: d(-5), amount: 420, direction: 'out', account_kind: 'bank',
    source_type: 'expense', source_id: e1, voided: false }];
  const c1 = uid('CT');
  S.contributions = [{ id: c1, date: d(-10), member_id: 'MEM001', amount: 3000, method: 'تحويل بنكي', account_kind: 'bank', voided: false }];
  S.transactions.push({ id: uid('TRX'), date: d(-10), amount: 3000, direction: 'in', account_kind: 'bank',
    source_type: 'contribution', source_id: c1, voided: false });
  S.employees = [{ id: 'EMP001', name: 'عبدالله (عامل)', phone: '0570001122', job: 'عامل', salary: 1800 }];
  S.payroll = [{ id: uid('PR'), employee_id: 'EMP001', employee_name: 'عبدالله (عامل)',
    month: todayRiyadh().slice(0, 7), basic: 1800, advances: 200, deductions: 0, bonuses: 0,
    net: 1600, status: 'مستحق', method: 'نقدي', voided: false }];
  S.assets = [{ id: uid('AST'), name: 'مكيف سبليت 24', type: 'تكييف', purchase_date: d(-3), cost: 1500, vendor: 'مؤسسة التبريد' }];
  S.maintenance = [{ id: uid('MNT'), item: 'مكيف سبليت 24', kind: 'إصلاح عطل', date: d(-3), cost: 1500,
    vendor: 'مؤسسة التبريد', next_date: d(60), note: 'تغيير كمبروسر', voided: false }];
  S.settings.seeded_demo = true;
  audit('إضافة', 'database', null, 'إنشاء بيانات تجريبية (استخدام شخصي)');
  save();
  toast('✅ أُنشئت بيانات تجريبية — يمكن حذفها من الإعدادات');
};

window.clearDemo = function () {
  confirmDialog('حذف البيانات التجريبية فقط؟', () => {
    S.bookings = []; S.payments = []; S.refunds = []; S.expenses = []; S.contributions = [];
    S.withdrawals = []; S.ledger = []; S.payroll = []; S.employees = []; S.assets = [];
    S.maintenance = []; S.transactions = []; S.settings.seeded_demo = false;
    save(); toast('تم حذف البيانات التجريبية');
  }, 'حذف');
};
