function initClientPortal() {
  qs("#clientCodeForm").addEventListener("submit", handleClientCodeSubmit);
}

async function handleClientCodeSubmit(event) {
  event.preventDefault();
  const codeInput = qs("#reservationCode");
  const button = qs("#clientCodeButton");
  const message = qs("#clientCodeMessage");
  const code = codeInput.value.trim();

  message.textContent = "";
  qs("#clientDashboard").innerHTML = "";

  if (!code) {
    message.textContent = "يرجى إدخال كود الحجز أولًا.";
    codeInput.focus();
    return;
  }

  setButtonLoading(button, true, "جاري التحقق من كود الحجز...");
  try {
    const result = await ClientAPI.verifyCode(code);
    if (result.settings?.whatsappNumber) APP_CONFIG.whatsappNumber = result.settings.whatsappNumber;
    renderClientDashboard(result.client);
    showToast("تم التحقق من كود الحجز بنجاح.", "success");
  } catch (error) {
    message.textContent = "لم نتمكن من التحقق من كود الحجز. يرجى التأكد من الكود والمحاولة مرة أخرى أو التواصل مع المكتب.";
  } finally {
    setButtonLoading(button, false);
  }
}

function renderApartmentUnitsTable(units = []) {
  if (!units.length) {
    return EmptyState("لا توجد شقق مسجلة لهذا الكود.", "سيتم عرض الشقق فور إضافتها من الإدارة.");
  }

  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>
            <th>الوحدة</th>
            <th>الدور</th>
            <th>المساحة</th>
            <th>الاتجاه</th>
            <th>الإجمالي</th>
            <th>المدفوع</th>
            <th>المتبقي</th>
            <th>حالة الدفع</th>
          </tr>
        </thead>
        <tbody>
          ${units.map((unit) => {
            const apartment = unit.apartment || {};
            return `
              <tr>
                <td data-label="الوحدة">${escapeHTML(apartment.unitCode || "-")}</td>
                <td data-label="الدور">${escapeHTML(apartment.floorNumber || "-")}</td>
                <td data-label="المساحة">${escapeHTML(apartment.area || "-")} م²</td>
                <td data-label="الاتجاه">${escapeHTML(apartment.directionAr || "-")}</td>
                <td data-label="الإجمالي" data-money>${formatMoney(unit.totalAmount)}</td>
                <td data-label="المدفوع" data-money>${formatMoney(unit.paidAmount)}</td>
                <td data-label="المتبقي" data-money>${formatMoney(unit.remainingAmount)}</td>
                <td data-label="حالة الدفع">${StatusBadge(unit.paymentStatus)}</td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderClientDashboard(client) {
  const progress = Number(client.paymentProgress ?? client.payment_progress ?? 0);
  const whatsappMessage = `مرحبًا، أريد الاستفسار عن الحجز الخاص بي. كود الحجز: ${client.code}`;

  qs("#clientDashboard").innerHTML = `
    <article class="premium-card">
      <span class="eyebrow">بيانات العميل</span>
      <h3>${escapeHTML(client.name)}</h3>
      <div class="detail-grid">
        <div class="detail-item"><span>كود الحجز الموحد</span><strong>${escapeHTML(client.code)}</strong></div>
        <div class="detail-item"><span>حالة الحجز</span><strong>${StatusBadge(client.reservationStatus)}</strong></div>
        <div class="detail-item"><span>تاريخ الحجز</span><strong>${formatDate(client.reservationDate)}</strong></div>
        <div class="detail-item"><span>تاريخ الاستلام المتوقع</span><strong>${formatDate(client.expectedDeliveryDate)}</strong></div>
      </div>
    </article>

    <article class="premium-card">
      <span class="eyebrow">الشقق المحجوزة</span>
      <h3>ملف عميل موحد</h3>
      ${renderApartmentUnitsTable(client.apartments || [])}
    </article>

    <article class="premium-card">
      <span class="eyebrow">ملخص السداد المجمع</span>
      <div class="payment-numbers">
        <div class="money-box"><span>السعر الإجمالي</span><strong>${formatMoney(client.totalAmount)}</strong></div>
        <div class="money-box"><span>المبلغ المدفوع</span><strong>${formatMoney(client.paidAmount)}</strong></div>
        <div class="money-box"><span>المبلغ المتبقي</span><strong>${formatMoney(client.remainingAmount)}</strong></div>
      </div>
      ${ProgressBar(progress)}
    </article>

    <article class="premium-card">
      <span class="eyebrow">سجل المدفوعات</span>
      ${renderPaymentTable(client.payments || [])}
    </article>

    <article class="premium-card">
      <span class="eyebrow">جدول الأقساط</span>
      ${renderInstallmentsTable(client.installments || [])}
    </article>

    <article class="premium-card">
      <h3>كشف الحجز والتواصل</h3>
      <p>يمكنك تحميل كشف الحجز للاحتفاظ بنسخة من بيانات الشقق والمدفوعات.</p>
      <div class="contact-actions">
        <button class="btn secondary small" type="button" id="downloadClientStatement">تحميل كشف الحجز</button>
        <a class="btn secondary" target="_blank" rel="noopener" href="https://wa.me/${APP_CONFIG.whatsappNumber}?text=${encodeURIComponent(whatsappMessage)}">التواصل مع المكتب عبر واتساب</a>
      </div>
    </article>
  `;

  qs("#downloadClientStatement").addEventListener("click", () => downloadFile(ClientAPI.statementUrl(client.id, client.code)));
}
