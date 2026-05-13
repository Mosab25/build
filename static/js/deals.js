function renderDealsList(deals = [], mode = "assistant") {
  if (!deals.length) {
    return EmptyState("لا توجد ديلات متاحة حاليًا.", "سيتم عرض البيانات هنا فور إضافتها من لوحة الإدارة.");
  }
  return `<div class="deal-list">${deals.map((deal) => renderDealCard(deal, mode)).join("")}</div>`;
}

function renderDealCard(deal, mode) {
  const apt = deal.apartment || {};
  const canAssistantEdit = mode === "assistant" && ["draft", "revision_requested"].includes(deal.status);
  const canOwnerApprove = mode === "owner" && deal.status === "pending_approval";

  return `
    <article class="deal-card">
      <header>
        <div>
          <strong>${escapeHTML(deal.clientName)}</strong>
          <div>${escapeHTML(apt.unitCode || "وحدة غير محددة")} - ${formatMoney(deal.proposedTotal)}</div>
        </div>
        ${StatusBadge(deal.status)}
      </header>
      <p>${escapeHTML(deal.notes || "لا توجد ملاحظات.")}</p>
      <footer>
        ${canAssistantEdit ? `<button class="btn primary small" data-deal-submit="${deal.id}">إرسال للموافقة</button>` : ""}
        ${canOwnerApprove ? `<button class="btn primary small" data-deal-approve="${deal.id}">الموافقة</button><button class="btn secondary small" data-deal-revision="${deal.id}">طلب تعديل</button><button class="btn danger small" data-deal-reject="${deal.id}">رفض</button>` : ""}
      </footer>
    </article>
  `;
}

function availableDealApartments() {
  return (APP_STATE.dashboard.apartments || []).filter((apt) => apt.status === "Available");
}

function openDealForm() {
  openModal(`
    <span class="eyebrow">الديلات</span>
    <h2>إنشاء ديل جديد</h2>
    <p class="muted">استخدم نموذج الخطوات لإدخال بيانات العميل، اختيار الشقة، ثم إرسال الديل للموافقة.</p>
    ${renderAssistantDealWizard(true)}
  `);
  bindAssistantDealWizard(true);
}

function renderAssistantDealWizard(isModal = false) {
  const apartments = availableDealApartments();
  if (!apartments.length) {
    return EmptyState("لا توجد شقق متاحة حاليًا.", "لا يمكن إنشاء ديل جديد إلا على شقة متاحة.");
  }
  const selected = apartments[0];
  const formId = isModal ? "dealWizardFormModal" : "dealWizardForm";
  return `
    <section class="data-panel deal-wizard-panel">
      ${isModal ? "" : `<div class="dashboard-topbar"><div><span class="eyebrow">المساعد</span><h3>إنشاء ديل جديد</h3></div></div>`}
      <form id="${formId}" class="deal-wizard-form">
        <div class="wizard-steps" aria-label="خطوات إنشاء الديل">
          <span class="active">١ بيانات العميل</span>
          <span>٢ اختيار الشقة</span>
          <span>٣ السعر والدفع</span>
          <span>٤ مراجعة</span>
          <span>٥ إرسال</span>
        </div>
        <div class="wizard-grid">
          <fieldset class="wizard-card">
            <legend>بيانات العميل</legend>
            <div class="form-field"><label for="dealClientName">اسم العميل</label><input id="dealClientName" required /></div>
            <div class="form-field"><label for="dealClientPhone">رقم الهاتف</label><input id="dealClientPhone" /></div>
          </fieldset>
          <fieldset class="wizard-card">
            <legend>اختيار الشقة</legend>
            <div class="form-field full"><label for="dealApartment">الشقة المتاحة</label><select id="dealApartment">${apartments.map((apt) => `<option value="${apt.id}">${escapeHTML(apt.unitCode)} - الدور ${apt.floorNumber} - ${apt.area}م² - ${escapeHTML(apt.directionAr)}</option>`).join("")}</select></div>
            <div class="wizard-summary" id="dealApartmentSummary">${renderDealApartmentSummary(selected)}</div>
          </fieldset>
          <fieldset class="wizard-card">
            <legend>السعر والدفع</legend>
            <div class="form-field"><label for="dealTotal">السعر المقترح</label><input id="dealTotal" type="number" min="1" step="1000" required /></div>
            <div class="form-field"><label for="dealDownPayment">المقدم</label><input id="dealDownPayment" type="number" min="0" step="1000" value="0" /></div>
            <div class="form-field"><label for="dealPaymentPlan">طريقة السداد</label><select id="dealPaymentPlan"><option value="cash">دفعة واحدة</option><option value="installment">أقساط شهرية</option><option value="flexible">أقساط مرنة</option></select></div>
            <div class="form-field"><label for="dealInstallmentsCount">عدد الأقساط</label><input id="dealInstallmentsCount" type="number" min="0" step="1" value="0" /></div>
          </fieldset>
          <fieldset class="wizard-card">
            <legend>مراجعة الديل</legend>
            <div class="wizard-summary" id="dealReviewBox"></div>
            <div class="form-field full"><label for="dealNotes">ملاحظات المساعد</label><textarea id="dealNotes" placeholder="اكتب أي ملاحظات مهمة للمالك"></textarea></div>
          </fieldset>
        </div>
        <div class="panel-actions">
          <button class="btn secondary" type="button" id="saveDraftDealButton">حفظ كمسودة</button>
          <button class="btn primary" type="submit">حفظ وإرسال للموافقة</button>
        </div>
      </form>
    </section>
  `;
}

