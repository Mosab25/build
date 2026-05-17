function renderAssistantDashboard() {
  const data = APP_STATE.dashboard;
  const deals = data.deals || [];
  const availableApartments = (data.apartments || []).filter((apt) => apt.status === "Available");

  return `
    <div class="dashboard-grid">
      ${statCard("ديلاتي", deals.length)}
      ${statCard("بانتظار الموافقة", deals.filter((deal) => deal.status === "pending_approval").length)}
      ${statCard("مطلوب تعديل", deals.filter((deal) => deal.status === "revision_requested").length)}
      ${statCard("الشقق المتاحة", availableApartments.length)}
    </div>
    <section class="data-panel">
      <div class="dashboard-topbar">
        <div><span class="eyebrow">الديلات</span><h3>الديلات الخاصة بي</h3></div>
        <button class="btn primary small" id="newDealButton" type="button">إنشاء ديل جديد</button>
      </div>
      ${renderDealsList(deals, "assistant")}
    </section>
    <section class="data-panel">
      <span class="eyebrow">الوحدات</span>
      <h3>الشقق المتاحة</h3>
      ${renderApartmentsTable(availableApartments, false)}
    </section>
  `;
}

function bindAssistantDashboard() {
  qs("#newDealButton")?.addEventListener("click", openDealForm);
}
