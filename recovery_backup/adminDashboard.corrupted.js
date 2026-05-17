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
      ${statCard("إج�…ا�„ÙŠ ا�„ش�‚Ù‚", data.summary.totalApartments)}
      ${statCard("ا�„ش�‚Ù‚ ا�„Ù…تاحة", data.summary.availableApartments)}
      ${statCard("ا�„ش�‚Ù‚ ا�„Ù…حج�ˆزة", data.summary.reservedApartments)}
      ${statCard("ا�„ش�‚Ù‚ ا�„Ù…باعة", data.summary.soldApartments)}
    </div>
    <section class="data-panel">
      <div class="panel-actions">
        <button class="btn primary small" id="newClientButton" type="button">إضافة ع�…ÙŠÙ„</button>
        <button class="btn secondary small" id="newPaymentButton" type="button">إضافة دفعة</button>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("clients")}" target="_blank" rel="noopener">تصد�Šر ا�„ع�…Ù„اء Excel</a>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("apartments")}" target="_blank" rel="noopener">تصد�Šر ا�„ش�‚Ù‚ Excel</a>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("payments")}" target="_blank" rel="noopener">تصد�Šر ا�„Ù…دف�ˆعات Excel</a>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("installments")}" target="_blank" rel="noopener">تصد�Šر ا�„أ�‚ساط Excel</a>
        <a class="btn ghost small" href="${AdminAPI.exportUrl("financial-summary")}" target="_blank" rel="noopener">تصد�Šر ا�„ت�‚ر�Šر ا�„Ù…ا�„ÙŠ Excel</a>
      </div>
      ${renderAdminAlerts(data.summary || {})}
      <h3>خر�Šطة ت�ˆفر ا�„ش�‚Ù‚ داخ�„ ا�„Ù…ب�†Ù‰</h3>
      ${apartmentsLoaded ? renderBuildingMap(data.apartments || []) : LoadingState("س�Šت�… تح�…ÙŠÙ„ خر�Šطة ا�„ش�‚Ù‚ ع�†د فتح تب�ˆÙŠب ا�„ع�…Ù„اء Ùˆا�„ش�‚Ù‚.")}
    </section>
    <section class="data-panel">
      <h3>إدارة ا�„ع�…Ù„اء</h3>
      ${clientsLoaded ? renderClientsTable(data.clients || []) : LoadingState("س�Šت�… تح�…ÙŠÙ„ ا�„ع�…Ù„اء ع�†د فتح تب�ˆÙŠب ا�„ع�…Ù„اء Ùˆا�„ش�‚Ù‚.")}
    </section>
  `;
}

function renderAdminAlerts(summary) {
  const alerts = [
    { label: "ع�…Ù„اء Ù„د�ŠÙ‡Ù… Ù…با�„غ Ù…تب�‚ÙŠة", value: summary.totalRemaining },
    { label: "ع�…Ù„اء Ù…تأخر�ˆÙ† ف�Š ا�„سداد", value: summary.overdueClients },
    { label: "أ�‚ساط Ù‚اد�…ة أ�ˆ Ù…ستح�‚ة", value: summary.upcomingInstallments },
    { label: "ش�‚Ù‚ Ù…حج�ˆزة ف�Š ا�†تظار ا�„سداد", value: summary.reservedApartments },
    { label: "دفعات Ù‚ÙŠد ا�„Ù…راجعة", value: summary.pendingPayments },
  ].filter((item) => Number(item.value || 0) > 0);
  if (!alerts.length) return "";
  return `
    <div class="admin-alerts">
      <strong>ا�„ت�†ب�ŠÙ‡ات ا�„Ù…Ù‡Ù…ة</strong>
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
      <div class="floor-label"><strong>ا�„د�ˆر ${floor}</strong></div>
      ${apartments.filter((apt) => apt.floorNumber === floor).map((apt) => `
        <button class="unit-card" data-apartment-id="${apt.id}" type="button">
          <header><strong>${escapeHTML(apt.unitCode)}</strong>${StatusBadge(apt.status)}</header>
          <div>${apt.area} Ù…² - ${escapeHTML(apt.directionAr)}</div>
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
      <thead><tr><th>ا�„Ùˆحدة</th><th>ا�„د�ˆر</th><th>ا�„Ù…ساحة</th><th>ا�„اتجا�‡</th>${showStatus ? "<th>ا�„حا�„ة</th>" : ""}</tr></thead>
      <tbody>${apartments.map((apt) => `<tr><td data-label="ا�„Ùˆحدة">${escapeHTML(apt.unitCode)}</td><td data-label="ا�„د�ˆر">${apt.floorNumber}</td><td data-label="ا�„Ù…ساحة">${apt.area} Ù…²</td><td data-label="ا�„اتجا�‡">${escapeHTML(apt.directionAr)}</td>${showStatus ? `<td data-label="ا�„حا�„ة">${StatusBadge(apt.status)}</td>` : ""}</tr>`).join("")}</tbody>
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
        financialClientIds: new Set(),
        totalAmount: 0,
        paidAmount: 0,
        remainingAmount: 0,
        paymentStatuses: [],
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
  return Array.from(groups.values()).sort((a, b) => b.totalAmount - a.totalAmount);
}

function normalizedClientApartments(client) {
  const apartments = Array.isArray(client?.apartments) && client.apartments.length
    ? client.apartments
    : (client?.apartment ? [client.apartment] : []);
  return apartments
    .map((apt) => {
      const apartment = apt?.apartment || apt || {};
      return {
        ...apartment,
        ...apt,
        id: apt?.id || apt?.apartmentId || apartment.id,
        clientId: apt?.clientId || client.id,
        unitCode: apt?.unitCode || apt?.unit_code || apartment.unitCode || apartment.unit_code || "-",
        price: Number(apt?.price ?? apt?.totalAmount ?? apt?.unitPrice ?? apt?.unit_price ?? apartment.price ?? 0),
      };
    })
    .filter((apt) => apt && apt.id);
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

  const mobileCards = clients.map((client) => {
    const apartments = normalizedClientApartments(client);
    const units = apartments.map((apt) => apt.unitCode || "-").join("، ") || "-";
    return `
      <article class="mobile-client-card">
        <div class="mobile-client-header">
          <h4>${escapeHTML(client.name || "-")}</h4>
          <div class="mobile-client-code">${escapeHTML(client.code || client.portfolioCode || "-")}</div>
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
          <div><span>حالة الحجز</span>${StatusBadge(client.reservationStatus || "Pending")}</div>
          <div><span>حالة الدفع</span>${StatusBadge(client.paymentStatus)}</div>
        </div>
        <div class="mobile-client-actions">
          <button class="btn ghost small" data-client-view="${client.id}" type="button">عرض الملف</button>
          <button class="btn secondary small" data-client-payment="${client.id}" type="button">إضافة دفعة</button>
          <button class="btn ghost small" data-client-more="${client.id}" data-client-name="${escapeHTML(client.name)}" type="button">المزيد</button>
        </div>
      </article>
    `;
  }).join("");

  return `
    <div class="desktop-clients-table table-wrap"><table>
      <thead><tr><th>اسم العميل</th><th>كود الحجز</th><th>الهاتف</th><th>الشقق</th><th>الإجمالي</th><th>المدفوع</th><th>المتبقي</th><th>الحجز</th><th>الدفع</th><th>إجراءات</th></tr></thead>
      <tbody>${clients.map((client) => {
        const apartments = normalizedClientApartments(client);
        const units = apartments.map((apt) => apt.unitCode || "-").join("، ") || "-";
        return `<tr>
          <td data-label="اسم العميل">${escapeHTML(client.name)}</td>
          <td data-label="كود الحجز">${escapeHTML(client.code || client.portfolioCode || "-")}</td>
          <td data-label="الهاتف">${escapeHTML(client.phone || "-")}</td>
          <td data-label="الشقق">${escapeHTML(units)}</td>
          <td data-label="الإجمالي" data-money>${formatMoney(client.totalAmount)}</td>
          <td data-label="المدفوع" data-money>${formatMoney(client.paidAmount)}</td>
          <td data-label="المتبقي" data-money>${formatMoney(client.remainingAmount)}</td>
          <td data-label="الحجز">${StatusBadge(client.reservationStatus || "Pending")}</td>
          <td data-label="الدفع">${StatusBadge(client.paymentStatus)}</td>
          <td data-label="إجراءات" class="table-actions">
            <button class="btn ghost small" data-client-view="${client.id}" type="button">عرض الملف</button>
            <button class="btn secondary small" data-client-payment="${client.id}" type="button">إضافة دفعة</button>
            <button class="btn ghost small" data-client-more="${client.id}" data-client-name="${escapeHTML(client.name)}" type="button">المزيد</button>
          </td>
        </tr>`;
      }).join("")}</tbody>
    </table></div>
    <div class="mobile-clients-list">${mobileCards}</div>
  `;
}

function bindAdminDashboard() {
  qs("#newPaymentButton")?.addEventListener("click", async () => {
    await ensureDashboardData(["clients", "apartments"], APP_STATE.activeDashboardView);
    openPaymentForm();
  });
  qs("#newClientButton")?.addEventListener("click", async () => {
    await ensureDashboardData(["apartments"], APP_STATE.activeDashboardView);
    openClientForm();
  });

  // Use event delegation for dynamically loaded client table buttons
  qs("#dashboardContent")?.addEventListener("click", (event) => {
    const target = event.target.closest("button");
    if (!target) return;

    if (target.dataset.clientView) {
      openClientView(target.dataset.clientView);
    } else if (target.dataset.clientPayment) {
      openPaymentForm(target.dataset.clientPayment);
    } else if (target.dataset.clientMore) {
      event.stopPropagation();
      const clientId = target.dataset.clientMore;
      const clientName = target.dataset.clientName;
      openClientMoreMenu(target, [clientId], clientName);
    } else if (target.dataset.clientAddUnit) {
      openClientFormForExistingClient(target.dataset.clientAddUnit);
    } else if (target.dataset.apartmentId) {
      openClientFormFromApartment(target.dataset.apartmentId);
    }
  });
}

function openClientFormFromApartment(apartmentId) {
  const apartment = (APP_STATE.dashboard.apartments || []).find((apt) => apt.id === apartmentId);
  if (!apartment) return;
  if (apartment.status !== "Available") {
    showToast("Ù‡ذ�‡ ا�„ش�‚ة غ�Šر Ù…تاحة Ù„إضافة ع�…ÙŠÙ„ جد�Šد.", "error");
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
    <span class="eyebrow">ا�„ع�…Ù„اء</span>
    <h2>${escapeHTML(client.name)}</h2>
    <div class="client-details">
      <p><strong>ا�„ÙƒÙˆد:</strong> ${escapeHTML(client.code)}</p>
      <p><strong>ا�„Ù‡اتف:</strong> ${escapeHTML(client.phone || "-")}</p>
      <p><strong>ا�„إج�…ا�„ÙŠ:</strong> ${formatMoney(client.totalAmount)}</p>
      <p><strong>ا�„Ù…دف�ˆع:</strong> ${formatMoney(client.paidAmount)}</p>
      <p><strong>ا�„Ù…تب�‚ÙŠ:</strong> ${formatMoney(client.remainingAmount)}</p>
      <p><strong>حا�„ة ا�„سداد:</strong> ${StatusBadge(client.paymentStatus)}</p>
      ${client.apartments && client.apartments.length ? `
        <h3>ا�„ش�‚Ù‚ ا�„Ù…رتبطة</h3>
        <ul>
          ${client.apartments.map((apt) => `
            <li>
              ${escapeHTML(apt.unitCode)} - ${formatMoney(apt.price)} - ${StatusBadge(apt.status)}
              <button class="btn ghost small" data-edit-price="${client.id}" data-apartment-id="${apt.id}" data-apartment-code="${escapeHTML(apt.unitCode)}" data-current-price="${apt.price}" type="button">تعد�ŠÙ„ ا�„سعر</button>
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
        else showToast("Ù„ا ÙŠÙˆجد ر�‚Ù… Ù‡اتف", "error");
      }
      else if (action === "cancel") cancelClientReservation(context.primaryId);
    });
  });
}

function openApartmentPriceEditModalForContext(context) {
  if (!context?.apartments?.length) {
    showToast("Ù„ا ت�ˆجد ش�‚Ù‚ Ù…رتبطة ب�‡ذا ا�„ع�…ÙŠÙ„", "error");
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
    <span class="eyebrow">ا�„ع�…Ù„اء</span>
    <h2>تعد�ŠÙ„ سعر ش�‚ة</h2>
    <form id="apartmentPriceForm" class="form-grid" data-client-id="${clientId}" data-apartment-id="${apartmentId}">
      <div class="form-field full">
        <label for="priceClientName">اس�… ا�„ع�…ÙŠÙ„</label>
        <input id="priceClientName" value="${escapeHTML(clientName)}" readonly />
      </div>
      ${options.length > 1 ? `
        <div class="form-field full">
          <label for="priceApartmentSelect">اخت�Šار ا�„ش�‚ة</label>
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
        <label for="currentPrice">ا�„سعر ا�„حا�„ÙŠ</label>
        <input id="currentPrice" value="${formatAmountInput(currentPrice)}" readonly />
      </div>
      <div class="form-field">
        <label for="newPrice">ا�„سعر ا�„جد�Šد</label>
        <input id="newPrice" type="text" inputmode="numeric" autocomplete="off" required placeholder="${formatAmountInput(currentPrice)}" />
      </div>
      <div class="form-field full">
        <label for="editReason">سبب ا�„تعد�ŠÙ„</label>
        <textarea id="editReason" required></textarea>
      </div>
      <button class="btn primary full" type="submit">حفظ ا�„تعد�ŠÙ„</button>
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
      showToast("ا�„سعر ÙŠجب أ�† ÙŠÙƒÙˆÙ† أ�ƒبر Ù…Ù† أ�ˆ ÙŠسا�ˆÙŠ صفر", "error");
      return;
    }
    if (!reason) {
      showToast("سبب ا�„تعد�ŠÙ„ Ù…ط�„Ùˆب", "error");
      return;
    }

    try {
      await AdminAPI.updateApartmentPrice(form.dataset.clientId, form.dataset.apartmentId, {
        unit_price: newPrice,
        reason: reason,
      });
      closeModal();
      showToast("ت�… تعد�ŠÙ„ سعر ا�„ش�‚ة ب�†جاح", "success");
      await refreshClientsAfterApartmentPriceUpdate();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

async function refreshClientsAfterApartmentPriceUpdate() {
  await refreshClientsAfterPriceChange({ loadingSelector: "#dashboardContent .data-panel:last-child", loadingText: "جار�Š تحد�Šث ب�Šا�†ات ا�„ع�…ÙŠÙ„..." });
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
  const confirmed = confirm(`Ù‡Ù„ تر�Šد حذف ا�„ع�…ÙŠÙ„ "${clientName || ""}" ÙˆÙƒÙ„ Ùˆحدات�‡ ا�„Ù…رتبطة�Ÿ`);
  if (!confirmed) return;
  try {
    for (const id of ids) {
      await AdminAPI.deleteClient(id);
    }
    showToast("ت�… حذف ا�„ع�…ÙŠÙ„ ÙˆÙˆحدات�‡ ب�†جاح.", "success");
    await refreshClientsAfterChange({ loadingSelector: "#dashboardContent .data-panel:last-child", loadingText: "جار�Š تحد�Šث ا�„ع�…Ù„اء..." });
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function cancelClientReservation(clientId) {
  const reason = prompt("سبب ا�„إ�„غاء:");
  if (!reason) return;
  try {
    await AdminAPI.cancelClient(clientId, reason);
    showToast("ت�… إ�„غاء ا�„حجز ب�†جاح", "success");
    await refreshClientsAfterChange({ loadingSelector: "#dashboardContent .data-panel:last-child", loadingText: "جار�Š تحد�Šث ا�„ع�…Ù„اء..." });
  } catch (error) {
    showToast(error.message, "error");
  }
}

function openClientForm(preselectedApartmentId = null, prefills = null) {
  const apartments = (APP_STATE.dashboard.apartments || []).filter((apt) => apt.status === "Available");
  if (!apartments.length) {
    showToast("Ù„ا ت�ˆجد ش�‚Ù‚ Ù…تاحة Ù„إضافة حجز جد�Šد.", "error");
    return;
  }

  const initialApartmentId = apartments.some((apt) => apt.id === preselectedApartmentId) ? preselectedApartmentId : apartments[0].id;
  openModal(`
    <span class="eyebrow">ا�„ع�…Ù„اء</span>
    <h2>إضافة ع�…ÙŠÙ„ جد�Šد</h2>
    <form id="clientForm" class="form-grid">
      <div class="form-field"><label for="clientName">اس�… ا�„ع�…ÙŠÙ„</label><input id="clientName" required /></div>
      <div class="form-field"><label for="clientPhone">ر�‚Ù… ا�„Ù‡اتف</label><input id="clientPhone" /></div>
      <div class="form-field full"><label for="clientApartment">ا�„ش�‚ة</label><select id="clientApartment">${apartments.map((apt) => `<option value="${apt.id}">${escapeHTML(apt.unitCode)} - ${apt.area} Ù…² - ${formatMoney(apt.price)}</option>`).join("")}</select></div>
      <div class="form-field"><label for="clientTotal">ا�„سعر ا�„إج�…ا�„ÙŠ</label><input id="clientTotal" type="text" inputmode="numeric" autocomplete="off" required /></div>
      <div class="form-field"><label for="clientPaidAmount">ا�„Ù…ب�„غ ا�„Ù…دف�ˆع ع�†د ا�„حجز</label><input id="clientPaidAmount" type="text" inputmode="numeric" autocomplete="off" value="0" /></div>
      <div class="form-field"><label for="clientPaidMethod">طر�ŠÙ‚ة ا�„دفع</label><select id="clientPaidMethod"><option value="cash">Ù†Ù‚د�‹ا</option><option value="bank_transfer">تح�ˆÙŠÙ„ ب�†ÙƒÙŠ</option><option value="installment">Ù‚سط</option><option value="office_payment">دفع ف�Š ا�„Ù…Ùƒتب</option><option value="other">أخر�‰</option></select></div>
      <div class="form-field"><label for="clientPaidDate">تار�Šخ ا�„دفع</label><input id="clientPaidDate" type="date" /></div>
      <input id="clientSharedClientId" type="hidden" />
      <div class="form-field full"><label for="clientNotes">Ù…Ù„احظات ا�„Ù…Ùƒتب</label><textarea id="clientNotes"></textarea></div>
      <button class="btn primary full" type="submit">حفظ ا�„ع�…ÙŠÙ„</button>
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
  setButtonLoading(submitButton, true, "جار�Š ا�„حفظ...");
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
      throw new Error("ÙŠرج�‰ Ù…راجعة ب�Šا�†ات ا�„ع�…ÙŠÙ„ Ùˆا�„Ù…ب�„غ ا�„إج�…ا�„ÙŠ.");
    }
    if (paidAmount < 0 || Number.isNaN(paidAmount)) {
      throw new Error("ÙŠرج�‰ إدخا�„ Ù…ب�„غ Ù…دف�ˆع صح�Šح.");
    }
    if (paidAmount > totalAmount) {
      throw new Error("ا�„Ù…ب�„غ ا�„Ù…دف�ˆع أ�ƒبر Ù…Ù† ا�„سعر ا�„إج�…ا�„ÙŠ.");
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
        notes: "دفعة Ù…Ù‚د�…ة ع�†د ا�„حجز",
      });
    }

    closeModal();
    showToast("ت�… حفظ ا�„ع�…ÙŠÙ„ ب�†جاح.", "success");
    await refreshClientsAfterChange({ loadingSelector: "#dashboardContent .data-panel:last-child", loadingText: "جار�Š تحد�Šث ا�„ع�…Ù„اء..." });
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