function renderDealApartmentSummary(apt) {
  if (!apt) return "";
  return `
    <strong>${escapeHTML(apt.unitCode)}</strong>
    <span>الدور ${apt.floorNumber}</span>
    <span>${apt.area} م² - ${escapeHTML(apt.directionAr)}</span>
    <span>${formatMoney(apt.price)}</span>
  `;
}

function bindAssistantDealWizard(isModal = false) {
  const form = qs(isModal ? "#dealWizardFormModal" : "#dealWizardForm");
  if (!form) return;
  const apartments = availableDealApartments();
  const updateReview = () => {
    const apt = apartments.find((item) => item.id === qs("#dealApartment", form)?.value) || apartments[0];
    const total = Number(qs("#dealTotal", form)?.value || apt?.price || 0);
    const down = Number(qs("#dealDownPayment", form)?.value || 0);
    const remaining = Math.max(0, total - down);
    const count = Number(qs("#dealInstallmentsCount", form)?.value || 0);
    const monthly = count > 0 ? remaining / count : 0;
    const summary = qs("#dealApartmentSummary", form);
    if (summary) summary.innerHTML = renderDealApartmentSummary(apt);
    const review = qs("#dealReviewBox", form);
    if (review) {
      review.innerHTML = `
        <div>الشقة: <strong>${escapeHTML(apt?.unitCode || "-")}</strong></div>
        <div>السعر المقترح: <strong>${formatMoney(total)}</strong></div>
        <div>المقدم: <strong>${formatMoney(down)}</strong></div>
        <div>المتبقي: <strong>${formatMoney(remaining)}</strong></div>
        <div>القسط التقريبي: <strong>${monthly ? formatMoney(monthly) : "غير محدد"}</strong></div>
      `;
    }
  };
  qsa("input, select, textarea", form).forEach((input) => input.addEventListener("input", updateReview));
  qs("#dealApartment", form)?.addEventListener("change", () => {
    const apt = apartments.find((item) => item.id === qs("#dealApartment", form).value);
    if (apt && !qs("#dealTotal", form).value) qs("#dealTotal", form).value = apt.price || "";
    updateReview();
  });
  qs("#dealApartment", form)?.dispatchEvent(new Event("change"));
  updateReview();
  qs("#saveDraftDealButton", form)?.addEventListener("click", () => saveDealFromWizard(form, false));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    saveDealFromWizard(form, true);
  });
}

async function saveDealFromWizard(form, submitAfterSave) {
  try {
    const clientName = qs("#dealClientName", form).value.trim();
    const apartmentId = qs("#dealApartment", form).value;
    const proposedTotal = Number(qs("#dealTotal", form).value || 0);
    const downPayment = Number(qs("#dealDownPayment", form).value || 0);
    if (!clientName || !apartmentId || proposedTotal <= 0) {
      throw new Error("يرجى مراجعة اسم العميل والشقة والسعر المقترح.");
    }
    if (downPayment > proposedTotal) {
      throw new Error("المقدم لا يمكن أن يكون أكبر من السعر المقترح.");
    }
    const result = await DealAPI.create({
      client_name: clientName,
      client_phone: qs("#dealClientPhone", form).value.trim(),
      apartment_id: apartmentId,
      proposed_total: proposedTotal,
      down_payment: downPayment,
      payment_plan: qs("#dealPaymentPlan", form).value,
      installments_count: Number(qs("#dealInstallmentsCount", form).value || 0),
      notes: qs("#dealNotes", form).value.trim(),
    });
    const deal = result.deal || result;
    if (submitAfterSave && deal?.id) {
      await DealAPI.submit(deal.id);
      showToast("تم حفظ الديل وإرساله للموافقة.", "success");
    } else {
      showToast("تم حفظ الديل كمسودة.", "success");
    }
    closeModal();
    APP_STATE.activeDashboardView = "deals";
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function handleDealAction(target) {
  const actions = [
    ["dealSubmit", "submit"],
    ["dealApprove", "approve"],
    ["dealRevision", "requestRevision"],
    ["dealReject", "reject"],
  ];

  for (const [dataKey, method] of actions) {
    const dealId = target.dataset[dataKey];
    if (dealId) {
      await DealAPI[method](dealId);
      showToast(method === "submit" ? "تم إرسال الطلب للموافقة." : "تم الحفظ بنجاح.", "success");
      await loadDashboard();
      return true;
    }
  }

  return false;
}
