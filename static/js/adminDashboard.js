function statCard(label, value) {
  const display = value === undefined || value === null ? "..." : Number(value || 0).toLocaleString("ar-EG");
  return `<article class="stat-card"><strong>${display}</strong><span>${escapeHTML(label)}</span></article>`;
}

function renderAdminDashboard() {
  const data = APP_STATE.dashboard;
  const apartmentsLoaded = isDashboardLoaded("apartments");
  const clientsLoaded = isDashboardLoaded("clients");
  return `
    <div class="dashboard-grid">
      ${statCard("إجمالي الشقق", data.summary.totalApartments)}
      ${statCard("الشقق المتاحة", data.summary.availableApartments)}
      ${statCard("الشقق المحجوزة", data.summary.reservedApartments)}
      ${statCard("الشقق المباعة", data.summary.soldApartments)}
    </div>
    <section class="data-panel">
      <div class="panel-actions">
        <button class="btn primary small" id="newClientButton" type="button">إضافة عميل</button>
        <button class="btn secondary small" id="newPaymentButton" type="button">إضافة دفعة</button>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("clients")}" target="_blank" rel="noopener">تصدير العملاء Excel</a>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("apartments")}" target="_blank" rel="noopener">تصدير الشقق Excel</a>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("payments")}" target="_blank" rel="noopener">تصدير المدفوعات Excel</a>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("installments")}" target="_blank" rel="noopener">تصدير الأقساط Excel</a>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("financial-summary")}" target="_blank" rel="noopener">تصدير التقرير المالي Excel</a>
      </div>
      ${renderAdminAlerts(data.summary || {})}
      <h3>خريطة توفر الشقق داخل المبنى</h3>
      ${apartmentsLoaded ? renderBuildingMap(data.apartments || []) : LoadingState("سيتم تحميل خريطة الشقق عند فتح تبويب العملاء والشقق.")}
    </section>
    <section class="data-panel">
      <h3>إدارة العملاء</h3>
      ${clientsLoaded ? renderClientsTable(data.clients || []) : LoadingState("سيتم تحميل العملاء عند فتح تبويب العملاء والشقق.")}
    </section>
  `;
}

function renderAdminAlerts(summary) {
  const alerts = [
    { label: "عملاء لديهم مبالغ متبقية", value: summary.totalRemaining },
    { label: "عملاء متأخرون في السداد", value: summary.overdueClients },
    { label: "أقساط قادمة أو مستحقة", value: summary.upcomingInstallments },
    { label: "شقق محجوزة في انتظار السداد", value: summary.reservedApartments },
    { label: "دفعات قيد المراجعة", value: summary.pendingPayments },
  ].filter((item) => Number(item.value || 0) > 0);
  if (!alerts.length) return "";
  return `
    <div class="admin-alerts">
      <strong>التنبيهات المهمة</strong>
      <div>
        ${alerts.map((item) => `<span>${escapeHTML(item.label)}: ${Number(item.value || 0).toLocaleString("ar-EG")}</span>`).join("")}
      </div>
    </div>
  `;
}

function renderBuildingMap(apartments) {
  const floors = Array.from({ length: 7 }, (_, index) => 7 - index);
  return `<div class="building-map">${floors.map((floor) => `
    <div class="floor-row">
      <div class="floor-label"><strong>الدور ${floor}</strong></div>
      ${apartments.filter((apt) => apt.floorNumber === floor).map((apt) => `
        <button class="unit-card" data-apartment-id="${apt.id}" type="button">
          <header><strong>${escapeHTML(apt.unitCode)}</strong>${StatusBadge(apt.status)}</header>
          <div>${apt.area} م² - ${escapeHTML(apt.directionAr)}</div>
          <div>${formatMoney(apt.price)}</div>
        </button>
      `).join("")}
    </div>
  `).join("")}</div>`;
}

function renderApartmentsTable(apartments, showStatus = true) {
  if (!apartments.length) return EmptyState();
  return `
    <div class="table-wrap"><table>
      <thead><tr><th>الوحدة</th><th>الدور</th><th>المساحة</th><th>الاتجاه</th>${showStatus ? "<th>الحالة</th>" : ""}</tr></thead>
      <tbody>${apartments.map((apt) => `<tr><td data-label="الوحدة">${escapeHTML(apt.unitCode)}</td><td data-label="الدور">${apt.floorNumber}</td><td data-label="المساحة">${apt.area} م²</td><td data-label="الاتجاه">${escapeHTML(apt.directionAr)}</td>${showStatus ? `<td data-label="الحالة">${StatusBadge(apt.status)}</td>` : ""}</tr>`).join("")}</tbody>
    </table></div>
  `;
}

