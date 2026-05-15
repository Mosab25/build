function renderPaymentTable(payments) {
  if (!payments.length) {
    return EmptyState("لا توجد مدفوعات مسجلة حاليًا.", "سيتم عرض سجل المدفوعات فور إضافته من لوحة الإدارة.");
  }
  const showUnit = payments.some((payment) => payment.unitCode);

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${showUnit ? "<th>الشقة</th>" : ""}<th>التاريخ</th><th>المبلغ</th><th>طريقة الدفع</th><th>الحالة</th><th>رقم الإيصال</th><th>ملاحظات</th></tr>
        </thead>
        <tbody>
          ${payments.map((payment) => `
            <tr>
              ${showUnit ? `<td data-label="الشقة">${escapeHTML(payment.unitCode || "-")}</td>` : ""}
              <td data-label="التاريخ">${formatDate(payment.date)}</td>
              <td data-label="المبلغ" data-money>${formatMoney(payment.amount)}</td>
              <td data-label="طريقة الدفع">${statusLabel(payment.method)}</td>
              <td data-label="الحالة">${StatusBadge(payment.status)}</td>
              <td data-label="رقم الإيصال">${escapeHTML(payment.receiptNumber || payment.referenceNumber || "-")}</td>
              <td data-label="ملاحظات">${escapeHTML(payment.notes || "-")}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminPaymentsPanel() {
  return `
    <section class="data-panel">
      <div class="panel-actions">
        <button class="btn primary small" id="newPaymentButton" type="button">إضافة دفعة جديدة</button>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("payments")}" target="_blank" rel="noopener">تصدير المدفوعات Excel</a>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("financial-summary")}" target="_blank" rel="noopener">تصدير التقرير المالي Excel</a>
      </div>
      <h3>سجل المدفوعات</h3>
      ${renderAdminPaymentTable(APP_STATE.dashboard.payments || [])}
    </section>
  `;
}

function renderAdminPaymentTable(payments) {
  if (!payments.length) return EmptyState("لا توجد مدفوعات مسجلة حاليًا.", "أضف أول دفعة من لوحة الإدارة.");
  const clients = APP_STATE.dashboard.clients || [];
  const apartments = APP_STATE.dashboard.apartments || [];
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>العميل</th><th>الشقة</th><th>التاريخ</th><th>المبلغ</th><th>طريقة الدفع</th><th>الحالة</th><th>رقم الإيصال</th><th>إجراءات</th></tr>
        </thead>
        <tbody>
          ${payments.map((payment) => {
            const client = clients.find((item) => item.id === payment.clientId);
            const apartment = apartments.find((item) => item.id === payment.apartmentId) || client?.apartment;
            return `
              <tr>
                <td data-label="العميل">${escapeHTML(client?.name || "-")}</td>
                <td data-label="الشقة">${escapeHTML(apartment?.unitCode || "-")}</td>
                <td data-label="التاريخ">${formatDate(payment.date)}</td>
                <td data-label="المبلغ" data-money>${formatMoney(payment.amount)}</td>
                <td data-label="طريقة الدفع">${statusLabel(payment.method)}</td>
                <td data-label="الحالة">${StatusBadge(payment.status)}</td>
                <td data-label="رقم الإيصال">${escapeHTML(payment.receiptNumber || payment.referenceNumber || "-")}</td>
                <td data-label="إجراءات" class="table-actions">
                  <button class="btn ghost small" data-payment-edit="${payment.id}" type="button">تعديل الدفعة</button>
                  <button class="btn secondary small" data-payment-receipt="${payment.id}" type="button">تحميل إيصال الدفع</button>
                  <button class="btn danger small" data-payment-delete="${payment.id}" type="button">حذف الدفعة</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderInstallmentsTable(installments) {
  if (!installments.length) {
    return EmptyState("لا توجد أقساط مسجلة حاليًا.", "سيتم عرض جدول الأقساط فور إضافته من لوحة الإدارة.");
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>رقم القسط</th><th>تاريخ الاستحقاق</th><th>قيمة القسط</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th></tr>
        </thead>
        <tbody>
          ${installments.map((item) => `
            <tr>
              <td data-label="رقم القسط">${Number(item.installmentNumber).toLocaleString("ar-EG")}</td>
              <td data-label="تاريخ الاستحقاق">${formatDate(item.dueDate)}</td>
              <td data-label="قيمة القسط" data-money>${formatMoney(item.amount)}</td>
              <td data-label="المدفوع" data-money>${formatMoney(item.paidAmount)}</td>
              <td data-label="المتبقي" data-money>${formatMoney(item.remainingAmount)}</td>
              <td data-label="الحالة">${StatusBadge(item.status)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderAdminInstallmentsPanel() {
  return `
    <section class="data-panel">
      <div class="panel-actions">
        <button class="btn primary small" id="newInstallmentButton" type="button">إضافة قسط</button>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("installments")}" target="_blank" rel="noopener">تصدير الأقساط Excel</a>
      </div>
      <h3>جدول الأقساط</h3>
      ${renderAdminInstallmentsTable(APP_STATE.dashboard.installments || [])}
    </section>
  `;
}

function renderAdminInstallmentsTable(installments) {
  if (!installments.length) return EmptyState("لا توجد أقساط مسجلة حاليًا.", "يمكنك إنشاء خطة أقساط لأي عميل.");
  const clients = APP_STATE.dashboard.clients || [];
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr><th>العميل</th><th>رقم القسط</th><th>تاريخ الاستحقاق</th><th>قيمة القسط</th><th>المدفوع</th><th>المتبقي</th><th>الحالة</th><th>ملاحظات</th><th>إجراءات</th></tr>
        </thead>
        <tbody>
          ${installments.map((item) => {
            const client = clients.find((entry) => entry.id === item.clientId);
            return `
              <tr>
                <td data-label="العميل">${escapeHTML(client?.name || "-")}</td>
                <td data-label="رقم القسط">${Number(item.installmentNumber).toLocaleString("ar-EG")}</td>
                <td data-label="تاريخ الاستحقاق">${formatDate(item.dueDate)}</td>
                <td data-label="قيمة القسط" data-money>${formatMoney(item.amount)}</td>
                <td data-label="المدفوع" data-money>${formatMoney(item.paidAmount)}</td>
                <td data-label="المتبقي" data-money>${formatMoney(item.remainingAmount)}</td>
                <td data-label="الحالة">${StatusBadge(item.status)}</td>
                <td data-label="ملاحظات">${escapeHTML(item.notes || "-")}</td>
                <td data-label="إجراءات" class="table-actions">
                  <button class="btn ghost small" data-installment-edit="${item.id}" type="button">تعديل</button>
                  <button class="btn danger small" data-installment-delete="${item.id}" type="button">حذف القسط</button>
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function bindPaymentsPanel() {
  qs("#newPaymentButton")?.addEventListener("click", () => openPaymentForm());
  qsa("[data-payment-edit]").forEach((button) => button.addEventListener("click", () => {
    const payment = (APP_STATE.dashboard.payments || []).find((item) => item.id === button.dataset.paymentEdit);
    if (payment) openPaymentForm(payment.clientId, payment);
  }));
  qsa("[data-payment-delete]").forEach((button) => button.addEventListener("click", () => deletePayment(button.dataset.paymentDelete)));
  qsa("[data-payment-receipt]").forEach((button) => button.addEventListener("click", () => generateReceipt(button.dataset.paymentReceipt)));
}

function bindInstallmentsPanel() {
  qs("#newInstallmentButton")?.addEventListener("click", () => openInstallmentForm());
  qsa("[data-installment-edit]").forEach((button) => button.addEventListener("click", () => {
    const installment = (APP_STATE.dashboard.installments || []).find((item) => item.id === button.dataset.installmentEdit);
    if (installment) openInstallmentForm(installment);
  }));
  qsa("[data-installment-delete]").forEach((button) => button.addEventListener("click", () => deleteInstallment(button.dataset.installmentDelete)));
}

function openPaymentForm(clientId = "", payment = null) {
  const clients = APP_STATE.dashboard.clients || [];
  const selectedClientId = payment?.clientId || clientId;
  openModal(`
    <span class="eyebrow">المدفوعات</span>
    <h2>${payment ? "تعديل الدفعة" : "إضافة دفعة جديدة"}</h2>
    <form id="paymentForm" class="form-grid" data-payment-id="${escapeHTML(payment?.id || "")}">
      <div class="form-field full">
        <label for="paymentClient">العميل</label>
        <select id="paymentClient" required>
          ${clients.map((client) => `<option value="${client.id}" ${client.id === selectedClientId ? "selected" : ""}>${escapeHTML(paymentClientOptionLabel(client))}</option>`).join("")}
        </select>
      </div>
      <div class="form-field"><label for="paymentApartment">الشقة (اختياري)</label>
        <select id="paymentApartment">
          <option value="">بدون شقة</option>
        </select>
      </div>
      <div class="form-field"><label for="paymentAmount">المبلغ</label><input id="paymentAmount" type="text" inputmode="numeric" autocomplete="off" required placeholder="1,000,000" /></div>
      <div class="form-field"><label for="paymentDate">تاريخ الدفع</label><input id="paymentDate" type="date" required /></div>
      <div class="form-field"><label for="paymentMethod">طريقة الدفع</label><select id="paymentMethod"><option value="cash">نقدًا</option><option value="bank_transfer">تحويل بنكي</option><option value="installment">قسط</option><option value="office_payment">دفع في المكتب</option><option value="other">أخرى</option></select></div>
      <div class="form-field"><label for="paymentStatus">حالة الدفعة</label><select id="paymentStatus"><option value="confirmed">مؤكد</option><option value="pending">قيد المراجعة</option><option value="rejected">مرفوض</option></select></div>
      <div class="form-field"><label for="paymentReceiptNumber">رقم الإيصال</label><input id="paymentReceiptNumber" /></div>
      <div class="form-field"><label for="paymentReferenceNumber">رقم المرجع</label><input id="paymentReferenceNumber" /></div>
      <div class="form-field full"><label for="paymentNotes">ملاحظات</label><textarea id="paymentNotes"></textarea></div>
      <button class="btn primary full" type="submit">حفظ الدفعة</button>
    </form>
  `);
  qs("#paymentDate").value = payment?.date || new Date().toISOString().slice(0, 10);
  qs("#paymentAmount").value = payment?.amount ? formatAmountInput(payment.amount) : "";
  qs("#paymentMethod").value = methodValue(payment?.method || "cash");
  qs("#paymentStatus").value = paymentStatusValue(payment?.status || "confirmed");
  qs("#paymentReceiptNumber").value = payment?.receiptNumber || "";
  qs("#paymentReferenceNumber").value = payment?.referenceNumber || "";
  qs("#paymentNotes").value = payment?.notes || "";

  function populateApartmentsForClient(clientId) {
    const select = qs("#paymentApartment");
    if (!select) return;
    select.innerHTML = '<option value="">بدون شقة</option>';
    const client = (APP_STATE.dashboard.clients || []).find((c) => c.id === clientId);
    const list = client?.apartments || (client?.apartment ? [client.apartment] : []);
    list.forEach((a) => {
      const value = a.id || a.apartmentId || a.client_apartment_id || "";
      const label = `${escapeHTML(a.unitCode || a.unit_code || "-" )} - ${formatMoney(a.price || a.unitPrice || a.unit_price || 0)}`;
      const opt = `<option value="${value}" ${payment && (payment.apartmentId === value || payment.apartmentId === value) ? 'selected' : ''}>${label}</option>`;
      select.insertAdjacentHTML('beforeend', opt);
    });
  }

  populateApartmentsForClient(selectedClientId);
  qs("#paymentClient").addEventListener("change", (e) => populateApartmentsForClient(e.target.value));

  qs("#paymentAmount").addEventListener("input", (event) => {
    event.target.value = formatAmountInput(event.target.value);
  });
  qs("#paymentForm").addEventListener("submit", savePayment);
}

function paymentClientOptionLabel(client) {
  const unitCode = client.apartment?.unitCode || "بدون شقة";
  return `${client.name} - ${client.code} - ${unitCode} - المتبقي ${formatMoney(client.remainingAmount || 0)}`;
}

async function savePayment(event) {
  event.preventDefault();
  const form = qs("#paymentForm");
  const paymentId = form.dataset.paymentId;
  const amount = parseFormattedAmount(qs("#paymentAmount").value);
  const payload = {
    client_id: qs("#paymentClient").value,
    apartment_id: qs("#paymentApartment")?.value || undefined,
    amount,
    payment_date: qs("#paymentDate").value,
    payment_method: qs("#paymentMethod").value,
    payment_status: qs("#paymentStatus").value,
    receipt_number: qs("#paymentReceiptNumber").value.trim() || undefined,
    reference_number: qs("#paymentReferenceNumber").value.trim() || undefined,
    notes: qs("#paymentNotes").value.trim(),
  };
  try {
    if (paymentId) await AdminAPI.updatePayment(paymentId, payload);
    else await AdminAPI.createPayment(payload);
    closeModal();
    showToast("تم الحفظ بنجاح.", "success");
    await loadDashboard();
  } catch (error) {
    if (String(error.message || "").includes("أكبر من المبلغ المتبقي") && confirm("المبلغ المدخل أكبر من المبلغ المتبقي. هل تريد المتابعة؟")) {
      payload.allow_overpay = true;
      if (paymentId) await AdminAPI.updatePayment(paymentId, payload);
      else await AdminAPI.createPayment(payload);
      closeModal();
      showToast("تم الحفظ بنجاح.", "success");
      await loadDashboard();
      return;
    }
    showToast(error.message, "error");
  }
}

function formatAmountInput(value) {
  const clean = normalizeAmountValue(value).replace(/[^\d]/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("en-US");
}

function parseFormattedAmount(value) {
  const clean = normalizeAmountValue(value).replace(/[^\d]/g, "");
  return clean ? Number(clean) : 0;
}

function methodValue(value) {
  const labels = {
    Cash: "cash",
    "Bank Transfer": "bank_transfer",
    Installment: "installment",
    "Office Payment": "office_payment",
    Other: "other",
  };
  return labels[value] || value || "cash";
}

function paymentStatusValue(value) {
  const labels = { Confirmed: "confirmed", Pending: "pending", Rejected: "rejected" };
  return labels[value] || value || "confirmed";
}

async function generateReceipt(paymentId) {
  try {
    const result = await AdminAPI.receipt(paymentId);
    if (result.url) downloadFile(result.url);
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deletePayment(paymentId) {
  if (!confirm("لا يمكن حذف هذه الدفعة بدون تأكيد. هل تريد حذفها؟")) return;
  try {
    await AdminAPI.deletePayment(paymentId);
    showToast("تم حذف الدفعة بنجاح.", "success");
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openInstallmentForm(installment = null) {
  const clients = APP_STATE.dashboard.clients || [];
  openModal(`
    <span class="eyebrow">الأقساط</span>
    <h2>${installment ? "تعديل قسط" : "إضافة قسط"}</h2>
    <form id="installmentForm" class="form-grid" data-installment-id="${escapeHTML(installment?.id || "")}">
      <div class="form-field full">
        <label for="installmentClient">العميل</label>
        <select id="installmentClient" required>
          ${clients.map((client) => `<option value="${client.id}" ${client.id === installment?.clientId ? "selected" : ""}>${escapeHTML(client.name)} - ${escapeHTML(client.code)}</option>`).join("")}
        </select>
      </div>
      <div class="form-field"><label for="installmentNumber">رقم القسط</label><input id="installmentNumber" type="number" min="1" required /></div>
      <div class="form-field"><label for="installmentDueDate">تاريخ الاستحقاق</label><input id="installmentDueDate" type="date" required /></div>
      <div class="form-field"><label for="installmentAmount">قيمة القسط</label><input id="installmentAmount" type="text" inputmode="numeric" autocomplete="off" required /></div>
      <div class="form-field"><label for="installmentPaidAmount">المدفوع</label><input id="installmentPaidAmount" type="text" inputmode="numeric" autocomplete="off" /></div>
      <div class="form-field"><label for="installmentStatus">الحالة</label><select id="installmentStatus"><option value="upcoming">قادم</option><option value="due">مستحق</option><option value="paid">مدفوع</option><option value="partially_paid">مدفوع جزئيًا</option><option value="overdue">متأخر</option><option value="cancelled">ملغي</option></select></div>
      <div class="form-field full"><label for="installmentNotes">ملاحظات</label><textarea id="installmentNotes"></textarea></div>
      <button class="btn primary full" type="submit">حفظ القسط</button>
    </form>
  `);
  qs("#installmentNumber").value = installment?.installmentNumber || nextInstallmentNumber();
  qs("#installmentDueDate").value = installment?.dueDate || new Date().toISOString().slice(0, 10);
  qs("#installmentAmount").value = installment?.amount ? formatAmountInput(installment.amount) : "";
  qs("#installmentPaidAmount").value = installment?.paidAmount ? formatAmountInput(installment.paidAmount) : "0";
  qs("#installmentStatus").value = installment?.status || "upcoming";
  qs("#installmentNotes").value = installment?.notes || "";
  ["#installmentAmount", "#installmentPaidAmount"].forEach((selector) => {
    qs(selector)?.addEventListener("input", (event) => {
      event.target.value = formatAmountInput(event.target.value);
    });
  });
  qs("#installmentForm").addEventListener("submit", saveInstallment);
}

function nextInstallmentNumber() {
  const values = (APP_STATE.dashboard.installments || []).map((item) => Number(item.installmentNumber || 0));
  return Math.max(0, ...values) + 1;
}

async function saveInstallment(event) {
  event.preventDefault();
  const form = qs("#installmentForm");
  const installmentId = form.dataset.installmentId;
  const payload = {
    client_id: qs("#installmentClient").value,
    installment_number: Number(qs("#installmentNumber").value),
    due_date: qs("#installmentDueDate").value,
    amount: parseFormattedAmount(qs("#installmentAmount").value),
    paid_amount: parseFormattedAmount(qs("#installmentPaidAmount").value || 0),
    status: qs("#installmentStatus").value,
    notes: qs("#installmentNotes").value.trim(),
  };
  try {
    if (installmentId) await AdminAPI.updateInstallment(installmentId, payload);
    else await AdminAPI.createInstallment(payload);
    closeModal();
    showToast("تم حفظ القسط بنجاح.", "success");
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function deleteInstallment(installmentId) {
  if (!confirm("هل تريد حذف هذا القسط؟")) return;
  try {
    await AdminAPI.deleteInstallment(installmentId);
    showToast("تم حذف القسط بنجاح.", "success");
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}
