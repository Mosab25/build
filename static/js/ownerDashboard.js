const OWNER_DEAL_FILTERS = [
  ["needs_action", "تحتاج إجراء"],
  ["approved", "معتمدة"],
  ["finalized", "مكتملة"],
  ["rejected", "مرفوضة"],
  ["all", "كل الطلبات"],
];

const OWNER_OPERATION_TABS = [
  ["clients", "العملاء"],
  ["units", "الشقق"],
  ["payments", "الماليات"],
];

const OWNER_SETTINGS_TABS = [
  ["office", "بيانات المكتب"],
  ["pricing", "إعدادات الأسعار"],
  ["permissions", "إعدادات الصلاحيات"],
  ["accounts", "إدارة الحسابات"],
  ["system", "إعدادات النظام"],
  ["media", "الوسائط والتحديثات"],
];

function ownerData() {
  return APP_STATE.owner || APP_STATE.dashboard || {};
}

function OwnerStatCard(label, value, options = {}) {
  const display = options.money ? formatMoney(value) : Number(value || 0).toLocaleString("ar-EG");
  return `
    <article class="owner-stat-card ${options.tone || ""}">
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(display)}</strong>
      ${options.hint ? `<small>${escapeHTML(options.hint)}</small>` : ""}
    </article>
  `;
}

function renderOwnerDashboard() {
  const data = ownerData();
  const summary = data.summary || {};
  const alerts = data.alerts || [];
  const logs = (data.auditLogs || []).slice(0, 5);
  const performance = data.assistantPerformance || [];

  return `
    <section class="owner-hero-panel">
      <div>
        <span class="eyebrow">الرئيسية</span>
        <h2>ملخص سريع لليوم</h2>
        <p>أهم الأرقام والإجراءات أمامك مباشرة بدون الدخول في تفاصيل كثيرة.</p>
      </div>
      <button class="btn secondary small" type="button" id="ownerRefreshButton">تحديث البيانات</button>
    </section>

    <section class="owner-quick-actions" aria-label="اختصارات لوحة المالك">
      ${OwnerQuickAction("الموافقات", "راجع الديلات المنتظرة", summary.pendingDeals || 0, "approvals", "warning")}
      ${OwnerQuickAction("العملاء", "افتح ملفات العملاء والحجوزات", (data.clients || []).length, "operations", "clients")}
      ${OwnerQuickAction("الشقق", "تابع المتاح والمحجوز والمباع", summary.availableApartments || 0, "operations", "units")}
      ${OwnerQuickAction("المدفوعات", "راجع التحصيل والدفعات المعلقة", summary.pendingPayments || 0, "operations", "payments")}
    </section>

    <div class="owner-stat-grid compact">
      ${OwnerStatCard("إجمالي الشقق", summary.totalApartments)}
      ${OwnerStatCard("متاحة", summary.availableApartments, { tone: "success" })}
      ${OwnerStatCard("محجوزة", summary.reservedApartments, { tone: "warning" })}
      ${OwnerStatCard("مباعة", summary.soldApartments)}
    </div>

    <section class="data-panel owner-panel owner-money-summary">
      <div>
        <span class="eyebrow">الملخص المالي</span>
        <h3>المبيعات والتحصيل</h3>
      </div>
      <div class="owner-money-grid">
        ${OwnerMoneyItem("قيمة المبيعات", summary.totalSales)}
        ${OwnerMoneyItem("المحصل", summary.totalCollected, "success")}
        ${OwnerMoneyItem("المتبقي", summary.totalRemaining, "danger")}
        ${OwnerMoneyItem("أقساط متأخرة", summary.overdueInstallments, "warning", false)}
      </div>
    </section>

    <div class="owner-dashboard-columns">
      <section class="data-panel owner-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">متابعة فورية</span>
            <h3>تنبيهات مهمة</h3>
          </div>
        </div>
        ${renderOwnerAlerts(alerts)}
      </section>

      <section class="data-panel owner-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">سجل مختصر</span>
            <h3>آخر النشاطات</h3>
          </div>
        </div>
        ${renderOwnerActivityPreview(logs)}
      </section>
    </div>

    <section class="data-panel owner-panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">فريق المبيعات</span>
          <h3>ملخص أداء المساعدين</h3>
        </div>
      </div>
      ${renderAssistantPerformance(performance)}
    </section>
  `;
}

function OwnerQuickAction(title, text, count, view, tab = "") {
  return `
    <button class="owner-action-card ${escapeHTML(tab)}" type="button" data-owner-quick-view="${escapeHTML(view)}" data-owner-quick-tab="${escapeHTML(tab)}">
      <span>${escapeHTML(title)}</span>
      <strong>${Number(count || 0).toLocaleString("ar-EG")}</strong>
      <small>${escapeHTML(text)}</small>
    </button>
  `;
}

function OwnerMoneyItem(label, value, tone = "", money = true) {
  const display = money ? formatMoney(value) : Number(value || 0).toLocaleString("ar-EG");
  return `<article class="${escapeHTML(tone)}"><span>${escapeHTML(label)}</span><strong>${escapeHTML(display)}</strong></article>`;
}

function bindOwnerDashboard() {
  qs("#ownerRefreshButton")?.addEventListener("click", async () => {
    await loadDashboard();
    showToast("تم تحديث بيانات لوحة المالك.", "success");
  });
  qsa("[data-owner-quick-view]").forEach((button) => {
    button.addEventListener("click", () => {
      APP_STATE.activeDashboardView = button.dataset.ownerQuickView;
      if (button.dataset.ownerQuickTab && button.dataset.ownerQuickTab !== "warning") {
        APP_STATE.ownerOperationsTab = button.dataset.ownerQuickTab;
      }
      renderDashboardShell();
      renderActiveDashboardView();
    });
  });
}

function renderOwnerAlerts(alerts) {
  if (!alerts.length) return EmptyState("لا توجد تنبيهات مهمة حاليًا.", "سيتم عرض التنبيهات هنا عند وجود ديلات أو دفعات أو أقساط تحتاج متابعة.");
  return `<div class="owner-alert-list">${alerts.map((alert) => `
    <article class="owner-alert ${escapeHTML(alert.severity || "info")}">
      <strong>${Number(alert.count || 0).toLocaleString("ar-EG")}</strong>
      <span>${escapeHTML(alert.message)}</span>
    </article>
  `).join("")}</div>`;
}

function renderOwnerActivityPreview(logs) {
  if (!logs.length) return EmptyState("لا توجد نشاطات مسجلة حاليًا.", "سيظهر هنا آخر ما يتم داخل النظام.");
  return `<div class="activity-timeline compact">${logs.map((log) => `
    <article>
      <strong>${escapeHTML(log.description || log.action_type || "إجراء")}</strong>
      <span>${escapeHTML(log.admin_name || "النظام")} · ${formatDateTime(log.created_at)}</span>
    </article>
  `).join("")}</div>`;
}

