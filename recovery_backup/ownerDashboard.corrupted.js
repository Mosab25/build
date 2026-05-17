const OWNER_DEAL_FILTERS = [
  ["needs_action", "تحتاج إجراء"],
  ["approved", "Ù…عت�…دة"],
  ["finalized", "Ù…Ùƒت�…Ù„ة"],
  ["rejected", "Ù…رف�ˆضة"],
  ["all", "ÙƒÙ„ ا�„ط�„بات"],
];

const OWNER_OPERATION_TABS = [
  ["clients", "ا�„ع�…Ù„اء"],
  ["units", "ا�„ش�‚Ù‚"],
  ["payments", "ا�„Ù…ا�„ÙŠات"],
];

const OWNER_SETTINGS_TABS = [
  ["office", "ب�Šا�†ات ا�„Ù…Ùƒتب"],
  ["pricing", "إعدادات ا�„أسعار"],
  ["permissions", "إعدادات ا�„ص�„اح�Šات"],
  ["accounts", "إدارة ا�„حسابات"],
  ["system", "إعدادات ا�„Ù†ظا�…"],
  ["media", "ا�„Ùˆسائط Ùˆا�„تحد�Šثات"],
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
        <span class="eyebrow">ا�„رئ�Šس�Šة</span>
        <h2>Ù…Ù„خص سر�Šع Ù„Ù„ÙŠÙˆÙ…</h2>
        <p>أ�‡Ù… ا�„أر�‚ا�… Ùˆا�„إجراءات أ�…ا�…Ùƒ Ù…باشرة بد�ˆÙ† ا�„دخ�ˆÙ„ ف�Š تفاص�ŠÙ„ Ùƒث�Šرة.</p>
      </div>
      <button class="btn secondary small" type="button" id="ownerRefreshButton">تحد�Šث ا�„ب�Šا�†ات</button>
    </section>

    <section class="owner-quick-actions" aria-label="اختصارات Ù„Ùˆحة ا�„Ù…ا�„Ùƒ">
      ${OwnerQuickAction("ا�„Ù…Ùˆاف�‚ات", "راجع ا�„د�ŠÙ„ات ا�„Ù…Ù†تظرة", summary.pendingDeals || 0, "approvals", "warning")}
      ${OwnerQuickAction("ا�„ع�…Ù„اء", "افتح Ù…Ù„فات ا�„ع�…Ù„اء Ùˆا�„حج�ˆزات", summary.totalClients || 0, "operations", "clients")}
      ${OwnerQuickAction("ا�„ش�‚Ù‚", "تابع ا�„Ù…تاح Ùˆا�„Ù…حج�ˆز Ùˆا�„Ù…باع", summary.availableApartments || 0, "operations", "units")}
      ${OwnerQuickAction("ا�„Ù…دف�ˆعات", "راجع ا�„تحص�ŠÙ„ Ùˆا�„دفعات ا�„Ù…ع�„Ù‚ة", summary.pendingPayments || 0, "operations", "payments")}
    </section>

    <div class="owner-stat-grid compact">
      ${OwnerStatCard("إج�…ا�„ÙŠ ا�„ش�‚Ù‚", summary.totalApartments)}
      ${OwnerStatCard("Ù…تاحة", summary.availableApartments, { tone: "success" })}
      ${OwnerStatCard("Ù…حج�ˆزة", summary.reservedApartments, { tone: "warning" })}
      ${OwnerStatCard("Ù…باعة", summary.soldApartments)}
    </div>

    <section class="data-panel owner-panel owner-money-summary">
      <div>
        <span class="eyebrow">ا�„Ù…Ù„خص ا�„Ù…ا�„ÙŠ</span>
        <h3>ا�„Ù…ب�Šعات Ùˆا�„تحص�ŠÙ„</h3>
      </div>
      <div class="owner-money-grid">
        ${OwnerMoneyItem("Ù‚ÙŠÙ…ة ا�„Ù…ب�Šعات", summary.totalSales)}
        ${OwnerMoneyItem("ا�„Ù…حص�„", summary.totalCollected, "success")}
        ${OwnerMoneyItem("ا�„Ù…تب�‚ÙŠ", summary.totalRemaining, "danger")}
        ${OwnerMoneyItem("أ�‚ساط Ù…تأخرة", summary.overdueInstallments, "warning", false)}
      </div>
    </section>

    <div class="owner-dashboard-columns">
      <section class="data-panel owner-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">Ù…تابعة ف�ˆر�Šة</span>
            <h3>ت�†ب�ŠÙ‡ات Ù…Ù‡Ù…ة</h3>
          </div>
        </div>
        ${renderOwnerAlerts(alerts)}
      </section>

      <section class="data-panel owner-panel">
        <div class="section-heading">
          <div>
            <span class="eyebrow">سج�„ Ù…ختصر</span>
            <h3>آخر ا�„Ù†شاطات</h3>
          </div>
        </div>
        ${renderOwnerActivityPreview(logs)}
      </section>
    </div>

    <section class="data-panel owner-panel">
      <div class="section-heading">
        <div>
          <span class="eyebrow">فر�ŠÙ‚ ا�„Ù…ب�Šعات</span>
          <h3>Ù…Ù„خص أداء ا�„Ù…ساعد�ŠÙ†</h3>
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
    await refreshCurrentDashboardView();
    showToast("ت�… تحد�Šث ب�Šا�†ات Ù„Ùˆحة ا�„Ù…ا�„Ùƒ.", "success");
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
  if (!alerts.length) return EmptyState("Ù„ا ت�ˆجد ت�†ب�ŠÙ‡ات Ù…Ù‡Ù…ة حا�„ÙŠÙ‹ا.", "س�Šت�… عرض ا�„ت�†ب�ŠÙ‡ات Ù‡Ù†ا ع�†د Ùˆج�ˆد د�ŠÙ„ات أ�ˆ دفعات أ�ˆ أ�‚ساط تحتاج Ù…تابعة.");
  return `<div class="owner-alert-list">${alerts.map((alert) => `
    <article class="owner-alert ${escapeHTML(alert.severity || "info")}">
      <strong>${Number(alert.count || 0).toLocaleString("ar-EG")}</strong>
      <span>${escapeHTML(alert.message)}</span>
    </article>
  `).join("")}</div>`;
}

function renderOwnerActivityPreview(logs) {
  if (!logs.length) return EmptyState("Ù„ا ت�ˆجد Ù†شاطات Ù…سج�„ة حا�„ÙŠÙ‹ا.", "س�Šظ�‡ر Ù‡Ù†ا آخر Ù…ا ÙŠت�… داخ�„ ا�„Ù†ظا�….");
  return `<div class="activity-timeline compact">${logs.map((log) => `
    <article>
      <strong>${escapeHTML(log.description || log.action_type || "إجراء")}</strong>
      <span>${escapeHTML(log.admin_name || "ا�„Ù†ظا�…")} · ${formatDateTime(log.created_at)}</span>
    </article>
  `).join("")}</div>`;
}