function buildPortfolioGroups(clients) {
  const groups = new Map();
  for (const client of clients) {
    const code = (client.portfolioCode || client.code || "").trim();
    const key = code || client.id;
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        code: code || client.code,
        name: client.name,
        phone: client.phone || "",
        officeNotes: client.officeNotes || "",
        ids: [],
        units: [],
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        paymentStatus: "Pending",
      });
    }
    const group = groups.get(key);
    group.ids.push(client.id);
    group.units.push(client.apartment?.unitCode || "-");
    group.totalAmount += Number(client.totalAmount || 0);
    group.paidAmount += Number(client.paidAmount || 0);
    group.remainingAmount += Number(client.remainingAmount || 0);
    const state = String(client.paymentStatus || "").toLowerCase();
    if (state === "overdue") group.paymentStatus = "Overdue";
  }
  for (const group of groups.values()) {
    if (group.paymentStatus === "Overdue") continue;
    if (group.totalAmount > 0 && group.remainingAmount <= 0) group.paymentStatus = "Fully Paid";
    else if (group.paidAmount > 0) group.paymentStatus = "Partially Paid";
    else group.paymentStatus = "Pending";
  }
  return Array.from(groups.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

function renderClientsTable(clients) {
  if (!clients.length) {
    return EmptyState("لا توجد بيانات متاحة حاليًا.", "سيتم عرض العملاء فور إضافتهم من لوحة الإدارة.");
  }

  const groups = buildPortfolioGroups(clients);
  return `
    <div class="table-wrap"><table>
      <thead><tr><th>اسم العميل</th><th>كود الحجز</th><th>الوحدات</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الدفع</th><th>إجراءات</th></tr></thead>
      <tbody>${groups.map((group) => `<tr>
        <td data-label="اسم العميل">${escapeHTML(group.name)}</td>
        <td data-label="كود الحجز">${escapeHTML(group.code)}</td>
        <td data-label="الوحدات">${escapeHTML(group.units.join(" - "))}</td>
        <td data-label="الإجمالي" data-money>${formatMoney(group.totalAmount)}</td>
        <td data-label="المدفوع" data-money>${formatMoney(group.paidAmount)}</td>
        <td data-label="المتبقي" data-money>${formatMoney(group.remainingAmount)}</td>
        <td data-label="الدفع">${StatusBadge(group.paymentStatus)}</td>
        <td data-label="إجراءات" class="table-actions">
          <button class="btn ghost small" data-client-payment="${group.ids[0]}" type="button">دفعة</button>
          <button class="btn secondary small" data-client-add-unit="${group.ids[0]}" type="button">إضافة شقة أخرى</button>
          <button class="btn danger small" data-client-delete-group="${escapeHTML(group.ids.join(","))}" data-client-name="${escapeHTML(group.name)}" type="button">حذف</button>
        </td>
      </tr>`).join("")}</tbody>
    </table></div>
  `;
}

function bindAdminDashboard() {
  qs("#newPaymentButton")?.addEventListener("click", async () => {
    await ensureDashboardData(["clients", "apartments"], APP_STATE.activeDashboardView);
    openPaymentForm();
  });
  qsa("[data-client-payment]").forEach((button) => button.addEventListener("click", () => openPaymentForm(button.dataset.clientPayment)));
  qsa("[data-client-add-unit]").forEach((button) => button.addEventListener("click", () => openClientFormForExistingClient(button.dataset.clientAddUnit)));
  qsa("[data-client-delete-group]").forEach((button) => button.addEventListener("click", () => deleteClientGroup(button.dataset.clientDeleteGroup, button.dataset.clientName)));
  qsa("[data-apartment-id]").forEach((button) => button.addEventListener("click", () => openClientFormFromApartment(button.dataset.apartmentId)));
  qs("#newClientButton")?.addEventListener("click", async () => {
    await ensureDashboardData(["apartments"], APP_STATE.activeDashboardView);
    openClientForm();
  });
}

function openClientFormFromApartment(apartmentId) {
  const apartment = (APP_STATE.dashboard.apartments || []).find((apt) => apt.id === apartmentId);
  if (!apartment) return;
  if (apartment.status !== "Available") {
    showToast("هذه الشقة غير متاحة لإضافة عميل جديد.", "error");
    return;
  }
  openClientForm(apartmentId);
}

function openClientFormForExistingClient(clientId) {
  const client = (APP_STATE.dashboard.clients || []).find((item) => item.id === clientId);
  if (!client) return;
  openClientForm(null, {
    name: client.name || "",
    phone: client.phone || "",
    notes: client.officeNotes || "",
    sharedClientId: client.id || "",
  });
}

async function deleteClientGroup(clientIds, clientName) {
  const ids = (clientIds || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!ids.length) return;
  const confirmed = confirm(`هل تريد حذف العميل "${clientName || ""}" وكل وحداته المرتبطة؟`);
  if (!confirmed) return;
  try {
    for (const id of ids) {
      await AdminAPI.deleteClient(id);
    }
    showToast("تم حذف العميل ووحداته بنجاح.", "success");
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openClientForm(preselectedApartmentId = null, prefills = null) {
  const apartments = (APP_STATE.dashboard.apartments || []).filter((apt) => apt.status === "Available");
  if (!apartments.length) {
    showToast("لا توجد شقق متاحة لإضافة حجز جديد.", "error");
    return;
  }

  const initialApartmentId = apartments.some((apt) => apt.id === preselectedApartmentId) ? preselectedApartmentId : apartments[0].id;
  openModal(`
    <span class="eyebrow">العملاء</span>
    <h2>إضافة عميل جديد</h2>
    <form id="clientForm" class="form-grid">
      <div class="form-field"><label for="clientName">اسم العميل</label><input id="clientName" required /></div>
      <div class="form-field"><label for="clientPhone">رقم الهاتف</label><input id="clientPhone" /></div>
      <div class="form-field full"><label for="clientApartment">الشقة</label><select id="clientApartment">${apartments.map((apt) => `<option value="${apt.id}">${escapeHTML(apt.unitCode)} - ${apt.area} م² - ${formatMoney(apt.price)}</option>`).join("")}</select></div>
      <div class="form-field"><label for="clientTotal">السعر الإجمالي</label><input id="clientTotal" type="text" inputmode="numeric" autocomplete="off" required /></div>
      <div class="form-field"><label for="clientPaidAmount">المبلغ المدفوع عند الحجز</label><input id="clientPaidAmount" type="text" inputmode="numeric" autocomplete="off" value="0" /></div>
      <div class="form-field"><label for="clientPaidMethod">طريقة الدفع</label><select id="clientPaidMethod"><option value="cash">نقدًا</option><option value="bank_transfer">تحويل بنكي</option><option value="installment">قسط</option><option value="office_payment">دفع في المكتب</option><option value="other">أخرى</option></select></div>
      <div class="form-field"><label for="clientPaidDate">تاريخ الدفع</label><input id="clientPaidDate" type="date" /></div>
      <input id="clientSharedClientId" type="hidden" />
      <div class="form-field full"><label for="clientNotes">ملاحظات المكتب</label><textarea id="clientNotes"></textarea></div>
      <button class="btn primary full" type="submit">حفظ العميل</button>
    </form>
  `);

  qs("#clientPaidDate").value = new Date().toISOString().slice(0, 10);
  qs("#clientApartment").value = initialApartmentId;
  if (prefills) {
    qs("#clientName").value = prefills.name || "";
    qs("#clientPhone").value = prefills.phone || "";
    qs("#clientNotes").value = prefills.notes || "";
    qs("#clientSharedClientId").value = prefills.sharedClientId || "";
  }
  qs("#clientApartment").addEventListener("change", () => {
    const apt = apartments.find((item) => item.id === qs("#clientApartment").value);
    qs("#clientTotal").value = normalizeAmountForInput(apt?.price || "");
  });
  qs("#clientTotal").addEventListener("input", (event) => {
    event.target.value = normalizeAmountForInput(event.target.value);
  });
  qs("#clientPaidAmount").addEventListener("input", (event) => {
    event.target.value = normalizeAmountForInput(event.target.value);
  });
  qs("#clientApartment").dispatchEvent(new Event("change"));
  qs("#clientForm").addEventListener("submit", saveClient);
}

async function saveClient(event) {
  event.preventDefault();
  const submitButton = qs("#clientForm button[type='submit']");
  setButtonLoading(submitButton, true, "جاري الحفظ...");
  try {
    const fullName = qs("#clientName").value.trim();
    const phone = qs("#clientPhone").value.trim();
    const apartmentId = qs("#clientApartment").value;
    const totalAmount = parseAmountValue(qs("#clientTotal").value);
    const paidAmount = parseAmountValue(qs("#clientPaidAmount").value || 0);
    const paymentMethod = qs("#clientPaidMethod").value;
    const paymentDate = qs("#clientPaidDate").value;
    const officeNotes = qs("#clientNotes").value.trim();
    const sharedClientId = qs("#clientSharedClientId").value.trim();

    if (!fullName || !apartmentId || totalAmount <= 0 || Number.isNaN(totalAmount)) {
      throw new Error("يرجى مراجعة بيانات العميل والمبلغ الإجمالي.");
    }
    if (paidAmount < 0 || Number.isNaN(paidAmount)) {
      throw new Error("يرجى إدخال مبلغ مدفوع صحيح.");
    }
    if (paidAmount > totalAmount) {
      throw new Error("المبلغ المدفوع أكبر من السعر الإجمالي.");
    }

    const createResult = await AdminAPI.createClient({
      full_name: fullName,
      phone,
      apartment_id: apartmentId,
      total_amount: totalAmount,
      reservation_status: "confirmed",
      office_notes: officeNotes,
      shared_client_id: sharedClientId || undefined,
    });
    const client = createResult.client;

    if (paidAmount > 0) {
      await AdminAPI.createPayment({
        client_id: client.id,
        amount: paidAmount,
        payment_date: paymentDate || new Date().toISOString().slice(0, 10),
        payment_method: paymentMethod,
        payment_status: "confirmed",
        notes: "دفعة مقدمة عند الحجز",
      });
    }

    closeModal();
    showToast("تم حفظ العميل بنجاح.", "success");
    await loadDashboard();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(submitButton, false);
  }
}

function normalizeAmountForInput(value) {
  return normalizeAmountValue(value).replace(/[^\d]/g, "");
}

function parseAmountValue(value) {
  const clean = normalizeAmountForInput(value);
  if (!clean) return 0;
  return Number(clean);
}
