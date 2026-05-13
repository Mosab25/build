async function generateContract(dealId, contractType) {
  try {
    const result = await ContractAPI.generate(dealId, contractType);
    showToast(contractType === "final_contract" ? "تم إصدار العقد النهائي بنجاح." : "تم إصدار عقد مسودة بنجاح.", "success");
    if (result.url) downloadFile(result.url);
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function renderContractsTable(contracts = []) {
  if (!contracts.length) {
    return EmptyState("لا توجد عقود متاحة حاليًا.", "سيتم عرض العقود بعد إصدارها من الديلات المعتمدة.");
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>نوع العقد</th><th>الحالة</th><th>تاريخ الإصدار</th><th>تحميل</th></tr>
        </thead>
        <tbody>
          ${contracts.map((contract) => `
            <tr>
              <td>${statusLabel(contract.contractType)}</td>
              <td>${StatusBadge(contract.status)}</td>
              <td>${formatDate(contract.issuedAt || contract.createdAt)}</td>
              <td>${contract.pdfUrl ? `<button class="btn ghost small" data-download="${contract.pdfUrl}">تحميل</button>` : "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminContractsPanel() {
  const contracts = APP_STATE.dashboard?.contracts || [];
  const deals = APP_STATE.dashboard?.deals || [];
  return `
    <section class="data-panel contracts-panel">
      <div class="dashboard-topbar">
        <div><span class="eyebrow">العقود</span><h3>إدارة العقود</h3></div>
      </div>
      <div class="form-card">
        <h4>إصدار عقد من ديل</h4>
        <p class="muted">اختر ديل محفوظ لإصدار عقد مسودة أو عقد نهائي حسب الصلاحية وحالة الديل.</p>
        <form id="adminContractGenerateForm" class="form-grid">
          <div class="form-field full"><label for="contractDealId">الديل</label><select id="contractDealId" required>${deals.map((deal) => `<option value="${deal.id}">${escapeHTML(deal.clientName)} - ${escapeHTML(deal.apartment?.unitCode || "-")} - ${statusLabel(deal.status)}</option>`).join("")}</select></div>
          <div class="form-field"><label for="contractType">نوع العقد</label><select id="contractType"><option value="draft_contract">عقد مسودة</option><option value="final_contract">العقد النهائي</option></select></div>
          <button class="btn primary" type="submit">إصدار / تحميل العقد</button>
        </form>
      </div>
    </section>
    <section class="data-panel">
      <h3>العقود المحفوظة</h3>
      ${renderContractsTable(contracts)}
    </section>
  `;
}

function bindAdminContractsPanel() {
  qs("#adminContractGenerateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const dealId = qs("#contractDealId").value;
    const type = qs("#contractType").value;
    if (!dealId) {
      showToast("يرجى اختيار ديل لإصدار العقد.", "error");
      return;
    }
    await generateContract(dealId, type);
  });
}