function renderAssistantPerformance(items) {
  if (!items.length) return EmptyState("Ù„ا ÙŠÙˆجد Ù…ساعد�ŠÙ† Ù…سج�„ÙŠÙ† حا�„ÙŠÙ‹ا.", "س�Šظ�‡ر Ù…Ù„خص ا�„أداء بعد إضافة حسابات ا�„Ù…ساعد�ŠÙ† Ùˆتسج�ŠÙ„ ا�„د�ŠÙ„ات.");
  return `
    <div class="table-wrap owner-table-wrap">
      <table>
        <thead>
          <tr><th>ا�„اس�…</th><th>عدد ا�„د�ŠÙ„ات</th><th>ا�„Ù…عت�…د</th><th>ا�„Ù…رف�ˆض</th><th>با�†تظار ا�„Ù…Ùˆاف�‚ة</th><th>Ù†سبة ا�„Ù†جاح</th></tr>
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
        <span class="eyebrow">ط�„بات ا�„Ù…Ùˆاف�‚ة</span>
        <h2>Ù…ر�ƒز اعت�…اد ا�„د�ŠÙ„ات</h2>
        <p>راجع ا�„د�ŠÙ„ات ا�„Ù…رس�„ة Ù…Ù† ا�„Ù…ساعد�ŠÙ† Ù‚ب�„ اعت�…اد ا�„حجز Ùˆربط ا�„ع�…ÙŠÙ„ با�„ش�‚ة.</p>
      </div>
    </section>
    <section class="data-panel owner-panel">
      <div class="filter-bar owner-filter-bar">
        <div class="segmented-control">
          ${OWNER_DEAL_FILTERS.map(([key, label]) => `<button type="button" data-owner-deal-filter="${key}" class="${APP_STATE.ownerApprovalFilter === key ? "active" : ""}">${label}</button>`).join("")}
        </div>
        <label class="search-field">
          <span>بحث</span>
          <input id="ownerDealSearch" value="${escapeHTML(APP_STATE.ownerApprovalSearch || "")}" placeholder="اس�… ا�„ع�…ÙŠÙ„ØŒ ا�„Ù…ساعد�Œ ر�‚Ù… ا�„ش�‚ة" />
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
  if (!deals.length) return EmptyState("Ù„ا ت�ˆجد ط�„بات Ù…Ùˆاف�‚ة ف�Š ا�„ÙˆÙ‚ت ا�„حا�„ÙŠ.", "س�Šت�… عرض ا�„د�ŠÙ„ات Ù‡Ù†ا ع�†د إرسا�„Ù‡ا Ù…Ù† ا�„Ù…ساعد�ŠÙ†.");
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
          <h3>${escapeHTML(deal.clientName || "ع�…ÙŠÙ„ غ�Šر Ù…حدد")}</h3>
          <p>${escapeHTML(deal.assistant?.fullName || "بد�ˆÙ† Ù…ساعد")} · ${escapeHTML(deal.clientPhone || "ر�‚Ù… غ�Šر Ù…حدد")}</p>
        </div>
        ${StatusBadge(deal.status)}
      </header>
      <div class="deal-metrics">
        ${ownerMetric("ر�‚Ù… ا�„ش�‚ة", apt.unitCode || "-")}
        ${ownerMetric("ا�„د�ˆر", apt.floorNumber || "-")}
        ${ownerMetric("ا�„Ù…ساحة", apt.area ? `${apt.area}Ù…` : "-")}
        ${ownerMetric("ا�„اتجا�‡", apt.directionAr || "-")}
        ${ownerMetric("ا�„سعر ا�„Ù…Ù‚ترح", formatMoney(deal.proposedTotal), true)}
        ${ownerMetric("ا�„Ù…Ù‚د�…", deal.downPayment ? formatMoney(deal.downPayment) : "غ�Šر Ù…حدد", true)}
        ${ownerMetric("ا�„Ù…تب�‚ÙŠ", formatMoney(deal.remainingAmount), true)}
        ${ownerMetric("تار�Šخ ا�„إرسا�„", formatDate(deal.submittedAt || deal.createdAt))}
      </div>
      <div class="deal-note-grid">
        <p><strong>خطة ا�„سداد:</strong> ${escapeHTML(deal.paymentPlan || "غ�Šر Ù…حددة")}</p>
        <p><strong>Ù…Ù„احظات ا�„Ù…ساعد:</strong> ${escapeHTML(deal.notes || "Ù„ا ت�ˆجد Ù…Ù„احظات.")}</p>
        <p><strong>Ù…Ù„احظات ا�„Ù…ا�„Ùƒ:</strong> ${escapeHTML(deal.ownerNotes || "Ù„ا ت�ˆجد Ù…Ù„احظات.")}</p>
      </div>
      <div class="risk-review">
        <strong>Ù…راجعة Ù…خاطر ا�„د�ŠÙ„</strong>
        ${risks.length ? `<div class="risk-list">${risks.map((risk) => `<span class="risk-badge ${escapeHTML(risk.severity)}">${escapeHTML(risk.message)}</span>`).join("")}</div>` : `<span class="risk-badge success">Ù„ا ت�ˆجد Ù…خاطر Ùˆاضحة حسب ا�„إعدادات ا�„حا�„ÙŠة.</span>`}
      </div>
      <footer>
        <button class="btn secondary small" type="button" data-owner-deal-details="${deal.id}">عرض ا�„تفاص�ŠÙ„</button>
        <button class="btn ghost small" type="button" data-owner-deal-edit="${deal.id}">تعد�ŠÙ„ ا�„د�ŠÙ„</button>
        ${deal.status === "pending_approval" ? `
          <button class="btn primary small" type="button" data-owner-deal-approve="${deal.id}">ا�„Ù…Ùˆاف�‚ة</button>
          <button class="btn secondary small" type="button" data-owner-deal-revision="${deal.id}">ط�„ب تعد�ŠÙ„</button>
          <button class="btn danger small" type="button" data-owner-deal-reject="${deal.id}">رفض</button>
        ` : ""}
        ${deal.status === "draft" ? `<button class="btn danger small" type="button" data-owner-deal-delete="${deal.id}">حذف ا�„Ù…س�ˆدة</button>` : ""}
        ${!["cancelled", "rejected"].includes(deal.status) ? `<button class="btn danger small" type="button" data-owner-deal-cancel="${deal.id}">إ�„غاء ا�„د�ŠÙ„</button>` : ""}
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
      if (!confirm("Ù‡Ù„ أ�†ت Ù…تأ�ƒد Ù…Ù† حذف Ù…س�ˆدة ا�„د�ŠÙ„ØŸ")) return;
      await OwnerAPI.deleteDraftDeal(dealId);
      showToast("ت�… حذف Ù…س�ˆدة ا�„د�ŠÙ„ ب�†جاح.", "success");
    }
    if (target.dataset.ownerDealApprove) {
      if (!confirm("Ù‡Ù„ أ�†ت Ù…تأ�ƒد Ù…Ù† ا�„Ù…Ùˆاف�‚ة ع�„Ù‰ Ù‡ذا ا�„د�ŠÙ„ØŸ")) return;
      await OwnerAPI.approveDeal(dealId);
      showToast("ت�…ت ا�„Ù…Ùˆاف�‚ة ع�„Ù‰ ا�„د�ŠÙ„ ب�†جاح.", "success");
    }
    if (target.dataset.ownerDealReject) {
      const reason = prompt("ا�ƒتب سبب رفض ا�„د�ŠÙ„:");
      if (!reason) return;
      await OwnerAPI.rejectDeal(dealId, reason);
      showToast("ت�… رفض ا�„د�ŠÙ„ Ùˆتسج�ŠÙ„ ا�„سبب.", "success");
    }
    if (target.dataset.ownerDealRevision) {
      const notes = prompt("ا�ƒتب Ù…Ù„احظات ا�„تعد�ŠÙ„ ا�„Ù…ط�„Ùˆبة:");
      if (!notes) return;
      await OwnerAPI.requestRevision(dealId, notes);
      showToast("ت�… إرسا�„ ط�„ب ا�„تعد�ŠÙ„ إ�„Ù‰ ا�„Ù…ساعد.", "success");
    }
    await refreshDashboardKeys(["ownerDeals", "ownerClients", "ownerApartments"], { summary: true, loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„د�ŠÙ„ات..." });
  } catch (error) {
    showToast(error.message || "حدث خطأ أث�†اء ت�†ف�Šذ ا�„ع�…Ù„ÙŠة.", "error");
  }
}

function openOwnerDealDetails(dealId) {
  const deal = (ownerData().deals || []).find((item) => item.id === dealId);
  if (!deal) return;
  openModal(`
    <span class="eyebrow">تفاص�ŠÙ„ ا�„د�ŠÙ„</span>
    <h2>${escapeHTML(deal.clientName)}</h2>
    <div class="modal-detail-grid">
      ${ownerMetric("ر�‚Ù… ا�„د�ŠÙ„", deal.id)}
      ${ownerMetric("ا�„Ù…ساعد", deal.assistant?.fullName || "-")}
      ${ownerMetric("ر�‚Ù… ا�„Ù‡اتف", deal.clientPhone || "-")}
      ${ownerMetric("ا�„Ùˆحدة", deal.apartment?.unitCode || "-")}
      ${ownerMetric("ا�„سعر ا�„Ù…Ù‚ترح", formatMoney(deal.proposedTotal))}
      ${ownerMetric("ا�„Ù…Ù‚د�…", deal.downPayment ? formatMoney(deal.downPayment) : "غ�Šر Ù…حدد")}
      ${ownerMetric("ا�„Ù…تب�‚ÙŠ", formatMoney(deal.remainingAmount))}
      ${ownerMetric("ا�„حا�„ة", statusLabel(deal.status))}
    </div>
    <div class="risk-review">
      <strong>Ù…راجعة Ù…خاطر ا�„د�ŠÙ„</strong>
      ${(deal.riskWarnings || []).length ? `<div class="risk-list">${deal.riskWarnings.map((risk) => `<span class="risk-badge ${escapeHTML(risk.severity)}">${escapeHTML(risk.message)}</span>`).join("")}</div>` : `<span class="risk-badge success">Ù„ا ت�ˆجد Ù…خاطر Ùˆاضحة.</span>`}
    </div>
  `);
}

function openOwnerDealEdit(dealId) {
  const deal = (ownerData().deals || []).find((item) => item.id === dealId);
  if (!deal) return;
  const apartments = ownerData().apartments || [];
  openModal(`
    <span class="eyebrow">تعد�ŠÙ„ ا�„د�ŠÙ„</span>
    <h2>${escapeHTML(deal.clientName)}</h2>
    <form id="ownerDealEditForm" class="form-grid">
      <div class="form-field"><label>اس�… ا�„ع�…ÙŠÙ„</label><input name="client_name" value="${escapeHTML(deal.clientName || "")}" required /></div>
      <div class="form-field"><label>ر�‚Ù… ا�„Ù‡اتف</label><input name="client_phone" value="${escapeHTML(deal.clientPhone || "")}" /></div>
      <div class="form-field full"><label>ا�„ش�‚ة</label><select name="apartment_id">${apartments.map((apt) => `<option value="${apt.id}" ${apt.id === deal.apartmentId ? "selected" : ""}>${escapeHTML(apt.unitCode)} · ${apt.area}Ù… · ${escapeHTML(apt.directionAr)}</option>`).join("")}</select></div>
      <div class="form-field"><label>ا�„سعر ا�„Ù…Ù‚ترح</label><input name="proposed_total" value="${Number(deal.proposedTotal || 0)}" inputmode="numeric" required /></div>
      <div class="form-field"><label>ا�„Ù…Ù‚د�…</label><input name="down_payment" value="${Number(deal.downPayment || 0)}" inputmode="numeric" /></div>
      <div class="form-field full"><label>خطة ا�„سداد</label><textarea name="payment_plan">${escapeHTML(deal.paymentPlan || "")}</textarea></div>
      <div class="form-field full"><label>Ù…Ù„احظات</label><textarea name="notes">${escapeHTML(deal.notes || "")}</textarea></div>
      <button class="btn primary full" type="submit">حفظ ا�„تعد�ŠÙ„ات</button>
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
      showToast("ت�… حفظ ا�„تغ�ŠÙŠرات ب�†جاح.", "success");
      await refreshDashboardKeys(["ownerDeals", "ownerApartments"], { summary: true, loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„د�ŠÙ„ات..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function renderOwnerOperations() {
  return `
    <section class="owner-hero-panel">
      <div>
        <span class="eyebrow">ا�„تشغ�ŠÙ„</span>
        <h2>ا�„ع�…Ù„اء Ùˆا�„ش�‚Ù‚ Ùˆا�„Ù…دف�ˆعات</h2>
        <p>اختر ا�„Ù‚س�… ا�„Ù…ط�„Ùˆب ف�‚ط. ÙƒÙ„ Ù‚س�… ÙŠعرض ب�Šا�†ات�‡ بد�ˆÙ† تشت�Šت.</p>
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
        <span class="eyebrow">ا�„ش�‚Ù‚</span>
        <h3>ا�„خر�Šطة Ùˆا�„Ù‚ائ�…ة ف�Š Ù…Ùƒا�† Ùˆاحد</h3>
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
      groups.set(key, {
        ...client,
        ids: [],
        units: [],
        apartments: [],
        financialClientIds: new Set(),
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        paymentStatuses: [],
      });
    }
    const group = groups.get(key);
    group.ids.push(client.id);
    const apartments = normalizedClientApartments(client);
    group.units.push(...(apartments.length ? apartments.map((apt) => apt.unitCode || "-") : ["-"]));
    apartments.forEach((apt) => {
      if (!group.apartments.some((item) => item.clientId === apt.clientId && item.id === apt.id)) {
        group.apartments.push(apt);
      }
    });
    if (!group.financialClientIds.has(client.id)) {
      group.financialClientIds.add(client.id);
      group.totalAmount += Number(client.totalAmount || 0);
      group.paidAmount += Number(client.paidAmount || 0);
      group.remainingAmount += Number(client.remainingAmount || 0);
      group.paymentStatuses.push(client.paymentStatus || "Pending");
    }
  }
  for (const group of groups.values()) {
    const states = group.paymentStatuses.map((status) => String(status || "").toLowerCase());
    if (states.includes("overdue")) group.paymentStatus = "Overdue";
    else if (states.length && states.every((status) => status === "fully paid" || status === "fully_paid")) group.paymentStatus = "Fully Paid";
    else if (states.some((status) => status === "partially paid" || status === "partially_paid" || status === "fully paid" || status === "fully_paid")) group.paymentStatus = "Partially Paid";
    else group.paymentStatus = "Pending";
  }
  return Array.from(groups.values());
}

function ownerClientActionContext(clientIds, clientName = "") {
  const ids = (clientIds || []).map((id) => String(id).trim()).filter(Boolean);
  const clients = (ownerData().clients || []).filter((client) => ids.includes(client.id));
  const primary = clients[0];
  const apartments = [];
  clients.forEach((client) => {
    normalizedClientApartments(client).forEach((apt) => {
      if (!apartments.some((item) => item.clientId === apt.clientId && item.id === apt.id)) {
        apartments.push(apt);
      }
    });
  });
  return {
    ids,
    primaryId: primary?.id || ids[0],
    name: primary?.name || clientName || "",
    phone: primary?.phone || "",
    code: primary?.code || primary?.portfolioCode || "",
    apartments,
  };
}

function renderOwnerClientsTable() {
  const clients = ownerClientGroups();
  if (!clients.length) return EmptyState("لا توجد بيانات عملاء حاليًا.", "سيتم عرض العملاء فور إضافة حجوزات أو اعتماد ديلات.");

  const mobileCards = clients.map((client) => {
    const apartments = normalizedClientApartments(client);
    const units = apartments.map((apt) => apt.unitCode || "-").join("، ") || "-";
    return `
      <article class="mobile-client-card">
        <div class="mobile-client-header">
          <h4>${escapeHTML(client.name || "-")}</h4>
          <div class="mobile-client-code">${escapeHTML(client.code || "-")}</div>
        </div>
        <div class="mobile-client-meta">
          <div><span>الهاتف</span><strong>${escapeHTML(client.phone || "-")}</strong></div>
          <div><span>الشقق</span><strong>${escapeHTML(units)}</strong></div>
        </div>
        <div class="mobile-client-financials">
          <div><span>الإجمالي</span><strong>${formatMoney(client.totalAmount)}</strong></div>
          <div><span>المدفوع</span><strong>${formatMoney(client.paidAmount)}</strong></div>
          <div><span>المتبقي</span><strong>${formatMoney(client.remainingAmount)}</strong></div>
        </div>
        <div class="mobile-client-statuses">
          <div><span>حالة الحجز</span>${StatusBadge(client.reservationStatus)}</div>
          <div><span>حالة الدفع</span>${StatusBadge(client.paymentStatus)}</div>
        </div>
        <div class="mobile-client-actions">
          <button class="btn ghost small" type="button" data-owner-client-profile="${client.code}">عرض الملف</button>
          <button class="btn primary small" type="button" data-owner-client-payment="${client.code}">إضافة دفعة</button>
          <button class="btn ghost small" type="button" data-owner-client-more="${client.ids.join(",")}" data-client-name="${escapeHTML(client.name)}">المزيد</button>
        </div>
      </article>
    `;
  }).join("");

  return `
    <div class="section-heading"><h3>العملاء</h3></div>
    <div class="desktop-clients-table table-wrap owner-table-wrap">
      <table>
        <thead><tr><th>اسم العميل</th><th>كود الحجز</th><th>رقم الهاتف</th><th>الشقق</th><th>السعر الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحجز</th><th>الدفع</th><th>الإجراءات</th></tr></thead>
        <tbody>${clients.map((client) => {
          const apartments = normalizedClientApartments(client);
          const units = apartments.map((apt) => apt.unitCode || "-").join("، ") || "-";
          return `
          <tr>
            <td data-label="اسم العميل">${escapeHTML(client.name)}</td>
            <td data-label="كود الحجز">${escapeHTML(client.code)}</td>
            <td data-label="رقم الهاتف">${escapeHTML(client.phone || "-")}</td>
            <td data-label="الشقق">${escapeHTML(units)}</td>
            <td data-label="السعر الإجمالي" data-money>${formatMoney(client.totalAmount)}</td>
            <td data-label="المدفوع" data-money>${formatMoney(client.paidAmount)}</td>
            <td data-label="المتبقي" data-money>${formatMoney(client.remainingAmount)}</td>
            <td data-label="الحجز">${StatusBadge(client.reservationStatus)}</td>
            <td data-label="الدفع">${StatusBadge(client.paymentStatus)}</td>
            <td data-label="الإجراءات" class="table-actions">
              <button class="btn ghost small" type="button" data-owner-client-profile="${client.code}">عرض الملف</button>
              <button class="btn primary small" type="button" data-owner-client-payment="${client.code}">إضافة دفعة</button>
              <button class="btn ghost small" type="button" data-owner-client-more="${client.ids.join(",")}" data-client-name="${escapeHTML(client.name)}">المزيد</button>
            </td>
          </tr>
        `;
        }).join("")}</tbody>
      </table>
    </div>
    <div class="mobile-clients-list">${mobileCards}</div>
  `;
}

function renderOwnerApartmentsTable() {
  const apartments = ownerData().apartments || [];
  if (!apartments.length) return EmptyState("Ù„ا ت�ˆجد ش�‚Ù‚ ب�‡ذ�‡ ا�„حا�„ة.", "س�Šت�… عرض ا�„Ùˆحدات ف�ˆر ت�ˆفر�‡ا ف�Š ا�„Ù†ظا�….");
  return `
    <div class="section-heading"><h3>ا�„ش�‚Ù‚</h3></div>
    <div class="table-wrap owner-table-wrap">
      <table>
        <thead><tr><th>ر�‚Ù… ا�„ش�‚ة</th><th>ا�„د�ˆر</th><th>ا�„Ù†Ùˆع</th><th>ا�„Ù…ساحة</th><th>ا�„اتجا�‡</th><th>ا�„سعر</th><th>ا�„حا�„ة</th><th>ا�„ع�…ÙŠÙ„ ا�„Ù…رتبط</th><th>ا�„Ù…دف�ˆع</th><th>ا�„Ù…تب�‚ÙŠ</th><th>ا�„إجراءات</th></tr></thead>
        <tbody>${apartments.map((apt) => {
          const client = (ownerData().clients || []).find((item) => item.apartmentId === apt.id);
          return `
            <tr>
              <td data-label="ر�‚Ù… ا�„ش�‚ة">${escapeHTML(apt.unitCode)}</td><td data-label="ا�„د�ˆر">${apt.floorNumber}</td><td data-label="ا�„Ù†Ùˆع">${escapeHTML(apt.apartmentType)}</td><td data-label="ا�„Ù…ساحة">${apt.area}Ù…</td><td data-label="ا�„اتجا�‡">${escapeHTML(apt.directionAr)}</td><td data-label="ا�„سعر" data-money>${formatMoney(apt.price)}</td><td data-label="ا�„حا�„ة">${StatusBadge(apt.status)}</td>
              <td data-label="ا�„ع�…ÙŠÙ„ ا�„Ù…رتبط">${escapeHTML(client?.name || "-")}</td><td data-label="ا�„Ù…دف�ˆع" data-money>${formatMoney(client?.paidAmount || 0)}</td><td data-label="ا�„Ù…تب�‚ÙŠ" data-money>${formatMoney(client?.remainingAmount || 0)}</td>
              <td data-label="ا�„إجراءات" class="table-actions"><button class="btn ghost small" data-owner-apartment-edit="${apt.id}" type="button">تعد�ŠÙ„ / حجز</button><button class="btn ghost small" data-owner-apartment-history="${apt.id}" type="button">سج�„ ا�„Ùˆحدة</button></td>
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
    <div class="section-heading"><h3>خر�Šطة ا�„ش�‚Ù‚</h3><span>٧ أد�ˆار · ٢١ Ùˆحدة · ث�„اثة Ù†Ù…اذج Ùˆاضحة Ù„ÙƒÙ„ د�ˆر</span></div>
    <div class="owner-building-map">
      ${floors.map((floor) => `
        <div class="owner-floor-row">
          <div class="owner-floor-label">ا�„د�ˆر ${floor}</div>
          ${["A", "B", "C"].map((type) => {
            const apt = apartments.find((item) => item.floorNumber === floor && item.apartmentType === type);
            const client = apt ? (ownerData().clients || []).find((item) => item.apartmentId === apt.id) : null;
            const progress = Number(client?.paymentProgress ?? client?.payment_progress ?? 0);
            return apt ? `
              <button type="button" class="owner-unit-card status-${statusClass(apt.status)}" data-owner-apartment-edit="${apt.id}">
                <header><strong>${escapeHTML(apt.unitCode)}</strong>${StatusBadge(apt.status)}</header>
                <p>${apt.area}Ù… · ${escapeHTML(apt.directionAr)}</p>
                <small>${escapeHTML(client?.name || "بد�ˆÙ† ع�…ÙŠÙ„ Ù…رتبط")}</small>
                <div class="mini-finance"><span>${formatMoney(client?.paidAmount || 0)}</span><span>${formatMoney(client?.remainingAmount || 0)}</span></div>
                ${ProgressBar(progress)}
                <em>${StatusBadge(client?.paymentStatus || "Pending")}</em>
              </button>
            ` : `<div class="owner-unit-card muted">غ�Šر Ù…تاحة</div>`;
          }).join("")}
        </div>
      `).join("")}
    </div>
  `;
}

function renderOwnerPaymentsTable() {
  const payments = ownerData().payments || [];
  if (!payments.length) return EmptyState("Ù„ا ت�ˆجد Ù…دف�ˆعات Ù…سج�„ة حا�„ÙŠÙ‹ا.", "س�Šت�… عرض ا�„Ù…دف�ˆعات ف�ˆر إضافت�‡ا.");
  return `
    <div class="section-heading"><h3>ا�„Ù…دف�ˆعات</h3></div>
    <div class="table-wrap owner-table-wrap">
      <table>
        <thead><tr><th>اس�… ا�„ع�…ÙŠÙ„</th><th>ر�‚Ù… ا�„ش�‚ة</th><th>تار�Šخ ا�„دفع</th><th>ا�„Ù…ب�„غ</th><th>طر�ŠÙ‚ة ا�„دفع</th><th>حا�„ة ا�„دفعة</th><th>ر�‚Ù… ا�„إ�Šصا�„</th><th>ا�„إجراءات</th></tr></thead>
        <tbody>${payments.map((payment) => {
          const client = (ownerData().clients || []).find((item) => item.id === payment.clientId);
          const apt = (ownerData().apartments || []).find((item) => item.id === payment.apartmentId);
          return `
            <tr>
              <td data-label="اس�… ا�„ع�…ÙŠÙ„">${escapeHTML(client?.name || "-")}</td><td data-label="ر�‚Ù… ا�„ش�‚ة">${escapeHTML(apt?.unitCode || "-")}</td><td data-label="تار�Šخ ا�„دفع">${formatDate(payment.date)}</td><td data-label="ا�„Ù…ب�„غ" data-money>${formatMoney(payment.amount)}</td><td data-label="طر�ŠÙ‚ة ا�„دفع">${escapeHTML(statusLabel(payment.method))}</td><td data-label="حا�„ة ا�„دفعة">${StatusBadge(payment.status)}</td><td data-label="ر�‚Ù… ا�„إ�Šصا�„">${escapeHTML(payment.receiptNumber || payment.reference || "-")}</td>
              <td data-label="ا�„إجراءات" class="table-actions"><button class="btn ghost small" data-owner-payment-view="${payment.id}" type="button">عرض</button><button class="btn ghost small" data-owner-payment-receipt="${payment.id}" type="button">إ�Šصا�„</button></td>
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
    if (target.dataset.ownerClientMore) {
      event.stopPropagation();
      const ids = target.dataset.ownerClientMore.split(",").filter(Boolean);
      return openOwnerClientMoreMenu(target, ids, target.dataset.clientName);
    }
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
    showToast(error.message || "حدث خطأ أث�†اء ت�†ف�Šذ ا�„ع�…Ù„ÙŠة.", "error");
  }
}

function openOwnerClientMoreMenu(button, clientIds, clientName) {
  const context = ownerClientActionContext(clientIds, clientName);
  if (!context.primaryId) return;
  qsa(".client-more-dropdown").forEach((dropdown) => dropdown.remove());

  const dropdown = document.createElement("div");
  dropdown.className = "client-more-dropdown";
  dropdown.style.position = "absolute";

  const rect = button.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
  dropdown.style.left = `${rect.left + window.scrollX}px`;
  dropdown.innerHTML = `
    <button class="dropdown-item" data-action="add-unit" type="button">إضافة ش�‚ة</button>
    ${context.apartments.length > 0 ? `
      <button class="dropdown-item" data-action="edit-price" type="button">تعد�ŠÙ„ سعر ش�‚ة</button>
    ` : ""}
    <button class="dropdown-item" data-action="statement" type="button">Ùƒشف ا�„حجز</button>
    <button class="dropdown-item" data-action="whatsapp" type="button">Ùˆاتساب</button>
    <hr class="dropdown-separator">
    <button class="dropdown-item danger" data-action="cancel" type="button">إ�„غاء ا�„حجز</button>
  `;
  document.body.appendChild(dropdown);

  dropdown.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", (event) => {
      event.stopPropagation();
      const action = item.dataset.action;
      dropdown.remove();
      if (action === "add-unit") openClientFormForExistingClient(context.primaryId);
      else if (action === "edit-price") {
        const firstApartment = context.apartments[0];
        openApartmentPriceEditModal(firstApartment.clientId || context.primaryId, firstApartment.id, firstApartment.unitCode, firstApartment.price, context.name, context.apartments);
      }
      else if (action === "statement") downloadFile(ClientAPI.statementUrl(context.primaryId, context.code));
      else if (action === "whatsapp") openOwnerWhatsapp(context.phone);
      else if (action === "cancel") cancelOwnerClientGroup(context.ids.join(","), context.name);
    });
  });
}

function openOwnerClientProfile(code) {
  const client = ownerClientGroups().find((item) => item.code === code);
  if (!client) return;
  openModal(`
    <span class="eyebrow">Ù…Ù„ف ا�„ع�…ÙŠÙ„</span>
    <h2>${escapeHTML(client.name)}</h2>
    <div class="modal-detail-grid">
      ${ownerMetric("ÙƒÙˆد ا�„حجز", client.code)}
      ${ownerMetric("ر�‚Ù… ا�„Ù‡اتف", client.phone || "-")}
      ${ownerMetric("ا�„Ùˆحدات", client.units.join("ØŒ "))}
      ${ownerMetric("ا�„سعر ا�„إج�…ا�„ÙŠ", formatMoney(client.totalAmount))}
      ${ownerMetric("ا�„Ù…دف�ˆع", formatMoney(client.paidAmount))}
      ${ownerMetric("ا�„Ù…تب�‚ÙŠ", formatMoney(client.remainingAmount))}
      ${ownerMetric("حا�„ة ا�„حجز", statusLabel(client.reservationStatus))}
      ${ownerMetric("حا�„ة ا�„دفع", statusLabel(client.paymentStatus))}
    </div>
    <p class="owner-modal-note"><strong>Ù…Ù„احظات داخ�„ÙŠة:</strong> ${escapeHTML(client.officeNotes || "Ù„ا ت�ˆجد Ù…Ù„احظات.")}</p>
    <div class="contact-actions">
      <button class="btn primary" type="button" data-profile-payment="${escapeHTML(client.code)}">إضافة دفعة</button>
      <button class="btn secondary" type="button" data-profile-add-unit="${escapeHTML(client.id)}">إضافة ش�‚ة</button>
      <button class="btn ghost" type="button" data-profile-statement="${escapeHTML(client.id)}" data-client-code="${escapeHTML(client.code)}">Ùƒشف حساب</button>
      <button class="btn ghost" type="button" data-profile-whatsapp="${escapeHTML(client.phone || "")}">Ùˆاتساب</button>
      <button class="btn danger" type="button" data-profile-cancel="${escapeHTML(client.ids.join(","))}" data-client-name="${escapeHTML(client.name)}">إ�„غاء ا�„حجز</button>
    </div>
  `);
  qs("[data-profile-payment]")?.addEventListener("click", (event) => openOwnerClientPayment(event.currentTarget.dataset.profilePayment));
  qs("[data-profile-add-unit]")?.addEventListener("click", (event) => openClientFormForExistingClient(event.currentTarget.dataset.profileAddUnit));
  qs("[data-profile-statement]")?.addEventListener("click", (event) => downloadFile(ClientAPI.statementUrl(event.currentTarget.dataset.profileStatement, event.currentTarget.dataset.clientCode)));
  qs("[data-profile-whatsapp]")?.addEventListener("click", (event) => openOwnerWhatsapp(event.currentTarget.dataset.profileWhatsapp));
  qs("[data-profile-cancel]")?.addEventListener("click", (event) => cancelOwnerClientGroup(event.currentTarget.dataset.profileCancel, event.currentTarget.dataset.clientName));
}

async function cancelOwnerClientGroup(clientIds, clientName) {
  const ids = (clientIds || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!ids.length) return;
  const reason = prompt(`ا�ƒتب سبب إ�„غاء حجز ا�„ع�…ÙŠÙ„ "${clientName || ""}":`);
  if (!reason) return;
  try {
    for (const id of ids) {
      await AdminAPI.cancelClient(id, reason);
    }
    closeModal();
    showToast("ت�… إ�„غاء ا�„حجز Ùˆتحر�Šر ا�„ش�‚ة ب�†جاح.", "success");
    await refreshClientsAfterChange({ loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„ع�…Ù„اء..." });
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteOwnerClientGroup(clientIds, clientName) {
  const ids = (clientIds || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!ids.length) return;
  openModal(`
    <span class="eyebrow">حذف ا�„ع�…ÙŠÙ„</span>
    <h2>${escapeHTML(clientName || "ع�…ÙŠÙ„")}</h2>
    <p class="muted">اختر إ�„غاء ا�„حجز Ù„Ù„احتفاظ با�„سج�„ ا�„Ù…ا�„ÙŠØŒ أ�ˆ حذف ا�„ع�…ÙŠÙ„ Ù…ع سج�„Ù‡ ا�„Ù…ا�„ÙŠ بعد تأ�ƒÙŠد ÙƒÙ„Ù…ة ا�„Ù…ر�ˆر.</p>
    <form id="ownerClientDeleteChoiceForm" class="form-grid" autocomplete="off">
      <div class="form-field full"><label for="clientDeleteReason">سبب ا�„إجراء</label><textarea id="clientDeleteReason" required></textarea></div>
      <div class="form-field full"><label for="clientDeletePassword">ÙƒÙ„Ù…ة ا�„Ù…ر�ˆر Ù…ط�„Ùˆبة Ù„Ù„حذف با�„سج�„ ا�„Ù…ا�„ÙŠ ف�‚ط</label><input id="clientDeletePassword" type="password" autocomplete="current-password" /></div>
      <button class="btn secondary" type="button" id="cancelClientReservationButton">إ�„غاء ا�„حجز</button>
      <button class="btn danger" type="button" id="deleteClientWithRecordsButton">حذف با�„سج�„ ا�„Ù…ا�„ÙŠ</button>
      <button class="btn ghost full" type="button" id="backFromClientDeleteButton">تراجع</button>
    </form>
  `);
  qs("#backFromClientDeleteButton")?.addEventListener("click", closeModal);
  qs("#cancelClientReservationButton")?.addEventListener("click", async () => {
    const reason = qs("#clientDeleteReason").value.trim();
    if (!reason) return showToast("سبب ا�„إجراء Ù…ط�„Ùˆب.", "error");
    try {
      for (const id of ids) {
        await AdminAPI.cancelClient(id, reason);
      }
      closeModal();
      showToast("ت�… إ�„غاء ا�„حجز Ùˆتحر�Šر ا�„ش�‚ة ب�†جاح.", "success");
      await refreshClientsAfterChange({ loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„ع�…Ù„اء..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
  qs("#deleteClientWithRecordsButton")?.addEventListener("click", async () => {
    const reason = qs("#clientDeleteReason").value.trim();
    const password = qs("#clientDeletePassword").value;
    if (!reason) return showToast("سبب ا�„إجراء Ù…ط�„Ùˆب.", "error");
    if (!password) return showToast("ÙŠرج�‰ إدخا�„ ÙƒÙ„Ù…ة ا�„Ù…ر�ˆر Ù„تأ�ƒÙŠد ا�„حذف.", "error");
    if (!confirm("س�Šت�… حذف ا�„ع�…ÙŠÙ„ Ùˆسج�„Ù‡ ا�„Ù…ا�„ÙŠ Ù†Ù‡ائ�ŠÙ‹ا. Ù‡Ù„ أ�†ت Ù…تأ�ƒد�Ÿ")) return;
    try {
      for (const id of ids) {
        await AdminAPI.deleteClientWithRecords(id, { reason, password });
      }
      closeModal();
      showToast("ت�… حذف ا�„ع�…ÙŠÙ„ Ù…ع ا�„سج�„ ا�„Ù…ا�„ÙŠ ب�†جاح.", "success");
      await refreshClientsAfterChange({ loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„ع�…Ù„اء..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function openOwnerClientPayment(code) {
  const candidates = (ownerData().clients || []).filter((client) => client.code === code || client.portfolioCode === code);
  const selected = candidates.find((client) => Number(client.remainingAmount || 0) > 0) || candidates[0];
  if (!selected) return showToast("Ù„ا ÙŠÙˆجد Ù…Ù„ف ع�…ÙŠÙ„ صا�„ح Ù„إضافة دفعة.", "error");
  openPaymentForm(selected.id);
}

function openOwnerWhatsapp(phone) {
  const target = (phone || APP_CONFIG.whatsappNumber || "").replace(/[^\d]/g, "");
  if (!target) return showToast("Ù„ا ÙŠÙˆجد ر�‚Ù… Ùˆاتساب Ù…تاح.", "error");
  window.open(`https://wa.me/${target}`, "_blank", "noopener");
}

function openOwnerApartmentEdit(apartmentId) {
  const apt = (ownerData().apartments || []).find((item) => item.id === apartmentId);
  if (!apt) return;
  const linkedClient = (ownerData().clients || []).find((client) => client.apartmentId === apartmentId && client.reservationStatus !== "Cancelled");
  const canCreateReservation = !linkedClient;
  openModal(`
    <span class="eyebrow">تعد�ŠÙ„ أ�ˆ حجز ا�„ش�‚ة</span>
    <h2>${escapeHTML(apt.unitCode)}</h2>
    <form id="ownerApartmentForm" class="form-grid">
      <div class="form-field"><label>ا�„سعر</label><input name="price" value="${Number(apt.price || 0)}" inputmode="numeric" required /></div>
      <div class="form-field"><label>ا�„حا�„ة</label><select name="status">
        ${["available", "pending_payment", "reserved", "sold", "frozen"].map((status) => `<option value="${status}" ${statusLabel(apt.status) === statusLabel(status) ? "selected" : ""}>${statusLabel(status)}</option>`).join("")}
      </select></div>
      ${linkedClient ? `
        <div class="owner-linked-client full">
          <span>ا�„ع�…ÙŠÙ„ ا�„Ù…رتبط</span>
          <strong>${escapeHTML(linkedClient.name || "-")}</strong>
          <small>ÙƒÙˆد ا�„حجز: ${escapeHTML(linkedClient.code || linkedClient.reservationCode || "-")}</small>
        </div>
      ` : `
        <div class="owner-reservation-fields full" id="ownerReservationFields">
          <div class="owner-inline-title">
            <strong>حجز ا�„ش�‚ة Ù„ع�…ÙŠÙ„</strong>
            <span>ا�…Ù„أ Ù‡ذ�‡ ا�„ب�Šا�†ات ع�†د تغ�ŠÙŠر ا�„حا�„ة إ�„Ù‰ Ù…حج�ˆزة أ�ˆ Ù…باعة.</span>
          </div>
          <div class="form-grid">
            <div class="form-field"><label>اس�… ا�„ع�…ÙŠÙ„</label><input name="client_name" autocomplete="off" /></div>
            <div class="form-field"><label>ر�‚Ù… ا�„Ù‡اتف</label><input name="client_phone" autocomplete="off" /></div>
            <div class="form-field"><label>ا�„بر�Šد ا�„إ�„Ùƒتر�ˆÙ†ÙŠ</label><input name="client_email" type="email" autocomplete="off" /></div>
            <div class="form-field"><label>ا�„ر�‚Ù… ا�„Ù‚ÙˆÙ…ÙŠ</label><input name="national_id" autocomplete="off" /></div>
            <div class="form-field full"><label>Ù…Ù„احظات ا�„ع�…ÙŠÙ„</label><textarea name="client_notes"></textarea></div>
          </div>
        </div>
      `}
      <div class="form-field full"><label>Ù…Ù„احظات</label><textarea name="notes">${escapeHTML(apt.notes || "")}</textarea></div>
      <button class="btn primary full" type="submit">حفظ ا�„تغ�ŠÙŠرات</button>
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
          throw new Error("اس�… ا�„ع�…ÙŠÙ„ Ù…ط�„Ùˆب ع�†د حجز ا�„ش�‚ة.");
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
        showToast(`ت�… حجز ا�„ش�‚ة Ù„Ù„ع�…ÙŠÙ„. ÙƒÙˆد ا�„حجز: ${createdClient.code}`, "success");
        openOwnerReservationCreated(createdClient);
      } else {
        showToast("ت�… حفظ ا�„تغ�ŠÙŠرات ب�†جاح.", "success");
      }
      await refreshDashboardKeys(createdClient ? ["ownerClients", "ownerApartments"] : ["ownerApartments"], { summary: true, loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„ش�‚Ù‚..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function openOwnerReservationCreated(client) {
  openModal(`
    <span class="eyebrow">ت�… إ�†شاء ا�„حجز</span>
    <h2>${escapeHTML(client.name)}</h2>
    <div class="modal-detail-grid">
      ${ownerMetric("ÙƒÙˆد ا�„حجز Ù„Ù„ع�…ÙŠÙ„", client.code)}
      ${ownerMetric("ا�„ش�‚ة", client.apartment?.unitCode || "-")}
      ${ownerMetric("ا�„سعر ا�„إج�…ا�„ÙŠ", formatMoney(client.totalAmount))}
      ${ownerMetric("حا�„ة ا�„حجز", statusLabel(client.reservationStatus))}
    </div>
    <p class="owner-modal-note">أرس�„ Ù‡ذا ا�„ÙƒÙˆد Ù„Ù„ع�…ÙŠÙ„ حت�‰ ÙŠستط�Šع ا�„دخ�ˆÙ„ إ�„Ù‰ ب�ˆابة ا�„حجز ÙˆÙ…تابعة ب�Šا�†ات�‡ ÙˆÙ…دف�ˆعات�‡.</p>
    <div class="contact-actions">
      <button class="btn primary" type="button" onclick="navigator.clipboard?.writeText('${escapeHTML(client.code)}'); showToast('ت�… Ù†سخ ÙƒÙˆد ا�„حجز.', 'success')">Ù†سخ ÙƒÙˆد ا�„حجز</button>
      <button class="btn secondary" type="button" onclick="closeModal()">إغ�„ا�‚</button>
    </div>
  `);
}

async function openOwnerApartmentHistory(apartmentId) {
  const result = await OwnerAPI.apartmentTimeline(apartmentId);
  const logs = result.timeline || [];
  openModal(`
    <span class="eyebrow">سج�„ ا�„Ùˆحدة</span>
    <h2>حر�ƒة ا�„ش�‚ة</h2>
    ${logs.length ? `<div class="activity-timeline">${logs.map((log) => `<article><strong>${escapeHTML(log.description || log.action_type)}</strong><span>${escapeHTML(log.admin_name || "ا�„Ù†ظا�…")} · ${formatDateTime(log.created_at)}</span></article>`).join("")}</div>` : EmptyState("Ù„ا ÙŠÙˆجد سج�„ Ù„Ù‡ذ�‡ ا�„Ùˆحدة.", "س�Šظ�‡ر ا�„سج�„ ع�†د ت�†ف�Šذ ع�…Ù„ÙŠات Ù…رتبطة ب�‡ا.")}
  `);
}

function renderOwnerSettings() {
  return `
    <section class="owner-hero-panel">
      <div>
        <span class="eyebrow">ا�„إعدادات</span>
        <h2>إعدادات Ù†ظا�… ا�„Ù…ا�„Ùƒ</h2>
        <p>إدارة ب�Šا�†ات ا�„Ù…Ùƒتب�Œ حد�ˆد ا�„أسعار�Œ Ùˆص�„اح�Šات ا�„Ù…ساعد�ŠÙ†.</p>
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
    ${settingsInput("اس�… ا�„Ù…Ùƒتب", "office_name", office.office_name)}
    ${settingsInput("ر�‚Ù… ا�„Ù‡اتف", "office_phone", office.office_phone)}
    ${settingsInput("ر�‚Ù… Ùˆاتساب", "whatsapp_number", office.whatsapp_number)}
    ${settingsInput("ا�„ع�†Ùˆا�†", "office_address", office.office_address, "full")}
    ${settingsInput("ا�„بر�Šد ا�„إ�„Ùƒتر�ˆÙ†ÙŠ", "office_email", office.office_email)}
    ${settingsInput("ا�„ع�…Ù„ة", "currency", office.currency || "EGP")}
    ${settingsInput("شعار ا�„Ù…Ùƒتب إ�† Ùˆجد", "office_logo", office.office_logo, "full")}
  `, "حفظ ب�Šا�†ات ا�„Ù…Ùƒتب");
}

function renderPriceSettings(settings) {
  return settingsForm("priceSettings", `
    ${settingsInput("ا�„حد ا�„أد�†Ù‰ Ù„سعر ش�‚ة 137Ù…", "min_price_137", settings.min_price_137)}
    ${settingsInput("ا�„حد ا�„أد�†Ù‰ Ù„سعر ش�‚ة 125Ù…", "min_price_125", settings.min_price_125)}
    ${settingsInput("ا�„حد ا�„أد�†Ù‰ Ù„سعر ش�‚ة 120Ù…", "min_price_120", settings.min_price_120)}
    ${settingsInput("أ�‚Ù„ Ù…Ù‚د�… Ù…س�…Ùˆح (%)", "minimum_down_payment_percent", settings.minimum_down_payment_percent)}
    ${settingsInput("أ�‚ص�‰ Ù…دة أ�‚ساط Ù…س�…Ùˆحة", "max_installment_months", settings.max_installment_months)}
  `, "حفظ إعدادات ا�„أسعار");
}

function renderPermissionSettings(settings) {
  return settingsForm("permissionSettings", `
    ${settingsCheckbox("ا�„س�…اح Ù„Ù„Ù…ساعد بإ�†شاء د�ŠÙ„", "assistant_can_create_deal", settings.assistant_can_create_deal)}
    ${settingsCheckbox("ا�„س�…اح Ù„Ù„Ù…ساعد بتعد�ŠÙ„ ا�„د�ŠÙ„ Ù‚ب�„ ا�„إرسا�„", "assistant_can_edit_before_submit", settings.assistant_can_edit_before_submit)}
    ${settingsCheckbox("ا�„س�…اح Ù„Ù„Ù…ساعد برفع Ù…Ù„فات ا�„ع�…ÙŠÙ„", "assistant_can_upload_client_files", settings.assistant_can_upload_client_files)}
    ${settingsCheckbox("Ù…Ù†ع ا�„Ù…ساعد Ù…Ù† رؤ�Šة ا�„أسعار ا�„Ù…ا�„ÙŠة ا�„عا�…ة", "hide_global_financials_from_assistant", settings.hide_global_financials_from_assistant)}
    ${settingsCheckbox("Ù…Ù†ع ا�„Ù…ساعد Ù…Ù† رؤ�Šة ع�…Ù„اء غ�Šر تابع�ŠÙ† Ù„Ù‡", "assistant_own_clients_only", settings.assistant_own_clients_only)}
  `, "حفظ إعدادات ا�„ص�„اح�Šات");
}

function renderAssistantUsersSettings() {
  const assistants = (APP_STATE.dashboard?.users || []).filter((user) => user.role === "assistant");
  return `
    <div class="two-column">
      <section class="data-panel owner-panel">
        <span class="eyebrow">إضافة Ù…ساعد</span>
        <h3>حساب Ù…ساعد جد�Šد</h3>
        <form id="assistantUserForm" class="form-grid" autocomplete="off">
          <div class="form-field"><label for="assistantName">اس�… ا�„Ù…ساعد</label><input id="assistantName" required /></div>
          <div class="form-field"><label for="assistantEmail">ا�„بر�Šد ا�„إ�„Ùƒتر�ˆÙ†ÙŠ</label><input id="assistantEmail" type="email" required /></div>
          <div class="form-field full"><label for="assistantPassword">ÙƒÙ„Ù…ة ا�„Ù…ر�ˆر</label><input id="assistantPassword" type="password" minlength="8" placeholder="Assistant@12345" /></div>
          <button class="btn primary full" type="submit">إضافة Ù…ساعد</button>
        </form>
      </section>
      <section class="data-panel owner-panel">
        <span class="eyebrow">ا�„Ù…ساعد�ŠÙ†</span>
        <h3>ا�„حسابات ا�„حا�„ÙŠة</h3>
        ${assistants.length ? `
          <div class="table-wrap">
            <table>
              <thead><tr><th>ا�„اس�…</th><th>ا�„بر�Šد ا�„إ�„Ùƒتر�ˆÙ†ÙŠ</th><th>تار�Šخ ا�„إضافة</th></tr></thead>
              <tbody>
                ${assistants.map((assistant) => `
                  <tr>
                    <td data-label="ا�„اس�…">${escapeHTML(assistant.fullName || assistant.name || "-")}</td>
                    <td data-label="ا�„بر�Šد ا�„إ�„Ùƒتر�ˆÙ†ÙŠ">${escapeHTML(assistant.email || "-")}</td>
                    <td data-label="تار�Šخ ا�„إضافة">${formatDate(assistant.createdAt)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        ` : EmptyState("Ù„ا ÙŠÙˆجد Ù…ساعد�ŠÙ† حا�„ÙŠÙ‹ا.", "أضف أ�ˆÙ„ Ù…ساعد Ù…Ù† ا�„Ù†Ù…Ùˆذج ا�„Ù…Ùˆج�ˆد بجا�†ب ا�„Ù‚ائ�…ة.")}
      </section>
    </div>
  `;
}

function renderAccountsSettings() {
  const users = APP_STATE.dashboard?.users || [];
  return `
    <div class="two-column">
      <section class="data-panel owner-panel">
        <span class="eyebrow">إدارة ا�„حسابات</span>
        <h3>إضافة حساب</h3>
        <form id="accountUserForm" class="form-grid" autocomplete="off">
          <div class="form-field"><label for="accountName">ا�„اس�…</label><input id="accountName" required /></div>
          <div class="form-field"><label for="accountEmail">ا�„بر�Šد ا�„إ�„Ùƒتر�ˆÙ†ÙŠ</label><input id="accountEmail" type="email" required /></div>
          <div class="form-field"><label for="accountPhone">ر�‚Ù… ا�„Ù‡اتف</label><input id="accountPhone" /></div>
          <div class="form-field"><label for="accountRole">ا�„د�ˆر</label><select id="accountRole">${["admin", "assistant", "accountant", "viewer"].map((role) => `<option value="${role}">${escapeHTML(role)}</option>`).join("")}</select></div>
          <div class="form-field full"><label for="accountPassword">ÙƒÙ„Ù…ة ا�„Ù…ر�ˆر ا�„Ù…ؤ�‚تة</label><input id="accountPassword" type="password" minlength="8" placeholder="Assistant@12345" /></div>
          <button class="btn primary full" type="submit">إضافة ا�„حساب</button>
        </form>
      </section>
      <section class="data-panel owner-panel">
        <span class="eyebrow">إدارة ا�„حسابات</span>
        <h3>ا�„حسابات ا�„حا�„ÙŠة</h3>
        ${users.length ? renderAccountsTable(users) : EmptyState("Ù„ا ت�ˆجد حسابات Ù…تاحة حا�„ÙŠÙ‹ا.", "س�Šت�… عرض ا�„حسابات Ù‡Ù†ا بعد إضافت�‡ا.")}
      </section>
    </div>
  `;
}

function renderAccountsTable(users) {
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>ا�„اس�…</th><th>ا�„بر�Šد ا�„إ�„Ùƒتر�ˆÙ†ÙŠ</th><th>ا�„د�ˆر</th><th>ر�‚Ù… ا�„Ù‡اتف</th><th>ا�„حا�„ة</th><th>آخر دخ�ˆÙ„</th><th>ا�„إجراءات</th></tr></thead>
        <tbody>
          ${users.map((user) => {
            const isSelf = user.id === APP_STATE.session?.id;
            const isOwner = user.role === "owner";
            return `
              <tr>
                <td data-label="ا�„اس�…">${escapeHTML(user.fullName || "-")}</td>
                <td data-label="ا�„بر�Šد ا�„إ�„Ùƒتر�ˆÙ†ÙŠ">${escapeHTML(user.email || "-")}</td>
                <td data-label="ا�„د�ˆر">${escapeHTML(user.role || "-")}</td>
                <td data-label="ر�‚Ù… ا�„Ù‡اتف">${escapeHTML(user.phone || "-")}</td>
                <td data-label="ا�„حا�„ة">${user.isActive ? "Ù†شط" : "Ù…ÙˆÙ‚Ùˆف"}</td>
                <td data-label="آخر دخ�ˆÙ„">${formatDateTime(user.lastLoginAt)}</td>
                <td data-label="ا�„إجراءات">
                  <button class="btn ghost small" type="button" data-account-edit="${user.id}">تعد�ŠÙ„ ا�„ب�Šا�†ات</button>
                  ${!isOwner ? `<button class="btn secondary small" type="button" data-account-reset="${user.id}">إعادة تع�ŠÙŠÙ† ÙƒÙ„Ù…ة ا�„Ù…ر�ˆر</button>` : ""}
                  ${user.isActive
                    ? (!isOwner && !isSelf ? `<button class="btn danger small" type="button" data-account-disable="${user.id}">إ�ŠÙ‚اف ا�„حساب</button>` : "")
                    : `<button class="btn primary small" type="button" data-account-enable="${user.id}">تفع�ŠÙ„ ا�„حساب</button>`}
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
  setButtonLoading(button, true, "جار�Š إضافة ا�„حساب...");
  try {
    await AdminAPI.createUser({
      full_name: qs("#accountName").value.trim(),
      email: qs("#accountEmail").value.trim().toLowerCase(),
      phone: qs("#accountPhone").value.trim(),
      role: qs("#accountRole").value,
      password: qs("#accountPassword").value || "Assistant@12345",
    });
    showToast("ت�… إضافة ا�„حساب ب�†جاح.", "success");
    await refreshDashboardKeys(["users"], { render: false, loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„حسابات..." });
    APP_STATE.ownerSettingsTab = "accounts";
    renderActiveDashboardView();
  } catch (error) {
    showToast(error.message || "حدث خطأ أث�†اء إضافة ا�„حساب.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function openAccountEdit(userId) {
  const user = (APP_STATE.dashboard?.users || []).find((item) => item.id === userId);
  if (!user) return;
  const roles = ["admin", "assistant", "accountant", "viewer"];
  openModal(`
    <span class="eyebrow">إدارة ا�„حسابات</span>
    <h2>تعد�ŠÙ„ ا�„ب�Šا�†ات</h2>
    <form id="accountEditForm" class="form-grid" autocomplete="off">
      <div class="form-field"><label>ا�„اس�…</label><input name="full_name" value="${escapeHTML(user.fullName || "")}" required /></div>
      <div class="form-field"><label>ا�„بر�Šد ا�„إ�„Ùƒتر�ˆÙ†ÙŠ</label><input name="email" type="email" value="${escapeHTML(user.email || "")}" required /></div>
      <div class="form-field"><label>ر�‚Ù… ا�„Ù‡اتف</label><input name="phone" value="${escapeHTML(user.phone || "")}" /></div>
      <div class="form-field"><label>ا�„د�ˆر</label><select name="role">${(user.role === "owner" ? ["owner"] : roles).map((role) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${escapeHTML(role)}</option>`).join("")}</select></div>
      <button class="btn primary full" type="submit">حفظ ا�„تعد�ŠÙ„</button>
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
      showToast("ت�… حفظ ب�Šا�†ات ا�„حساب.", "success");
      await refreshDashboardKeys(["users"], { loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„حسابات..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function openAccountPasswordReset(userId) {
  openModal(`
    <span class="eyebrow">إدارة ا�„حسابات</span>
    <h2>إعادة تع�ŠÙŠÙ† ÙƒÙ„Ù…ة ا�„Ù…ر�ˆر</h2>
    <form id="accountResetForm" class="form-grid" autocomplete="off">
      <div class="form-field full"><label>ÙƒÙ„Ù…ة ا�„Ù…ر�ˆر ا�„Ù…ؤ�‚تة</label><input name="temporary_password" type="password" minlength="8" required /></div>
      <button class="btn primary full" type="submit">إعادة ا�„تع�ŠÙŠÙ†</button>
    </form>
  `);
  qs("#accountResetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await AdminAPI.resetUserPassword(userId, { temporary_password: form.get("temporary_password") });
      closeModal();
      showToast("ت�…ت إعادة تع�ŠÙŠÙ† ÙƒÙ„Ù…ة ا�„Ù…ر�ˆر.", "success");
      await refreshDashboardKeys(["users"], { loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„حسابات..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

async function toggleAccountStatus(userId, enabled) {
  if (!confirm(enabled ? "Ù‡Ù„ تر�Šد تفع�ŠÙ„ Ù‡ذا ا�„حساب�Ÿ" : "Ù‡Ù„ تر�Šد إ�ŠÙ‚اف Ù‡ذا ا�„حساب�Ÿ")) return;
  try {
    if (enabled) await AdminAPI.enableUser(userId);
    else await AdminAPI.disableUser(userId);
    showToast(enabled ? "ت�… تفع�ŠÙ„ ا�„حساب." : "ت�… إ�ŠÙ‚اف ا�„حساب.", "success");
    await refreshDashboardKeys(["users"], { loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„حسابات..." });
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderSystemSettings(settings) {
  return settingsForm("systemSettings", `
    ${settingsCheckbox("تفع�ŠÙ„ ر�…ز تأ�ƒÙŠد ا�„Ù…ا�„Ùƒ PIN", "owner_pin_enabled", settings.owner_pin_enabled)}
    ${settingsInput("تغ�ŠÙŠر ر�…ز تأ�ƒÙŠد ا�„Ù…ا�„Ùƒ", "owner_pin", "", "full")}
    ${settingsInput("بادئة ر�‚Ù… ا�„إ�Šصا�„", "receipt_prefix", settings.receipt_prefix)}
    ${settingsInput("عدد ا�„Ù†تائج ف�Š ا�„جدا�ˆÙ„", "table_page_size", settings.table_page_size)}
    ${settingsCheckbox("تفع�ŠÙ„ ا�„ت�†ب�ŠÙ‡ات ا�„داخ�„ÙŠة", "internal_alerts_enabled", settings.internal_alerts_enabled)}
  `, "حفظ إعدادات ا�„Ù†ظا�…");
}

function renderMediaSettings(settings) {
  return settingsForm("mediaSettings", `
    ${settingsInput("رابط ف�Šد�ŠÙˆ Ù…تابعة ا�„إ�†شاء", "project_video_url", settings.project_video_url, "full")}
    ${settingsInput("ترت�Šب عرض ا�„Ù…عرض", "gallery_order", settings.gallery_order, "full")}
    ${settingsCheckbox("إظ�‡ار تحد�Šثات ا�„Ù…شر�ˆع ا�„Ù…Ù†ش�ˆرة", "show_published_updates", settings.show_published_updates)}
    <div class="empty-state full"><strong>إدارة ا�„Ùˆسائط Ùˆا�„تحد�Šثات</strong><br><span>ÙŠت�… Ù†شر ا�„تحد�Šثات Ùˆا�„Ùˆسائط Ù…Ù† Ù‚س�… آخر ا�„تحد�Šثات Ù…ع حفظ حا�„ة ا�„Ù†شر داخ�„ Ù‚اعدة ا�„ب�Šا�†ات.</span></div>
  `, "حفظ إعدادات ا�„Ùˆسائط");
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
    showToast("ت�… حفظ ا�„تغ�ŠÙŠرات ب�†جاح.", "success");
    await refreshDashboardKeys(["ownerSettings"], { loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„إعدادات..." });
  } catch (error) {
    showToast(error.message || "حدث خطأ أث�†اء حفظ ا�„إعدادات.", "error");
  }
}

async function createAssistantUser(event) {
  event.preventDefault();
  const button = qs("#assistantUserForm button[type='submit']");
  setButtonLoading(button, true, "جار�Š إضافة ا�„Ù…ساعد...");
  try {
    await AdminAPI.createUser({
      full_name: qs("#assistantName").value.trim(),
      email: qs("#assistantEmail").value.trim().toLowerCase(),
      password: qs("#assistantPassword").value || "Assistant@12345",
      role: "assistant",
    });
    showToast("ت�… إضافة ا�„Ù…ساعد ب�†جاح.", "success");
    await refreshDashboardKeys(["users"], { render: false, loadingSelector: "#dashboardContent .data-panel", loadingText: "جار�Š تحد�Šث ا�„حسابات..." });
    APP_STATE.ownerSettingsTab = "assistants";
    renderActiveDashboardView();
  } catch (error) {
    showToast(error.message || "حدث خطأ أث�†اء إضافة ا�„Ù…ساعد.", "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function renderOwnerAuditLog() {
  const logs = filterOwnerAuditLogs(ownerData().auditLogs || []);
  return `
    <section class="owner-hero-panel">
      <div>
        <span class="eyebrow">سج�„ ا�„Ù†شاط</span>
        <h2>سج�„ ا�„Ù†شاط</h2>
        <p>تابع ج�…ÙŠع ا�„ع�…Ù„ÙŠات ا�„ت�Š ت�…ت داخ�„ ا�„Ù†ظا�… Ù…ع تفاص�ŠÙ„ ا�„Ù…ستخد�… Ùˆا�„ت�ˆÙ‚ÙŠت.</p>
      </div>
    </section>
    <section class="data-panel owner-panel">
      <div class="filter-bar owner-filter-bar">
        <label class="search-field"><span>بحث</span><input id="ownerAuditSearch" value="${escapeHTML(APP_STATE.ownerAuditSearch || "")}" placeholder="ا�„Ù…ستخد�…ØŒ ا�„د�ˆر�Œ ا�„إجراء�Œ ا�„Ù‚س�…" /></label>
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
  if (!logs.length) return EmptyState("Ù„ا ت�ˆجد سج�„ات Ù†شاط Ù…طاب�‚ة Ù„Ù„بحث.", "غ�ŠÙ‘ر Ù…عا�ŠÙŠر ا�„بحث Ù„عرض Ù†تائج أخر�‰.");
  return `
    <div class="table-wrap owner-table-wrap">
      <table>
        <thead><tr><th>ا�„Ù…ستخد�…</th><th>ا�„د�ˆر</th><th>Ù†Ùˆع ا�„إجراء</th><th>ا�„Ù‚س�…</th><th>ا�„تفاص�ŠÙ„</th><th>ا�„تار�Šخ Ùˆا�„ÙˆÙ‚ت</th><th>ع�†Ùˆا�† IP</th><th>ا�„إجراءات</th></tr></thead>
        <tbody>${logs.map((log) => `
          <tr>
            <td>${escapeHTML(log.admin_name || "ا�„Ù†ظا�…")}</td><td>${escapeHTML(ROLE_LABELS[log.admin_role] || log.admin_role || "-")}</td><td>${escapeHTML(log.action_type || "-")}</td><td>${escapeHTML(log.entity_type || "-")}</td><td>${escapeHTML(log.description || "-")}</td><td>${formatDateTime(log.created_at)}</td><td>${escapeHTML(log.ip_address || "-")}</td>
            <td><button class="btn ghost small" type="button" data-owner-audit-details="${log.id}">تفاص�ŠÙ„</button></td>
          </tr>
        `).join("")}</tbody>
      </table>
    </div>
  `;
}

function openOwnerAuditDetails(log) {
  openModal(`
    <span class="eyebrow">تفاص�ŠÙ„ سج�„ ا�„Ù†شاط</span>
    <h2>${escapeHTML(log.description || "إجراء")}</h2>
    <div class="modal-detail-grid">
      ${ownerMetric("ا�„Ù…ستخد�…", log.admin_name || "ا�„Ù†ظا�…")}
      ${ownerMetric("ا�„د�ˆر", ROLE_LABELS[log.admin_role] || log.admin_role || "-")}
      ${ownerMetric("Ù†Ùˆع ا�„إجراء", log.action_type || "-")}
      ${ownerMetric("ا�„ع�†صر", log.entity_type || "-")}
      ${ownerMetric("Ù…عر�‘ف ا�„ع�†صر", log.entity_id || "-")}
      ${ownerMetric("ا�„تار�Šخ", formatDateTime(log.created_at))}
    </div>
    <div class="audit-json">
      <strong>ا�„Ù‚ÙŠÙ…ة ا�„ساب�‚ة</strong>
      <pre>${escapeHTML(log.old_value || "-")}</pre>
      <strong>ا�„Ù‚ÙŠÙ…ة ا�„جد�Šدة</strong>
      <pre>${escapeHTML(log.new_value || "-")}</pre>
    </div>
  `);
}
