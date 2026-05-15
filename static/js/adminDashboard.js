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
        apartments: [],
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        paymentStatus: "Pending",
      });
    }
    const group = groups.get(key);
    group.ids.push(client.id);
    const apartments = normalizedClientApartments(client);
    apartments.forEach((apt) => {
      if (!group.apartments.some((item) => item.clientId === apt.clientId && item.id === apt.id)) {
        group.apartments.push(apt);
      }
    });
    group.units.push(...(apartments.length ? apartments.map((apt) => apt.unitCode || "-") : ["-"]));
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

function normalizedClientApartments(client) {
  const apartments = Array.isArray(client?.apartments) && client.apartments.length
    ? client.apartments
    : (client?.apartment ? [client.apartment] : []);
  return apartments
    .filter((apt) => apt && apt.id)
    .map((apt) => ({
      ...apt,
      clientId: apt.clientId || client.id,
      unitCode: apt.unitCode || apt.unit_code || "-",
      price: Number(apt.price ?? apt.unitPrice ?? apt.unit_price ?? 0),
    }));
}

function clientActionContext(clientIds, clientName = "") {
  const ids = (clientIds || []).map((id) => String(id).trim()).filter(Boolean);
  const clients = (APP_STATE.dashboard.clients || []).filter((client) => ids.includes(client.id));
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
          <button class="btn ghost small" data-client-view="${group.ids[0]}" type="button">عرض الملف</button>
          <button class="btn secondary small" data-client-payment="${group.ids[0]}" type="button">إضافة دفعة</button>
          <button class="btn ghost small" data-client-more="${escapeHTML(group.ids.join(","))}" data-client-name="${escapeHTML(group.name)}" type="button">المزيد</button>
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
  qsa("[data-client-view]").forEach((button) => button.addEventListener("click", () => openClientView(button.dataset.clientView)));
  qsa("[data-client-payment]").forEach((button) => button.addEventListener("click", () => openPaymentForm(button.dataset.clientPayment)));
  qsa("[data-client-more]").forEach((button) => button.addEventListener("click", (e) => {
    e.stopPropagation();
    const clientIds = button.dataset.clientMore.split(",");
    const clientName = button.dataset.clientName;
    openClientMoreMenu(button, clientIds, clientName);
  }));
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

function openClientView(clientId) {
  const client = (APP_STATE.dashboard.clients || []).find((item) => item.id === clientId);
  if (!client) return;
  openModal(`
    <span class="eyebrow">العملاء</span>
    <h2>${escapeHTML(client.name)}</h2>
    <div class="client-details">
      <p><strong>الكود:</strong> ${escapeHTML(client.code)}</p>
      <p><strong>الهاتف:</strong> ${escapeHTML(client.phone || "-")}</p>
      <p><strong>الإجمالي:</strong> ${formatMoney(client.totalAmount)}</p>
      <p><strong>المدفوع:</strong> ${formatMoney(client.paidAmount)}</p>
      <p><strong>المتبقي:</strong> ${formatMoney(client.remainingAmount)}</p>
      <p><strong>حالة السداد:</strong> ${StatusBadge(client.paymentStatus)}</p>
      ${client.apartments && client.apartments.length ? `
        <h3>الشقق المرتبطة</h3>
        <ul>
          ${client.apartments.map((apt) => `
            <li>
              ${escapeHTML(apt.unitCode)} - ${formatMoney(apt.price)} - ${StatusBadge(apt.status)}
              <button class="btn ghost small" data-edit-price="${client.id}" data-apartment-id="${apt.id}" data-apartment-code="${escapeHTML(apt.unitCode)}" data-current-price="${apt.price}" type="button">تعديل السعر</button>
            </li>
          `).join("")}
        </ul>
      ` : ""}
    </div>
  `);
  qsa("[data-edit-price]").forEach((button) => button.addEventListener("click", () => {
    openApartmentPriceEditModal(button.dataset.editPrice, button.dataset.apartmentId, button.dataset.apartmentCode, button.dataset.currentPrice, client.name, normalizedClientApartments(client));
  }));
}

function openClientMoreMenu(button, clientIds, clientName) {
  const context = clientActionContext(clientIds, clientName);
  if (!context.primaryId) return;

  // Remove existing dropdowns
  qsa(".client-more-dropdown").forEach((dropdown) => dropdown.remove());

  const dropdown = document.createElement("div");
  dropdown.className = "client-more-dropdown";
  dropdown.style.position = "absolute";
  dropdown.style.zIndex = "1000";
  dropdown.style.background = "white";
  dropdown.style.border = "1px solid #ddd";
  dropdown.style.borderRadius = "4px";
  dropdown.style.padding = "8px 0";
  dropdown.style.boxShadow = "0 2px 8px rgba(0,0,0,0.1)";

  const rect = button.getBoundingClientRect();
  dropdown.style.top = `${rect.bottom + window.scrollY + 4}px`;
  dropdown.style.left = `${rect.left + window.scrollX}px`;

  dropdown.innerHTML = `
    <button class="dropdown-item" data-action="add-unit" style="display:block;width:100%;padding:8px 16px;text-align:right;border:none;background:none;cursor:pointer;">إضافة شقة</button>
    ${context.apartments.length > 0 ? `
      <button class="dropdown-item" data-action="edit-price" style="display:block;width:100%;padding:8px 16px;text-align:right;border:none;background:none;cursor:pointer;">تعديل سعر شقة</button>
    ` : ""}
    <button class="dropdown-item" data-action="statement" style="display:block;width:100%;padding:8px 16px;text-align:right;border:none;background:none;cursor:pointer;">كشف الحجز</button>
    <button class="dropdown-item" data-action="whatsapp" style="display:block;width:100%;padding:8px 16px;text-align:right;border:none;background:none;cursor:pointer;">واتساب</button>
    <hr style="margin:8px 0;border:none;border-top:1px solid #eee;">
    <button class="dropdown-item danger" data-action="cancel" style="display:block;width:100%;padding:8px 16px;text-align:right;border:none;background:none;cursor:pointer;color:#d32f2f;">إلغاء الحجز</button>
  `;

  document.body.appendChild(dropdown);

  dropdown.querySelectorAll(".dropdown-item").forEach((item) => {
    item.addEventListener("click", (e) => {
      e.stopPropagation();
      const action = item.dataset.action;
      dropdown.remove();
      if (action === "add-unit") openClientFormForExistingClient(context.primaryId);
      else if (action === "edit-price") openApartmentPriceEditModalForContext(context);
      else if (action === "statement") downloadFile(`/api/admin/statement/${encodeURIComponent(context.primaryId)}`);
      else if (action === "whatsapp") {
        const phone = context.phone || "";
        if (phone) window.open(`https://wa.me/${phone.replace(/\D/g, "")}`, "_blank");
        else showToast("لا يوجد رقم هاتف", "error");
      }
      else if (action === "cancel") cancelClientReservation(context.primaryId);
    });
  });
}

function openApartmentPriceEditModalForContext(context) {
  if (!context?.apartments?.length) {
    showToast("لا توجد شقق مرتبطة بهذا العميل", "error");
    return;
  }
  const firstApartment = context.apartments[0];
  openApartmentPriceEditModal(firstApartment.clientId || context.primaryId, firstApartment.id, firstApartment.unitCode, firstApartment.price, context.name, context.apartments);
}

function openApartmentPriceSelectModal(clientId, clientName) {
  openApartmentPriceEditModalForContext(clientActionContext([clientId], clientName));
}

function openApartmentPriceEditModal(clientId, apartmentId, apartmentCode, currentPrice, clientName = "", apartments = []) {
  const options = apartments.length > 1 ? apartments : [];
  const selectedApartment = options.find((apt) => apt.id === apartmentId && apt.clientId === clientId) || options[0];
  openModal(`
    <span class="eyebrow">العملاء</span>
    <h2>تعديل سعر شقة</h2>
    <form id="apartmentPriceForm" class="form-grid" data-client-id="${clientId}" data-apartment-id="${apartmentId}">
      <div class="form-field full">
        <label for="priceClientName">اسم العميل</label>
        <input id="priceClientName" value="${escapeHTML(clientName)}" readonly />
      </div>
      ${options.length > 1 ? `
        <div class="form-field full">
          <label for="priceApartmentSelect">اختيار الشقة</label>
          <select id="priceApartmentSelect">
            ${options.map((apt) => `
              <option value="${apt.id}" data-client-id="${apt.clientId}" data-price="${apt.price}" data-code="${escapeHTML(apt.unitCode)}" ${apt.id === selectedApartment?.id && apt.clientId === selectedApartment?.clientId ? "selected" : ""}>
                ${escapeHTML(apt.unitCode)}
              </option>
            `).join("")}
          </select>
        </div>
      ` : `<input id="priceApartmentSelect" type="hidden" value="${escapeHTML(apartmentId)}" />`}
      <div class="form-field">
        <label for="currentPrice">السعر الحالي</label>
        <input id="currentPrice" value="${formatAmountInput(currentPrice)}" readonly />
      </div>
      <div class="form-field">
        <label for="newPrice">السعر الجديد</label>
        <input id="newPrice" type="text" inputmode="numeric" autocomplete="off" required placeholder="${formatAmountInput(currentPrice)}" />
      </div>
      <div class="form-field full">
        <label for="editReason">سبب التعديل</label>
        <textarea id="editReason" required></textarea>
      </div>
      <button class="btn primary full" type="submit">حفظ التعديل</button>
    </form>
  `);

  qs("#newPrice").value = formatAmountInput(currentPrice);
  qs("#newPrice").addEventListener("input", (event) => {
    event.target.value = formatAmountInput(event.target.value);
  });
  qs("#priceApartmentSelect")?.addEventListener("change", (event) => {
    const option = event.target.options[event.target.selectedIndex];
    const form = qs("#apartmentPriceForm");
    form.dataset.clientId = option.dataset.clientId || clientId;
    form.dataset.apartmentId = option.value;
    const price = Number(option.dataset.price || 0);
    qs("#currentPrice").value = formatAmountInput(price);
    qs("#newPrice").value = formatAmountInput(price);
  });

  qs("#apartmentPriceForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = qs("#apartmentPriceForm");
    const priceValue = qs("#newPrice").value.trim();
    const newPrice = parseFormattedAmount(priceValue);
    const reason = qs("#editReason").value.trim();

    if (!priceValue || Number.isNaN(newPrice) || newPrice < 0) {
      showToast("السعر يجب أن يكون أكبر من أو يساوي صفر", "error");
      return;
    }
    if (!reason) {
      showToast("سبب التعديل مطلوب", "error");
      return;
    }

    try {
      await AdminAPI.updateApartmentPrice(form.dataset.clientId, form.dataset.apartmentId, {
        unit_price: newPrice,
        reason: reason,
      });
      closeModal();
      showToast("تم تعديل سعر الشقة بنجاح", "success");
      await refreshClientsAfterApartmentPriceUpdate();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

async function refreshClientsAfterApartmentPriceUpdate() {
  await refreshClientsAfterPriceChange({ loadingSelector: "#dashboardContent .data-panel:last-child", loadingText: "جاري تحديث بيانات العميل..." });
}

function formatAmountInput(value) {
  const clean = String(value).replace(/[^\d]/g, "");
  if (!clean) return "";
  return Number(clean).toLocaleString("en-US");
}

function parseFormattedAmount(value) {
  const clean = String(value).replace(/[^\d]/g, "");
  return clean ? Number(clean) : 0;
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
    await refreshClientsAfterChange({ loadingSelector: "#dashboardContent .data-panel:last-child", loadingText: "جاري تحديث العملاء..." });
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function cancelClientReservation(clientId) {
  const reason = prompt("سبب الإلغاء:");
  if (!reason) return;
  try {
    await AdminAPI.cancelClient(clientId, reason);
    showToast("تم إلغاء الحجز بنجاح", "success");
    await refreshClientsAfterChange({ loadingSelector: "#dashboardContent .data-panel:last-child", loadingText: "جاري تحديث العملاء..." });
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
    await refreshClientsAfterChange({ loadingSelector: "#dashboardContent .data-panel:last-child", loadingText: "جاري تحديث العملاء..." });
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