function renderAssistantPerformance(items) {
  if (!items.length) return EmptyState("لا يوجد مساعدين مسجلين حاليًا.", "سيظهر ملخص الأداء بعد إضافة حسابات المساعدين وتسجيل الديلات.");
  return `
    <div class="table-wrap owner-table-wrap">
      <table>
        <thead>
          <tr><th>الاسم</th><th>عدد الديلات</th><th>المعتمد</th><th>المرفوض</th><th>بانتظار الموافقة</th><th>نسبة النجاح</th></tr>
        </thead>
        <tbody>
          ${items.map((item) => `
            <tr>
              <td>${escapeHTML(item.assistant?.fullName || "-")}</td>
              <td>${Number(item.totalDeals || 0).toLocaleString("ar-EG")}</td>
              <td>${Number(item.approvedDeals || 0).toLocaleString("ar-EG")}</td>
              <td>${Number(item.rejectedDeals || 0).toLocaleString("ar-EG")}</td>
              <td>${Number(item.pendingDeals || 0).toLocaleString("ar-EG")}</td>
              <td><strong>${formatPercent(item.successRate || 0)}</strong></td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderOwnerApprovalCenter() {
  const data = ownerData();
  const deals = filterOwnerDeals(data.deals || []);
  return `
    <section class="owner-hero-panel">
      <div>
        <span class="eyebrow">طلبات الموافقة</span>
        <h2>مركز اعتماد الديلات</h2>
        <p>راجع الديلات المرسلة من المساعدين قبل اعتماد الحجز وربط العميل بالشقة.</p>
      </div>
    </section>
    <section class="data-panel owner-panel">
      <div class="filter-bar owner-filter-bar">
        <div class="segmented-control">
          ${OWNER_DEAL_FILTERS.map(([key, label]) => `<button type="button" data-owner-deal-filter="${key}" class="${APP_STATE.ownerApprovalFilter === key ? "active" : ""}">${label}</button>`).join("")}
        </div>
        <label class="search-field">
          <span>بحث</span>
          <input id="ownerDealSearch" value="${escapeHTML(APP_STATE.ownerApprovalSearch || "")}" placeholder="اسم العميل، المساعد، رقم الشقة" />
        </label>
      </div>
      ${renderOwnerDealList(deals)}
    </section>
  `;
}

function bindOwnerApprovalCenter() {
  const content = qs("#dashboardContent");
  content.querySelectorAll("[data-owner-deal-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      APP_STATE.ownerApprovalFilter = button.dataset.ownerDealFilter;
      renderActiveDashboardView();
    });
  });
  qs("#ownerDealSearch")?.addEventListener("input", (event) => {
    APP_STATE.ownerApprovalSearch = event.target.value;
    renderActiveDashboardView();
  });
  content.onclick = handleOwnerDealClick;
}

function filterOwnerDeals(deals) {
  const filter = APP_STATE.ownerApprovalFilter || "needs_action";
  const search = (APP_STATE.ownerApprovalSearch || "").trim().toLowerCase();
  return deals.filter((deal) => {
    const statusOk = filter === "all"
      || (filter === "needs_action" && ["pending_approval", "revision_requested"].includes(deal.status))
      || deal.status === filter;
    const haystack = [
      deal.id,
      deal.clientName,
      deal.clientPhone,
      deal.assistant?.fullName,
      deal.apartment?.unitCode,
      deal.apartment?.directionAr,
    ].join(" ").toLowerCase();
    return statusOk && (!search || haystack.includes(search));
  });
}

function renderOwnerDealList(deals) {
  if (!deals.length) return EmptyState("لا توجد طلبات موافقة في الوقت الحالي.", "سيتم عرض الديلات هنا عند إرسالها من المساعدين.");
  return `<div class="owner-deal-list">${deals.map(renderOwnerDealCard).join("")}</div>`;
}

function renderOwnerDealCard(deal) {
  const apt = deal.apartment || {};
  const risks = deal.riskWarnings || [];
  return `
    <article class="owner-deal-card">
      <header>
        <div>
          <span class="deal-number">${escapeHTML(deal.id)}</span>
          <h3>${escapeHTML(deal.clientName || "عميل غير محدد")}</h3>
          <p>${escapeHTML(deal.assistant?.fullName || "بدون مساعد")} · ${escapeHTML(deal.clientPhone || "رقم غير محدد")}</p>
        </div>
        ${StatusBadge(deal.status)}
      </header>
      <div class="deal-metrics">
        ${ownerMetric("رقم الشقة", apt.unitCode || "-")}
        ${ownerMetric("الدور", apt.floorNumber || "-")}
        ${ownerMetric("المساحة", apt.area ? `${apt.area}م` : "-")}
        ${ownerMetric("الاتجاه", apt.directionAr || "-")}
        ${ownerMetric("السعر المقترح", formatMoney(deal.proposedTotal), true)}
        ${ownerMetric("المقدم", deal.downPayment ? formatMoney(deal.downPayment) : "غير محدد", true)}
        ${ownerMetric("المتبقي", formatMoney(deal.remainingAmount), true)}
        ${ownerMetric("تاريخ الإرسال", formatDate(deal.submittedAt || deal.createdAt))}
      </div>
      <div class="deal-note-grid">
        <p><strong>خطة السداد:</strong> ${escapeHTML(deal.paymentPlan || "غير محددة")}</p>
        <p><strong>ملاحظات المساعد:</strong> ${escapeHTML(deal.notes || "لا توجد ملاحظات.")}</p>
        <p><strong>ملاحظات المالك:</strong> ${escapeHTML(deal.ownerNotes || "لا توجد ملاحظات.")}</p>
      </div>
      <div class="risk-review">
        <strong>مراجعة مخاطر الديل</strong>
        ${risks.length ? `<div class="risk-list">${risks.map((risk) => `<span class="risk-badge ${escapeHTML(risk.severity)}">${escapeHTML(risk.message)}</span>`).join("")}</div>` : `<span class="risk-badge success">لا توجد مخاطر واضحة حسب الإعدادات الحالية.</span>`}
      </div>
      <footer>
        <button class="btn secondary small" type="button" data-owner-deal-details="${deal.id}">عرض التفاصيل</button>
        <button class="btn ghost small" type="button" data-owner-deal-edit="${deal.id}">تعديل الديل</button>
        ${deal.status === "pending_approval" ? `
          <button class="btn primary small" type="button" data-owner-deal-approve="${deal.id}">الموافقة</button>
          <button class="btn secondary small" type="button" data-owner-deal-revision="${deal.id}">طلب تعديل</button>
          <button class="btn danger small" type="button" data-owner-deal-reject="${deal.id}">رفض</button>
        ` : ""}
        ${deal.status === "draft" ? `<button class="btn danger small" type="button" data-owner-deal-delete="${deal.id}">حذف المسودة</button>` : ""}
        ${!["cancelled", "rejected"].includes(deal.status) ? `<button class="btn danger small" type="button" data-owner-deal-cancel="${deal.id}">إلغاء الديل</button>` : ""}
      </footer>
    </article>
  `;
}

