function renderDealsList(deals = [], mode = "assistant") {
  if (!deals.length) {
    return EmptyState("لا توجد ديلات متاحة حاليًا.", "سيتم عرض البيانات هنا فور إضافتها من لوحة الإدارة.");
  }
  return `<div class="deal-list">${deals.map((deal) => renderDealCard(deal, mode)).join("")}</div>`;
}

function renderDealCard(deal, mode) {
  const apt = deal.apartment || {};
  const reservationCode = deal.reservationCode || deal.portfolioCode || "يظهر بعد موافقة المالك";
  const canAssistantEdit = mode === "assistant" && ["draft", "revision_requested"].includes(deal.status);
  const canOwnerApprove = mode === "owner" && deal.status === "pending_approval";
  const canDeleteDraft = deal.status === "draft";
  const canCancelDeal = !["cancelled", "rejected"].includes(deal.status) && mode !== "assistant";

  return `
    <article class="deal-card">
      <header>
        <div>
          <strong>${escapeHTML(deal.clientName)}</strong>
          <div>${escapeHTML(apt.unitCode || "وحدة غير محددة")} - ${formatMoney(deal.proposedTotal)}</div>
        </div>
        ${StatusBadge(deal.status)}
      </header>
      <div class="deal-card-details">
        <div><span>كود الحجز</span><strong>${escapeHTML(reservationCode)}</strong></div>
        <div><span>الشقة</span><strong>${escapeHTML(apt.unitCode || "-")}</strong></div>
        <div><span>الدور</span><strong>${escapeHTML(apt.floorNumber || "-")}</strong></div>
        <div><span>المساحة</span><strong>${escapeHTML(apt.area ? `${apt.area}م²` : "-")}</strong></div>
        <div><span>السعر</span><strong data-money>${formatMoney(deal.proposedTotal)}</strong></div>
      </div>
      <p>${escapeHTML(deal.notes || "لا توجد ملاحظات.")}</p>
      <footer>
        ${canAssistantEdit ? `<button class="btn ghost small" data-deal-edit="${deal.id}">تعديل</button>` : ""}
        ${canAssistantEdit ? `<button class="btn primary small" data-deal-submit="${deal.id}">إرسال للموافقة</button>` : ""}
        ${canDeleteDraft ? `<button class="btn danger small" data-deal-delete="${deal.id}">حذف المسودة</button>` : ""}
        ${canCancelDeal ? `<button class="btn danger small" data-deal-cancel="${deal.id}">إلغاء الديل</button>` : ""}
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
            <div class="form-field"><label for="dealTotal">السعر المقترح</label><input id="dealTotal" type="text" inputmode="numeric" autocomplete="off" required /></div>
            <div class="form-field"><label for="dealDownPayment">المقدم</label><input id="dealDownPayment" type="text" inputmode="numeric" autocomplete="off" value="0" /></div>
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
    const total = parseFormattedAmount(qs("#dealTotal", form)?.value || apt?.price || 0);
    const down = parseFormattedAmount(qs("#dealDownPayment", form)?.value || 0);
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
    if (apt && !qs("#dealTotal", form).value) qs("#dealTotal", form).value = formatAmountInput(apt.price || "");
    updateReview();
  });
  ["#dealTotal", "#dealDownPayment"].forEach((selector) => {
    qs(selector, form)?.addEventListener("input", (event) => {
      event.target.value = formatAmountInput(event.target.value);
    });
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
    const proposedTotal = parseFormattedAmount(qs("#dealTotal", form).value || 0);
    const downPayment = parseFormattedAmount(qs("#dealDownPayment", form).value || 0);
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
    await refreshDealsAfterChange({ loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الديلات..." });
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function handleDealAction(target) {
  if (target.dataset.dealCancel) {
    openCancelDealDialog(target.dataset.dealCancel, "admin");
    return true;
  }
  if (target.dataset.dealDelete) {
    if (!confirm("هل أنت متأكد من حذف مسودة الديل؟")) return true;
    await DealAPI.remove(target.dataset.dealDelete);
    showToast("تم حذف مسودة الديل بنجاح.", "success");
    await refreshDealsAfterChange({ loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الديلات..." });
    return true;
  }
  if (target.dataset.dealEdit) {
    openDealEditDialog(target.dataset.dealEdit);
    return true;
  }
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
      await refreshDealsAfterChange({ loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الديلات..." });
      return true;
    }
  }

  return false;
}

function openCancelDealDialog(dealId, scope = "admin") {
  openModal(`
    <span class="eyebrow">الديلات</span>
    <h2>إلغاء الديل</h2>
    <p class="muted">هل أنت متأكد من إلغاء هذا الديل؟ سيتم تحرير الشقة إذا لم تكن مرتبطة بحجز آخر.</p>
    <form id="cancelDealForm" class="form-grid" autocomplete="off">
      <div class="form-field full"><label for="cancelDealReason">سبب الإلغاء</label><textarea id="cancelDealReason" required></textarea></div>
      <button class="btn danger" type="submit">تأكيد الإلغاء</button>
      <button class="btn secondary" type="button" id="cancelDealBack">تراجع</button>
    </form>
  `);
  qs("#cancelDealBack")?.addEventListener("click", closeModal);
  qs("#cancelDealForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const reason = qs("#cancelDealReason").value.trim();
    if (!reason) return showToast("سبب الإلغاء مطلوب.", "error");
    try {
      if (scope === "owner") await OwnerAPI.cancelDeal(dealId, reason);
      else await DealAPI.cancel(dealId, reason);
      closeModal();
      showToast("تم إلغاء الديل بنجاح.", "success");
      await refreshDealsAfterChange({ loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الديلات..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function openDealEditDialog(dealId) {
  const deal = (APP_STATE.dashboard?.deals || []).find((item) => item.id === dealId);
  if (!deal) return;
  const apartments = APP_STATE.dashboard?.apartments || [];
  openModal(`
    <span class="eyebrow">الديلات</span>
    <h2>تعديل الديل</h2>
    <form id="dealEditForm" class="form-grid" autocomplete="off">
      <div class="form-field"><label>اسم العميل</label><input name="client_name" value="${escapeHTML(deal.clientName || "")}" required /></div>
      <div class="form-field"><label>رقم الهاتف</label><input name="client_phone" value="${escapeHTML(deal.clientPhone || "")}" /></div>
      <div class="form-field full"><label>الشقة</label><select name="apartment_id">${apartments.map((apt) => `<option value="${apt.id}" ${apt.id === deal.apartmentId ? "selected" : ""}>${escapeHTML(apt.unitCode)} - ${escapeHTML(apt.status || "")}</option>`).join("")}</select></div>
      <div class="form-field"><label>السعر المقترح</label><input name="proposed_total" value="${Number(deal.proposedTotal || 0)}" inputmode="numeric" required /></div>
      <div class="form-field"><label>المقدم</label><input name="down_payment" value="${Number(deal.downPayment || 0)}" inputmode="numeric" /></div>
      <div class="form-field full"><label>خطة السداد</label><textarea name="payment_plan">${escapeHTML(deal.paymentPlan || "")}</textarea></div>
      <div class="form-field full"><label>ملاحظات</label><textarea name="notes">${escapeHTML(deal.notes || "")}</textarea></div>
      <button class="btn primary full" type="submit">حفظ التعديل</button>
    </form>
  `);
  qs("#dealEditForm").addEventListener("submit", async (event) => {
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
      showToast("تم حفظ التعديل بنجاح.", "success");
      await refreshDealsAfterChange({ loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الديلات..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}