function ownerMetric(label, value) {
  return `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
}

async function handleOwnerDealClick(event) {
  const target = event.target.closest("button");
  if (!target) return;
  const dealId = target.dataset.ownerDealDetails
    || target.dataset.ownerDealEdit
    || target.dataset.ownerDealApprove
    || target.dataset.ownerDealReject
    || target.dataset.ownerDealRevision
    || target.dataset.ownerDealCancel
    || target.dataset.ownerDealDelete;
  if (!dealId) return;

  try {
    if (target.dataset.ownerDealDetails) return openOwnerDealDetails(dealId);
    if (target.dataset.ownerDealEdit) return openOwnerDealEdit(dealId);
    if (target.dataset.ownerDealCancel) return openCancelDealDialog(dealId, "owner");
    if (target.dataset.ownerDealDelete) {
      if (!confirm("هل أنت متأكد من حذف مسودة الديل؟")) return;
      await OwnerAPI.deleteDraftDeal(dealId);
      showToast("تم حذف مسودة الديل بنجاح.", "success");
    }
    if (target.dataset.ownerDealApprove) {
      if (!confirm("هل أنت متأكد من الموافقة على هذا الديل؟")) return;
      await OwnerAPI.approveDeal(dealId);
      showToast("تمت الموافقة على الديل بنجاح.", "success");
    }
    if (target.dataset.ownerDealReject) {
      const reason = prompt("اكتب سبب رفض الديل:");
      if (!reason) return;
      await OwnerAPI.rejectDeal(dealId, reason);
      showToast("تم رفض الديل وتسجيل السبب.", "success");
    }
    if (target.dataset.ownerDealRevision) {
      const notes = prompt("اكتب ملاحظات التعديل المطلوبة:");
      if (!notes) return;
      await OwnerAPI.requestRevision(dealId, notes);
      showToast("تم إرسال طلب التعديل إلى المساعد.", "success");
    }
    await loadDashboard();
  } catch (error) {
    showToast(error.message || "حدث خطأ أثناء تنفيذ العملية.", "error");
  }
}

function openOwnerDealDetails(dealId) {
  const deal = (ownerData().deals || []).find((item) => item.id === dealId);
  if (!deal) return;
  openModal(`
    <span class="eyebrow">تفاصيل الديل</span>
    <h2>${escapeHTML(deal.clientName)}</h2>
    <div class="modal-detail-grid">
      ${ownerMetric("رقم الديل", deal.id)}
      ${ownerMetric("المساعد", deal.assistant?.fullName || "-")}
      ${ownerMetric("رقم الهاتف", deal.clientPhone || "-")}
      ${ownerMetric("الوحدة", deal.apartment?.unitCode || "-")}
      ${ownerMetric("السعر المقترح", formatMoney(deal.proposedTotal))}
      ${ownerMetric("المقدم", deal.downPayment ? formatMoney(deal.downPayment) : "غير محدد")}
      ${ownerMetric("المتبقي", formatMoney(deal.remainingAmount))}
      ${ownerMetric("الحالة", statusLabel(deal.status))}
    </div>
    <div class="risk-review">
      <strong>مراجعة مخاطر الديل</strong>
      ${(deal.riskWarnings || []).length ? `<div class="risk-list">${deal.riskWarnings.map((risk) => `<span class="risk-badge ${escapeHTML(risk.severity)}">${escapeHTML(risk.message)}</span>`).join("")}</div>` : `<span class="risk-badge success">لا توجد مخاطر واضحة.</span>`}
    </div>
  `);
}

function openOwnerDealEdit(dealId) {
  const deal = (ownerData().deals || []).find((item) => item.id === dealId);
  if (!deal) return;
  const apartments = ownerData().apartments || [];
  openModal(`
    <span class="eyebrow">تعديل الديل</span>
    <h2>${escapeHTML(deal.clientName)}</h2>
    <form id="ownerDealEditForm" class="form-grid">
      <div class="form-field"><label>اسم العميل</label><input name="client_name" value="${escapeHTML(deal.clientName || "")}" required /></div>
      <div class="form-field"><label>رقم الهاتف</label><input name="client_phone" value="${escapeHTML(deal.clientPhone || "")}" /></div>
      <div class="form-field full"><label>الشقة</label><select name="apartment_id">${apartments.map((apt) => `<option value="${apt.id}" ${apt.id === deal.apartmentId ? "selected" : ""}>${escapeHTML(apt.unitCode)} · ${apt.area}م · ${escapeHTML(apt.directionAr)}</option>`).join("")}</select></div>
      <div class="form-field"><label>السعر المقترح</label><input name="proposed_total" value="${Number(deal.proposedTotal || 0)}" inputmode="numeric" required /></div>
      <div class="form-field"><label>المقدم</label><input name="down_payment" value="${Number(deal.downPayment || 0)}" inputmode="numeric" /></div>
      <div class="form-field full"><label>خطة السداد</label><textarea name="payment_plan">${escapeHTML(deal.paymentPlan || "")}</textarea></div>
      <div class="form-field full"><label>ملاحظات</label><textarea name="notes">${escapeHTML(deal.notes || "")}</textarea></div>
      <button class="btn primary full" type="submit">حفظ التعديلات</button>
    </form>
  `);
  qs("#ownerDealEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await DealAPI.update(dealId, {
        client_name: form.get("client_name"),
        client_phone: form.get("client_phone"),
        apartment_id: form.get("apartment_id"),
        proposed_total: Number(normalizeAmountValue(form.get("proposed_total")) || 0),
        down_payment: Number(normalizeAmountValue(form.get("down_payment")) || 0),
        payment_plan: form.get("payment_plan"),
        notes: form.get("notes"),
      });
      closeModal();
      showToast("تم حفظ التغييرات بنجاح.", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function renderOwnerOperations() {
  return `
    <section class="owner-hero-panel">
      <div>
        <span class="eyebrow">التشغيل</span>
        <h2>العملاء والشقق والمدفوعات</h2>
        <p>اختر القسم المطلوب فقط. كل قسم يعرض بياناته بدون تشتيت.</p>
      </div>
    </section>
    <section class="data-panel owner-panel">
      <div class="owner-tabs">${OWNER_OPERATION_TABS.map(([key, label]) => `<button type="button" data-owner-ops-tab="${key}" class="${APP_STATE.ownerOperationsTab === key ? "active" : ""}">${label}</button>`).join("")}</div>
      ${renderOwnerOperationsTab()}
    </section>
  `;
}

function bindOwnerOperations() {
  const content = qs("#dashboardContent");
  content.querySelectorAll("[data-owner-ops-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      APP_STATE.ownerOperationsTab = button.dataset.ownerOpsTab;
      renderActiveDashboardView();
    });
  });
  content.onclick = handleOwnerOperationsClick;
}

function renderOwnerOperationsTab() {
  const tab = APP_STATE.ownerOperationsTab || "clients";
  if (tab === "apartments" || tab === "map" || tab === "units") return renderOwnerUnitsView();
  if (tab === "payments") return renderOwnerPaymentsTable();
  return renderOwnerClientsTable();
}

function renderOwnerUnitsView() {
  return `
    <div class="owner-units-view">
      <div class="section-heading">
        <span class="eyebrow">الشقق</span>
        <h3>الخريطة والقائمة في مكان واحد</h3>
      </div>
      ${renderOwnerBuildingMap()}
      <div class="owner-inline-divider"></div>
      ${renderOwnerApartmentsTable()}
    </div>
  `;
}

function ownerClientGroups() {
  const groups = new Map();
  for (const client of ownerData().clients || []) {
    const key = client.portfolioCode || client.code || client.id;
    if (!groups.has(key)) {
      groups.set(key, { ...client, ids: [], units: [], apartments: [], totalAmount: 0, paidAmount: 0, remainingAmount: 0 });
    }
    const group = groups.get(key);
    group.ids.push(client.id);
    group.units.push(client.apartment?.unitCode || "-");
    group.apartments.push(client.apartment);
    group.totalAmount += Number(client.totalAmount || 0);
    group.paidAmount += Number(client.paidAmount || 0);
    group.remainingAmount += Number(client.remainingAmount || 0);
    if (client.paymentStatus === "Overdue") group.paymentStatus = "Overdue";
  }
  for (const group of groups.values()) {
    if (group.paymentStatus === "Overdue") continue;
    if (group.totalAmount > 0 && group.remainingAmount <= 0) group.paymentStatus = "Fully Paid";
    else if (group.paidAmount > 0) group.paymentStatus = "Partially Paid";
    else group.paymentStatus = "Pending";
  }
  return Array.from(groups.values());
}

function renderOwnerClientsTable() {
  const groups = ownerClientGroups();
  if (!groups.length) return EmptyState("لا توجد بيانات عملاء حاليًا.", "سيتم عرض العملاء فور إضافة حجوزات أو اعتماد ديلات.");
  return `
    <div class="section-heading"><h3>العملاء</h3></div>
    <div class="table-wrap owner-table-wrap">
      <table>
        <thead><tr><th>اسم العميل</th><th>كود الحجز</th><th>رقم الهاتف</th><th>رقم الشقة</th><th>الدور</th><th>السعر الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحجز</th><th>الدفع</th><th>الإجراءات</th></tr></thead>
        <tbody>${groups.map((client) => `
          <tr>
            <td data-label="اسم العميل">${escapeHTML(client.name)}</td>
            <td data-label="كود الحجز">${escapeHTML(client.code)}</td>
            <td data-label="رقم الهاتف">${escapeHTML(client.phone || "-")}</td>
            <td data-label="رقم الشقة">${escapeHTML(client.units.join("، "))}</td>
            <td data-label="الدور">${escapeHTML([...new Set(client.apartments.map((apt) => apt?.floorNumber).filter(Boolean))].join("، ") || "-")}</td>
            <td data-label="السعر الإجمالي" data-money>${formatMoney(client.totalAmount)}</td>
            <td data-label="المدفوع" data-money>${formatMoney(client.paidAmount)}</td>
            <td data-label="المتبقي" data-money>${formatMoney(client.remainingAmount)}</td>
            <td data-label="الحجز">${StatusBadge(client.reservationStatus)}</td>
            <td data-label="الدفع">${StatusBadge(client.paymentStatus)}</td>
            <td data-label="الإجراءات" class="table-actions">
              <button class="btn ghost small" type="button" data-owner-client-profile="${client.code}">عرض الملف</button>
              <button class="btn primary small" type="button" data-owner-client-payment="${client.code}">إضافة دفعة</button>
              <button class="btn secondary small" type="button" data-owner-client-add-unit="${client.id}">إضافة شقة</button>
              <button class="btn ghost small" type="button" data-owner-client-statement="${client.id}" data-client-code="${client.code}">كشف الحجز</button>
              <button class="btn secondary small" type="button" data-owner-client-whatsapp="${client.phone || ""}">واتساب</button>
              <button class="btn danger small" type="button" data-owner-client-cancel="${escapeHTML(client.ids.join(","))}" data-client-name="${escapeHTML(client.name)}">إلغاء الحجز</button>
              <button class="btn danger small" type="button" data-owner-client-delete="${escapeHTML(client.ids.join(","))}" data-client-name="${escapeHTML(client.name)}">حذف</button>
            </td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderOwnerApartmentsTable() {
  const apartments = ownerData().apartments || [];
  if (!apartments.length) return EmptyState("لا توجد شقق بهذه الحالة.", "سيتم عرض الوحدات فور توفرها في النظام.");
  return `
    <div class="section-heading"><h3>الشقق</h3></div>
    <div class="table-wrap owner-table-wrap">
      <table>
        <thead><tr><th>رقم الشقة</th><th>الدور</th><th>النوع</th><th>المساحة</th><th>الاتجاه</th><th>السعر</th><th>الحالة</th><th>العميل المرتبط</th><th>المدفوع</th><th>المتبقي</th><th>الإجراءات</th></tr></thead>
        <tbody>${apartments.map((apt) => {
          const client = (ownerData().clients || []).find((item) => item.apartmentId === apt.id);
          return `
            <tr>
              <td data-label="رقم الشقة">${escapeHTML(apt.unitCode)}</td><td data-label="الدور">${apt.floorNumber}</td><td data-label="النوع">${escapeHTML(apt.apartmentType)}</td><td data-label="المساحة">${apt.area}م</td><td data-label="الاتجاه">${escapeHTML(apt.directionAr)}</td><td data-label="السعر" data-money>${formatMoney(apt.price)}</td><td data-label="الحالة">${StatusBadge(apt.status)}</td>
              <td data-label="العميل المرتبط">${escapeHTML(client?.name || "-")}</td><td data-label="المدفوع" data-money>${formatMoney(client?.paidAmount || 0)}</td><td data-label="المتبقي" data-money>${formatMoney(client?.remainingAmount || 0)}</td>
              <td data-label="الإجراءات" class="table-actions"><button class="btn ghost small" data-owner-apartment-edit="${apt.id}" type="button">تعديل / حجز</button><button class="btn ghost small" data-owner-apartment-history="${apt.id}" type="button">سجل الوحدة</button></td>
            </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  `;
}

function renderOwnerBuildingMap() {
  const apartments = ownerData().apartments || [];
  const floors = Array.from({ length: 7 }, (_, index) => 7 - index);
  return `
    <div class="section-heading"><h3>خريطة الشقق</h3><span>٧ أدوار · ٢١ وحدة · ثلاثة نماذج واضحة لكل دور</span></div>
    <div class="owner-building-map">
      ${floors.map((floor) => `
        <div class="owner-floor-row">
          <div class="owner-floor-label">الدور ${floor}</div>
          ${["A", "B", "C"].map((type) => {
            const apt = apartments.find((item) => item.floorNumber === floor && item.apartmentType === type);
            const client = apt ? (ownerData().clients || []).find((item) => item.apartmentId === apt.id) : null;
            const progress = client?.totalAmount ? (Number(client.paidAmount || 0) / Number(client.totalAmount || 1)) * 100 : 0;
            return apt ? `
              <button type="button" class="owner-unit-card status-${statusClass(apt.status)}" data-owner-apartment-edit="${apt.id}">
                <header><strong>${escapeHTML(apt.unitCode)}</strong>${StatusBadge(apt.status)}</header>
                <p>${apt.area}م · ${escapeHTML(apt.directionAr)}</p>
                <small>${escapeHTML(client?.name || "بدون عميل مرتبط")}</small>
                <div class="mini-finance"><span>${formatMoney(client?.paidAmount || 0)}</span><span>${formatMoney(client?.remainingAmount || 0)}</span></div>
                ${ProgressBar(progress)}
                <em>${StatusBadge(client?.paymentStatus || "Pending")}</em>
              </button>
            ` : `<div class="owner-unit-card muted">غير متاحة</div>`;
          }).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function renderOwnerPaymentsTable() {
  const payments = ownerData().payments || [];
  if (!payments.length) return EmptyState("لا توجد مدفوعات مسجلة حاليًا.", "سيتم عرض المدفوعات فور إضافتها.");
  return `
    <div class="section-heading"><h3>المدفوعات</h3></div>
    <div class="table-wrap owner-table-wrap">
      <table>
        <thead><tr><th>اسم العميل</th><th>رقم الشقة</th><th>تاريخ الدفع</th><th>المبلغ</th><th>طريقة الدفع</th><th>حالة الدفعة</th><th>رقم الإيصال</th><th>الإجراءات</th></tr></thead>
        <tbody>${payments.map((payment) => {
          const client = (ownerData().clients || []).find((item) => item.id === payment.clientId);
          const apt = (ownerData().apartments || []).find((item) => item.id === payment.apartmentId);
          return `
            <tr>
              <td data-label="اسم العميل">${escapeHTML(client?.name || "-")}</td><td data-label="رقم الشقة">${escapeHTML(apt?.unitCode || "-")}</td><td data-label="تاريخ الدفع">${formatDate(payment.date)}</td><td data-label="المبلغ" data-money>${formatMoney(payment.amount)}</td><td data-label="طريقة الدفع">${escapeHTML(statusLabel(payment.method))}</td><td data-label="حالة الدفعة">${StatusBadge(payment.status)}</td><td data-label="رقم الإيصال">${escapeHTML(payment.receiptNumber || payment.reference || "-")}</td>
              <td data-label="الإجراءات" class="table-actions"><button class="btn ghost small" data-owner-payment-view="${payment.id}" type="button">عرض</button><button class="btn ghost small" data-owner-payment-receipt="${payment.id}" type="button">إيصال</button></td>
            </tr>`;
        }).join("")}</tbody>
      </table>
    </div>
  `;
}

async function handleOwnerOperationsClick(event) {
  const target = event.target.closest("button");
  if (!target) return;
  try {
    if (target.dataset.ownerClientProfile) return openOwnerClientProfile(target.dataset.ownerClientProfile);
    if (target.dataset.ownerClientPayment) return openOwnerClientPayment(target.dataset.ownerClientPayment);
    if (target.dataset.ownerClientAddUnit) return openClientFormForExistingClient(target.dataset.ownerClientAddUnit);
    if (target.dataset.ownerClientStatement) return downloadFile(ClientAPI.statementUrl(target.dataset.ownerClientStatement, target.dataset.clientCode));
    if (target.dataset.ownerClientWhatsapp) return openOwnerWhatsapp(target.dataset.ownerClientWhatsapp);
    if (target.dataset.ownerClientCancel) return cancelOwnerClientGroup(target.dataset.ownerClientCancel, target.dataset.clientName);
    if (target.dataset.ownerClientDelete) return deleteOwnerClientGroup(target.dataset.ownerClientDelete, target.dataset.clientName);
    if (target.dataset.ownerApartmentEdit) return openOwnerApartmentEdit(target.dataset.ownerApartmentEdit);
    if (target.dataset.ownerApartmentHistory) return openOwnerApartmentHistory(target.dataset.ownerApartmentHistory);
    if (target.dataset.ownerPaymentReceipt) {
      const result = await AdminAPI.receipt(target.dataset.ownerPaymentReceipt);
      if (result.url) downloadFile(result.url);
    }
  } catch (error) {
    showToast(error.message || "حدث خطأ أثناء تنفيذ العملية.", "error");
  }
}

function openOwnerClientProfile(code) {
  const client = ownerClientGroups().find((item) => item.code === code);
  if (!client) return;
  openModal(`
    <span class="eyebrow">ملف العميل</span>
    <h2>${escapeHTML(client.name)}</h2>
    <div class="modal-detail-grid">
      ${ownerMetric("كود الحجز", client.code)}
      ${ownerMetric("رقم الهاتف", client.phone || "-")}
      ${ownerMetric("الوحدات", client.units.join("، "))}
      ${ownerMetric("السعر الإجمالي", formatMoney(client.totalAmount))}
      ${ownerMetric("المدفوع", formatMoney(client.paidAmount))}
      ${ownerMetric("المتبقي", formatMoney(client.remainingAmount))}
      ${ownerMetric("حالة الحجز", statusLabel(client.reservationStatus))}
      ${ownerMetric("حالة الدفع", statusLabel(client.paymentStatus))}
    </div>
    <p class="owner-modal-note"><strong>ملاحظات داخلية:</strong> ${escapeHTML(client.officeNotes || "لا توجد ملاحظات.")}</p>
    <div class="contact-actions">
      <button class="btn primary" type="button" data-profile-payment="${escapeHTML(client.code)}">إضافة دفعة</button>
      <button class="btn secondary" type="button" data-profile-add-unit="${escapeHTML(client.id)}">إضافة شقة</button>
      <button class="btn ghost" type="button" data-profile-statement="${escapeHTML(client.id)}" data-client-code="${escapeHTML(client.code)}">كشف حساب</button>
      <button class="btn ghost" type="button" data-profile-whatsapp="${escapeHTML(client.phone || "")}">واتساب</button>
      <button class="btn danger" type="button" data-profile-cancel="${escapeHTML(client.ids.join(","))}" data-client-name="${escapeHTML(client.name)}">إلغاء الحجز</button>
      <button class="btn danger" type="button" data-profile-delete="${escapeHTML(client.ids.join(","))}" data-client-name="${escapeHTML(client.name)}">حذف</button>
    </div>
  `);
  qs("[data-profile-payment]")?.addEventListener("click", (event) => openOwnerClientPayment(event.currentTarget.dataset.profilePayment));
  qs("[data-profile-add-unit]")?.addEventListener("click", (event) => openClientFormForExistingClient(event.currentTarget.dataset.profileAddUnit));
  qs("[data-profile-statement]")?.addEventListener("click", (event) => downloadFile(ClientAPI.statementUrl(event.currentTarget.dataset.profileStatement, event.currentTarget.dataset.clientCode)));
  qs("[data-profile-whatsapp]")?.addEventListener("click", (event) => openOwnerWhatsapp(event.currentTarget.dataset.profileWhatsapp));
  qs("[data-profile-cancel]")?.addEventListener("click", (event) => cancelOwnerClientGroup(event.currentTarget.dataset.profileCancel, event.currentTarget.dataset.clientName));
  qs("[data-profile-delete]")?.addEventListener("click", (event) => deleteOwnerClientGroup(event.currentTarget.dataset.profileDelete, event.currentTarget.dataset.clientName));
}

async function cancelOwnerClientGroup(clientIds, clientName) {
  const ids = (clientIds || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!ids.length) return;
  const reason = prompt(`اكتب سبب إلغاء حجز العميل "${clientName || ""}":`);
  if (!reason) return;
  try {
    for (const id of ids) {
      await AdminAPI.cancelClient(id, reason);
    }
    closeModal();
    showToast("تم إلغاء الحجز وتحرير الشقة بنجاح.", "success");
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteOwnerClientGroup(clientIds, clientName) {
  const ids = (clientIds || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!ids.length) return;
  openModal(`
    <span class="eyebrow">حذف العميل</span>
    <h2>${escapeHTML(clientName || "عميل")}</h2>
    <p class="muted">اختر إلغاء الحجز للاحتفاظ بالسجل المالي، أو حذف العميل مع سجله المالي بعد تأكيد كلمة المرور.</p>
    <form id="ownerClientDeleteChoiceForm" class="form-grid" autocomplete="off">
      <div class="form-field full"><label for="clientDeleteReason">سبب الإجراء</label><textarea id="clientDeleteReason" required></textarea></div>
      <div class="form-field full"><label for="clientDeletePassword">كلمة المرور مطلوبة للحذف بالسجل المالي فقط</label><input id="clientDeletePassword" type="password" autocomplete="current-password" /></div>
      <button class="btn secondary" type="button" id="cancelClientReservationButton">إلغاء الحجز</button>
      <button class="btn danger" type="button" id="deleteClientWithRecordsButton">حذف بالسجل المالي</button>
      <button class="btn ghost full" type="button" id="backFromClientDeleteButton">تراجع</button>
    </form>
  `);
  qs("#backFromClientDeleteButton")?.addEventListener("click", closeModal);
  qs("#cancelClientReservationButton")?.addEventListener("click", async () => {
    const reason = qs("#clientDeleteReason").value.trim();
    if (!reason) return showToast("سبب الإجراء مطلوب.", "error");
    try {
      for (const id of ids) {
        await AdminAPI.cancelClient(id, reason);
      }
      closeModal();
      showToast("تم إلغاء الحجز وتحرير الشقة بنجاح.", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
  qs("#deleteClientWithRecordsButton")?.addEventListener("click", async () => {
    const reason = qs("#clientDeleteReason").value.trim();
    const password = qs("#clientDeletePassword").value;
    if (!reason) return showToast("سبب الإجراء مطلوب.", "error");
    if (!password) return showToast("يرجى إدخال كلمة المرور لتأكيد الحذف.", "error");
    if (!confirm("سيتم حذف العميل وسجله المالي نهائيًا. هل أنت متأكد؟")) return;
    try {
      for (const id of ids) {
        await AdminAPI.deleteClientWithRecords(id, { reason, password });
      }
      closeModal();
      showToast("تم حذف العميل مع السجل المالي بنجاح.", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function openOwnerClientPayment(code) {
  const candidates = (ownerData().clients || []).filter((client) => client.code === code || client.portfolioCode === code);
  const selected = candidates.find((client) => Number(client.remainingAmount || 0) > 0) || candidates[0];
  if (!selected) return showToast("لا يوجد ملف عميل صالح لإضافة دفعة.", "error");
  openPaymentForm(selected.id);
}

function openOwnerWhatsapp(phone) {
  const target = (phone || APP_CONFIG.whatsappNumber || "").replace(/[^\d]/g, "");
  if (!target) return showToast("لا يوجد رقم واتساب متاح.", "error");
  window.open(`https://wa.me/${target}`, "_blank", "noopener");
}

function openOwnerApartmentEdit(apartmentId) {
  const apt = (ownerData().apartments || []).find((item) => item.id === apartmentId);
  if (!apt) return;
  const linkedClient = (ownerData().clients || []).find((client) => client.apartmentId === apartmentId && client.reservationStatus !== "Cancelled");
  const canCreateReservation = !linkedClient;
  openModal(`
    <span class="eyebrow">تعديل أو حجز الشقة</span>
    <h2>${escapeHTML(apt.unitCode)}</h2>
    <form id="ownerApartmentForm" class="form-grid">
      <div class="form-field"><label>السعر</label><input name="price" value="${Number(apt.price || 0)}" inputmode="numeric" required /></div>
      <div class="form-field"><label>الحالة</label><select name="status">
        ${["available", "pending_payment", "reserved", "sold", "frozen"].map((status) => `<option value="${status}" ${statusLabel(apt.status) === statusLabel(status) ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
      </select></div>
      ${linkedClient ? `
        <div class="owner-linked-client full">
          <span>العميل المرتبط</span>
          <strong>${escapeHTML(linkedClient.name || "-")}</strong>
          <small>كود الحجز: ${escapeHTML(linkedClient.code || linkedClient.reservationCode || "-")}</small>
        </div>
      ` : `
        <div class="owner-reservation-fields full" id="ownerReservationFields">
          <div class="owner-inline-title">
            <strong>حجز الشقة لعميل</strong>
            <span>املأ هذه البيانات عند تغيير الحالة إلى محجوزة أو مباعة.</span>
          </div>
          <div class="form-grid">
            <div class="form-field"><label>اسم العميل</label><input name="client_name" autocomplete="off" /></div>
            <div class="form-field"><label>رقم الهاتف</label><input name="client_phone" autocomplete="off" /></div>
            <div class="form-field"><label>البريد الإلكتروني</label><input name="client_email" type="email" autocomplete="off" /></div>
            <div class="form-field"><label>الرقم القومي</label><input name="national_id" autocomplete="off" /></div>
            <div class="form-field full"><label>ملاحظات العميل</label><textarea name="client_notes"></textarea></div>
          </div>
        </div>
      `}
      <div class="form-field full"><label>ملاحظات</label><textarea name="notes">${escapeHTML(apt.notes || "")}</textarea></div>
      <button class="btn primary full" type="submit">حفظ التغييرات</button>
    </form>
  `);
  if (canCreateReservation) {
    const statusSelect = qs('#ownerApartmentForm select[name="status"]');
    const fields = qs("#ownerReservationFields");
    const syncFields = () => {
      const needsClient = ["reserved", "sold", "pending_payment"].includes(statusSelect.value);
      fields.hidden = !needsClient;
      qsa("input, textarea", fields).forEach((input) => {
        input.required = needsClient && input.name === "client_name";
      });
    };
    statusSelect.addEventListener("change", syncFields);
    syncFields();
  }
  qs("#ownerApartmentForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const targetStatus = form.get("status");
      const price = Number(normalizeAmountValue(form.get("price")) || 0);
      const clientName = String(form.get("client_name") || "").trim();
      let createdClient = null;

      if (!linkedClient && ["reserved", "sold", "pending_payment"].includes(targetStatus)) {
        if (!clientName) {
          throw new Error("اسم العميل مطلوب عند حجز الشقة.");
        }
        const result = await AdminAPI.createClient({
          full_name: clientName,
          phone: String(form.get("client_phone") || "").trim(),
          email: String(form.get("client_email") || "").trim(),
          national_id: String(form.get("national_id") || "").trim(),
          apartment_id: apartmentId,
          total_amount: price,
          reservation_status: targetStatus === "sold" ? "sold" : "reserved",
          office_notes: String(form.get("client_notes") || form.get("notes") || "").trim(),
        });
        createdClient = result.client;
      } else {
        await OwnerAPI.updateApartment(apartmentId, {
          price,
          status: targetStatus,
          notes: form.get("notes"),
        });
      }
      closeModal();
      if (createdClient) {
        showToast(`تم حجز الشقة للعميل. كود الحجز: ${createdClient.code}`, "success");
        openOwnerReservationCreated(createdClient);
      } else {
        showToast("تم حفظ التغييرات بنجاح.", "success");
      }
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function openOwnerReservationCreated(client) {
  openModal(`
    <span class="eyebrow">تم إنشاء الحجز</span>
    <h2>${escapeHTML(client.name)}</h2>
    <div class="modal-detail-grid">
      ${ownerMetric("كود الحجز للعميل", client.code)}
      ${ownerMetric("الشقة", client.apartment?.unitCode || "-")}
      ${ownerMetric("السعر الإجمالي", formatMoney(client.totalAmount))}
      ${ownerMetric("حالة الحجز", statusLabel(client.reservationStatus))}
    </div>
    <p class="owner-modal-note">أرسل هذا الكود للعميل حتى يستطيع الدخول إلى بوابة الحجز ومتابعة بياناته ومدفوعاته.</p>
    <div class="contact-actions">
      <button class="btn primary" type="button" onclick="navigator.clipboard?.writeText('${escapeHTML(client.code)}'); showToast('تم نسخ كود الحجز.', 'success')">نسخ كود الحجز</button>
      <button class="btn secondary" type="button" onclick="closeModal()">إغلاق</button>
    </div>
  `);
}

async function openOwnerApartmentHistory(apartmentId) {
  const result = await OwnerAPI.apartmentTimeline(apartmentId);
  const logs = result.timeline || [];
  openModal(`
    <span class="eyebrow">سجل الوحدة</span>
    <h2>حركة الشقة</h2>
    ${logs.length ? `<div class="activity-timeline">${logs.map((log) => `<article><strong>${escapeHTML(log.description || log.action_type)}</strong><span>${escapeHTML(log.admin_name || "النظام")} · ${formatDateTime(log.created_at)}</span></article>`).join("")}</div>` : EmptyState("لا يوجد سجل لهذه الوحدة.", "سيظهر السجل عند تنفيذ عمليات مرتبطة بها.")}
  `);
}

function renderOwnerSettings() {
  return `
    <section class="owner-hero-panel">
      <div>
        <span class="eyebrow">الإعدادات</span>
        <h2>إعدادات نظام المالك</h2>
        <p>إدارة بيانات المكتب، حدود الأسعار، وصلاحيات المساعدين.</p>
      </div>
    </section>
    <section class="data-panel owner-panel">
      <div class="owner-tabs">${OWNER_SETTINGS_TABS.map(([key, label]) => `<button type="button" data-owner-settings-tab="${key}" class="${APP_STATE.ownerSettingsTab === key ? "active" : ""}">${label}</button>`).join("")}</div>
      ${renderOwnerSettingsTab()}
    </section>
  `;
}

function bindOwnerSettings() {
  const content = qs("#dashboardContent");
  content.querySelectorAll("[data-owner-settings-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      APP_STATE.ownerSettingsTab = button.dataset.ownerSettingsTab;
      renderActiveDashboardView();
    });
  });
  qs("#ownerSettingsForm")?.addEventListener("submit", saveOwnerSettingsForm);
  qs("#accountUserForm")?.addEventListener("submit", createAccountUser);
  content.querySelectorAll("[data-account-edit]").forEach((button) => button.addEventListener("click", () => openAccountEdit(button.dataset.accountEdit)));
  content.querySelectorAll("[data-account-reset]").forEach((button) => button.addEventListener("click", () => openAccountPasswordReset(button.dataset.accountReset)));
  content.querySelectorAll("[data-account-disable]").forEach((button) => button.addEventListener("click", () => toggleAccountStatus(button.dataset.accountDisable, false)));
  content.querySelectorAll("[data-account-enable]").forEach((button) => button.addEventListener("click", () => toggleAccountStatus(button.dataset.accountEnable, true)));
}

function renderOwnerSettingsTab() {
  const settings = ownerData().settings || {};
  const tab = APP_STATE.ownerSettingsTab || "office";
  if (tab === "pricing") return renderPriceSettings(settings.priceSettings || {});
  if (tab === "permissions") return renderPermissionSettings(settings.permissionSettings || {});
  if (tab === "accounts") return renderAccountsSettings();
  if (tab === "system") return renderSystemSettings(settings.systemSettings || {});
  if (tab === "media") return renderMediaSettings(settings.mediaSettings || {});
  return renderOfficeSettings(settings.office || {});
}

function renderOfficeSettings(office) {
  return settingsForm("office", `
    ${settingsInput("اسم المكتب", "office_name", office.office_name)}
    ${settingsInput("رقم الهاتف", "office_phone", office.office_phone)}
    ${settingsInput("رقم واتساب", "whatsapp_number", office.whatsapp_number)}
    ${settingsInput("العنوان", "office_address", office.office_address, "full")}
    ${settingsInput("البريد الإلكتروني", "office_email", office.office_email)}
    ${settingsInput("العملة", "currency", office.currency || "EGP")}
    ${settingsInput("شعار المكتب إن وجد", "office_logo", office.office_logo, "full")}
  `, "حفظ بيانات المكتب");
}

function renderPriceSettings(settings) {
  return settingsForm("priceSettings", `
    ${settingsInput("الحد الأدنى لسعر شقة 137م", "min_price_137", settings.min_price_137)}
    ${settingsInput("الحد الأدنى لسعر شقة 125م", "min_price_125", settings.min_price_125)}
    ${settingsInput("الحد الأدنى لسعر شقة 120م", "min_price_120", settings.min_price_120)}
    ${settingsInput("أقل مقدم مسموح (%)", "minimum_down_payment_percent", settings.minimum_down_payment_percent)}
    ${settingsInput("أقصى مدة أقساط مسموحة", "max_installment_months", settings.max_installment_months)}
  `, "حفظ إعدادات الأسعار");
}

function renderPermissionSettings(settings) {
  return settingsForm("permissionSettings", `
    ${settingsCheckbox("السماح للمساعد بإنشاء ديل", "assistant_can_create_deal", settings.assistant_can_create_deal)}
    ${settingsCheckbox("السماح للمساعد بتعديل الديل قبل الإرسال", "assistant_can_edit_before_submit", settings.assistant_can_edit_before_submit)}
    ${settingsCheckbox("السماح للمساعد برفع ملفات العميل", "assistant_can_upload_client_files", settings.assistant_can_upload_client_files)}
    ${settingsCheckbox("منع المساعد من رؤية الأسعار المالية العامة", "hide_global_financials_from_assistant", settings.hide_global_financials_from_assistant)}
    ${settingsCheckbox("منع المساعد من رؤية عملاء غير تابعين له", "assistant_own_clients_only", settings.assistant_own_clients_only)}
  `, "حفظ إعدادات الصلاحيات");
}

function renderAssistantUsersSettings() {
  const assistants = (APP_STATE.dashboard?.users || []).filter((user) => user.role === "assistant");
  return `
    <div class="two-column">
      <section class="data-panel owner-panel">
        <span class="eyebrow">إضافة مساعد</span>
        <h3>حساب مساعد جديد</h3>
        <form id="assistantUserForm" class="form-grid" autocomplete="off">
          <div class="form-field"><label for="assistantName">اسم المساعد</label><input id="assistantName" required /></div>
          <div class="form-field"><label for="assistantEmail">البريد الإلكتروني</label><input id="assistantEmail" type="email" required /></div>
          <div class="form-field full"><label for="assistantPassword">كلمة المرور</label><input id="assistantPassword" type="password" minlength="8" placeholder="Assistant@12345" /></div>
          <button class="btn primary full" type="submit">إضافة مساعد</button>
        </form>
      </section>
      <section class="data-panel owner-panel">
        <span class="eyebrow">المساعدين</span>
        <h3>الحسابات الحالية</h3>
        ${assistants.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>تاريخ الإضافة</th></tr></thead>
              <tbody>
                ${assistants.map((assistant) => `
                  <tr>
                    <td data-label="الاسم">${escapeHTML(assistant.fullName || assistant.name || "-")}</td>
                    <td data-label="البريد الإلكتروني">${escapeHTML(assistant.email || "-")}</td>
                    <td data-label="تاريخ الإضافة">${formatDate(assistant.createdAt)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : EmptyState("لا يوجد مساعدين حاليًا.", "أضف أول مساعد من النموذج الموجود بجانب القائمة.")}
      </section>
    </div>
  `;
}

function renderAccountsSettings() {
  const users = APP_STATE.dashboard?.users || [];
  return `
    <div class="two-column">
      <section class="data-panel owner-panel">
        <span class="eyebrow">إدارة الحسابات</span>
        <h3>إضافة حساب</h3>
        <form id="accountUserForm" class="form-grid" autocomplete="off">
          <div class="form-field"><label for="accountName">الاسم</label><input id="accountName" required /></div>
          <div class="form-field"><label for="accountEmail">البريد الإلكتروني</label><input id="accountEmail" type="email" required /></div>
          <div class="form-field"><label for="accountPhone">رقم الهاتف</label><input id="accountPhone" /></div>
          <div class="form-field"><label for="accountRole">الدور</label><select id="accountRole">${["admin", "assistant", "accountant", "viewer"].map((role) => `<option value="${role}">${escapeHTML(role)}</option>`).join("")}</select></div>
          <div class="form-field full"><label for="accountPassword">كلمة المرور المؤقتة</label><input id="accountPassword" type="password" minlength="8" placeholder="Assistant@12345" /></div>
          <button class="btn primary full" type="submit">إضافة الحساب</button>
        </form>
      </section>
      <section class="data-panel owner-panel">
        <span class="eyebrow">إدارة الحسابات</span>
        <h3>الحسابات الحالية</h3>
        ${users.length ? renderAccountsTable(users) : EmptyState("لا توجد حسابات متاحة حاليًا.", "سيتم عرض الحسابات هنا بعد إضافتها.")}
      </section>
    </div>
  `;
}

function renderAccountsTable(users) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>الدور</th><th>رقم الهاتف</th><th>الحالة</th><th>آخر دخول</th><th>الإجراءات</th></tr></thead>
        <tbody>
          ${users.map((user) => {
            const isSelf = user.id === APP_STATE.session?.id;
            const isOwner = user.role === "owner";
            return `
              <tr>
                <td data-label="الاسم">${escapeHTML(user.fullName || "-")}</td>
                <td data-label="البريد الإلكتروني">${escapeHTML(user.email || "-")}</td>
                <td data-label="الدور">${escapeHTML(user.role || "-")}</td>
                <td data-label="رقم الهاتف">${escapeHTML(user.phone || "-")}</td>
                <td data-label="الحالة">${user.isActive ? "نشط" : "موقوف"}</td>
                <td data-label="آخر دخول">${formatDateTime(user.lastLoginAt)}</td>
                <td data-label="الإجراءات">
                  <button class="btn ghost small" type="button" data-account-edit="${user.id}">تعديل البيانات</button>
                  ${!isOwner ? `<button class="btn secondary small" type="button" data-account-reset="${user.id}">إعادة تعيين كلمة المرور</button>` : ""}
                  ${user.isActive
                    ? (!isOwner && !isSelf ? `<button class="btn danger small" type="button" data-account-disable="${user.id}">إيقاف الحساب</button>` : "")
                    : `<button class="btn primary small" type="button" data-account-enable="${user.id}">تفعيل الحساب</button>`}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

async function createAccountUser(event) {
  event.preventDefault();
  const button = qs("#accountUserForm button[type='submit']");
  setButtonLoading(button, true, "جاري إضافة الحساب...");
  try {
    await AdminAPI.createUser({
      full_name: qs("#accountName").value.trim(),
      email: qs("#accountEmail").value.trim().toLowerCase(),
      phone: qs("#accountPhone").value.trim(),
      role: qs("#accountRole").value,
      password: qs("#accountPassword").value || "Assistant@12345",
    });
    showToast("تم إضافة الحساب بنجاح.", "success");
    await loadDashboard();
    APP_STATE.ownerSettingsTab = "accounts";
    renderActiveDashboardView();
  } catch (error) {
    showToast(error.message || "حدث خطأ أثناء إضافة الحساب.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function openAccountEdit(userId) {
  const user = (APP_STATE.dashboard?.users || []).find((item) => item.id === userId);
  if (!user) return;
  const roles = ["admin", "assistant", "accountant", "viewer"];
  openModal(`
    <span class="eyebrow">إدارة الحسابات</span>
    <h2>تعديل البيانات</h2>
    <form id="accountEditForm" class="form-grid" autocomplete="off">
      <div class="form-field"><label>الاسم</label><input name="full_name" value="${escapeHTML(user.fullName || "")}" required /></div>
      <div class="form-field"><label>البريد الإلكتروني</label><input name="email" type="email" value="${escapeHTML(user.email || "")}" required /></div>
      <div class="form-field"><label>رقم الهاتف</label><input name="phone" value="${escapeHTML(user.phone || "")}" /></div>
      <div class="form-field"><label>الدور</label><select name="role">${(user.role === "owner" ? ["owner"] : roles).map((role) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${escapeHTML(role)}</option>`).join("")}</select></div>
      <button class="btn primary full" type="submit">حفظ التعديل</button>
    </form>
  `);
  qs("#accountEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await AdminAPI.updateUser(userId, {
        full_name: form.get("full_name"),
        email: String(form.get("email") || "").toLowerCase(),
        phone: form.get("phone"),
        role: form.get("role"),
      });
      closeModal();
      showToast("تم حفظ بيانات الحساب.", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function openAccountPasswordReset(userId) {
  openModal(`
    <span class="eyebrow">إدارة الحسابات</span>
    <h2>إعادة تعيين كلمة المرور</h2>
    <form id="accountResetForm" class="form-grid" autocomplete="off">
      <div class="form-field full"><label>كلمة المرور المؤقتة</label><input name="temporary_password" type="password" minlength="8" required /></div>
      <button class="btn primary full" type="submit">إعادة التعيين</button>
    </form>
  `);
  qs("#accountResetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await AdminAPI.resetUserPassword(userId, { temporary_password: form.get("temporary_password") });
      closeModal();
      showToast("تمت إعادة تعيين كلمة المرور.", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

async function toggleAccountStatus(userId, enabled) {
  if (!confirm(enabled ? "هل تريد تفعيل هذا الحساب؟" : "هل تريد إيقاف هذا الحساب؟")) return;
  try {
    if (enabled) await AdminAPI.enableUser(userId);
    else await AdminAPI.disableUser(userId);
    showToast(enabled ? "تم تفعيل الحساب." : "تم إيقاف الحساب.", "success");
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderSystemSettings(settings) {
  return settingsForm("systemSettings", `
    ${settingsCheckbox("تفعيل رمز تأكيد المالك PIN", "owner_pin_enabled", settings.owner_pin_enabled)}
    ${settingsInput("تغيير رمز تأكيد المالك", "owner_pin", "", "full")}
    ${settingsInput("بادئة رقم الإيصال", "receipt_prefix", settings.receipt_prefix)}
    ${settingsInput("عدد النتائج في الجداول", "table_page_size", settings.table_page_size)}
    ${settingsCheckbox("تفعيل التنبيهات الداخلية", "internal_alerts_enabled", settings.internal_alerts_enabled)}
  `, "حفظ إعدادات النظام");
}

function renderMediaSettings(settings) {
  return settingsForm("mediaSettings", `
    ${settingsInput("رابط فيديو متابعة الإنشاء", "project_video_url", settings.project_video_url, "full")}
    ${settingsInput("ترتيب عرض المعرض", "gallery_order", settings.gallery_order, "full")}
    ${settingsCheckbox("إظهار تحديثات المشروع المنشورة", "show_published_updates", settings.show_published_updates)}
    <div class="empty-state full"><strong>إدارة الوسائط والتحديثات</strong><br><span>يتم نشر التحديثات والوسائط من قسم آخر التحديثات مع حفظ حالة النشر داخل قاعدة البيانات.</span></div>
  `, "حفظ إعدادات الوسائط");
}

function settingsForm(type, content, buttonText) {
  return `<form id="ownerSettingsForm" data-settings-type="${type}" class="form-grid owner-settings-form">${content}<button class="btn primary full" type="submit">${buttonText}</button></form>`;
}

function settingsInput(label, name, value = "", extraClass = "") {
  return `<div class="form-field ${extraClass}"><label>${escapeHTML(label)}</label><input name="${escapeHTML(name)}" value="${escapeHTML(value || "")}" /></div>`;
}

function settingsTextarea(label, name, value = "") {
  return `<div class="form-field full"><label>${escapeHTML(label)}</label><textarea name="${escapeHTML(name)}">${escapeHTML(value || "")}</textarea></div>`;
}

function settingsCheckbox(label, name, checked) {
  return `<label class="settings-check"><input type="checkbox" name="${escapeHTML(name)}" ${checked ? "checked" : ""} /> <span>${escapeHTML(label)}</span></label>`;
}

async function saveOwnerSettingsForm(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const type = form.dataset.settingsType;
  const data = {};
  new FormData(form).forEach((value, key) => {
    data[key] = value;
  });
  form.querySelectorAll("input[type='checkbox']").forEach((input) => {
    data[input.name] = input.checked;
  });
  try {
    if (type === "priceSettings") await OwnerAPI.updatePriceSettings(data);
    else await OwnerAPI.updateSettings({ [type]: data });
    showToast("تم حفظ التغييرات بنجاح.", "success");
    await loadDashboard();
  } catch (error) {
    showToast(error.message || "حدث خطأ أثناء حفظ الإعدادات.", "error");
  }
}

async function createAssistantUser(event) {
  event.preventDefault();
  const button = qs("#assistantUserForm button[type='submit']");
  setButtonLoading(button, true, "جاري إضافة المساعد...");
  try {
    await AdminAPI.createUser({
      full_name: qs("#assistantName").value.trim(),
      email: qs("#assistantEmail").value.trim().toLowerCase(),
      password: qs("#assistantPassword").value || "Assistant@12345",
      role: "assistant",
    });
    showToast("تم إضافة المساعد بنجاح.", "success");
    await loadDashboard();
    APP_STATE.ownerSettingsTab = "assistants";
    renderActiveDashboardView();
  } catch (error) {
    showToast(error.message || "حدث خطأ أثناء إضافة المساعد.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function renderOwnerAuditLog() {
  const logs = filterOwnerAuditLogs(ownerData().auditLogs || []);
  return `
    <section class="owner-hero-panel">
      <div>
        <span class="eyebrow">سجل النشاط</span>
        <h2>سجل النشاط</h2>
        <p>تابع جميع العمليات التي تمت داخل النظام مع تفاصيل المستخدم والتوقيت.</p>
      </div>
    </section>
    <section class="data-panel owner-panel">
      <div class="filter-bar owner-filter-bar">
        <label class="search-field"><span>بحث</span><input id="ownerAuditSearch" value="${escapeHTML(APP_STATE.ownerAuditSearch || "")}" placeholder="المستخدم، الدور، الإجراء، القسم" /></label>
      </div>
      ${renderOwnerAuditTable(logs)}
    </section>
  `;
}

function bindOwnerAuditLog() {
  qs("#ownerAuditSearch")?.addEventListener("input", (event) => {
    APP_STATE.ownerAuditSearch = event.target.value;
    renderActiveDashboardView();
  });
  qs("#dashboardContent").onclick = async (event) => {
    const target = event.target.closest("[data-owner-audit-details]");
    if (!target) return;
    const result = await OwnerAPI.auditLog(target.dataset.ownerAuditDetails);
    openOwnerAuditDetails(result.auditLog);
  };
}

function filterOwnerAuditLogs(logs) {
  const search = (APP_STATE.ownerAuditSearch || "").trim().toLowerCase();
  if (!search) return logs;
  return logs.filter((log) => [log.admin_name, log.admin_role, log.action_type, log.entity_type, log.description].join(" ").toLowerCase().includes(search));
}

function renderOwnerAuditTable(logs) {
  if (!logs.length) return EmptyState("لا توجد سجلات نشاط مطابقة للبحث.", "غيّر معايير البحث لعرض نتائج أخرى.");
  return `
    <div class="table-wrap owner-table-wrap">
      <table>
        <thead><tr><th>المستخدم</th><th>الدور</th><th>نوع الإجراء</th><th>القسم</th><th>التفاصيل</th><th>التاريخ والوقت</th><th>عنوان IP</th><th>الإجراءات</th></tr></thead>
        <tbody>${logs.map((log) => `
          <tr>
            <td>${escapeHTML(log.admin_name || "النظام")}</td><td>${escapeHTML(ROLE_LABELS[log.admin_role] || log.admin_role || "-")}</td><td>${escapeHTML(log.action_type || "-")}</td><td>${escapeHTML(log.entity_type || "-")}</td><td>${escapeHTML(log.description || "-")}</td><td>${formatDateTime(log.created_at)}</td><td>${escapeHTML(log.ip_address || "-")}</td>
            <td><button class="btn ghost small" type="button" data-owner-audit-details="${log.id}">تفاصيل</button></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function openOwnerAuditDetails(log) {
  openModal(`
    <span class="eyebrow">تفاصيل سجل النشاط</span>
    <h2>${escapeHTML(log.description || "إجراء")}</h2>
    <div class="modal-detail-grid">
      ${ownerMetric("المستخدم", log.admin_name || "النظام")}
      ${ownerMetric("الدور", ROLE_LABELS[log.admin_role] || log.admin_role || "-")}
      ${ownerMetric("نوع الإجراء", log.action_type || "-")}
      ${ownerMetric("العنصر", log.entity_type || "-")}
      ${ownerMetric("معرّف العنصر", log.entity_id || "-")}
      ${ownerMetric("التاريخ", formatDateTime(log.created_at))}
    </div>
    <div class="audit-json">
      <strong>القيمة السابقة</strong>
      <pre>${escapeHTML(log.old_value || "-")}</pre>
      <strong>القيمة الجديدة</strong>
      <pre>${escapeHTML(log.new_value || "-")}</pre>
    </div>
  `);
}
