// Client Portal Module
async function renderClientDashboard(client) {
  const dashboard = document.getElementById("clientDashboard");
  if (!dashboard) return;

  dashboard.innerHTML = `
    <div class="dashboard-topline">
      <div>
        <h3>بيانات الحجز الخاصة بك</h3>
        <p>تفاصيل وحدتك، المدفوعات، والمتبقي في مساحة واحدة.</p>
      </div>
    </div>

    <div class="dashboard-grid">
      <div class="premium-card">
        <h4>تفاصيل الوحدة</h4>
        <div class="apartment-card-layout">
          <div class="apartment-visual">
            <div class="unit-code-large">${client.apartmentCode || client.unitCode || "N/A"}</div>
          </div>
          <div>
            <div class="detail-list">
              <div class="detail-item">
                <span>المساحة</span>
                <strong>${client.apartmentArea || client.area || "N/A"} م²</strong>
              </div>
              <div class="detail-item">
                <span>النوع</span>
                <strong>${client.apartmentType || client.type || "N/A"}</strong>
              </div>
              <div class="detail-item">
                <span>الدور</span>
                <strong>${client.apartmentFloor || client.floor || "N/A"}</strong>
              </div>
              <div class="detail-item">
                <span>الاتجاه</span>
                <strong>${client.apartmentDirection || client.direction || "N/A"}</strong>
              </div>
            </div>
            <div class="feature-list">
              <span class="feature-pill">غرف نوم: ${client.bedrooms || "N/A"}</span>
              <span class="feature-pill">حمام: ${client.bathrooms || "N/A"}</span>
              <span class="feature-pill">مطبخ: ${client.kitchen || "N/A"}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="premium-card">
        <h4>ملخص المالية</h4>
        <div class="payment-numbers">
          <div class="money-box">
            <span>إجمالي السعر</span>
            <strong>${formatCurrency(client.totalAmount || client.price || 0)}</strong>
          </div>
          <div class="money-box">
            <span>المدفوع</span>
            <strong>${formatCurrency(client.paidAmount || client.paid || 0)}</strong>
          </div>
          <div class="money-box">
            <span>المتبقي</span>
            <strong>${formatCurrency(client.remainingAmount || client.remaining || 0)}</strong>
          </div>
        </div>
        <div class="progress-line">
          <div class="progress-line-head">
            <span>نسبة السداد</span>
            <span>${formatPercent(client.paymentPercentage || 0)}</span>
          </div>
          <div class="light-progress-track" aria-label="نسبة السداد">
            <div class="light-progress-fill" style="width: ${client.paymentPercentage || 0}%"></div>
          </div>
        </div>
      </div>
    </div>

    <div class="premium-card" style="margin-top: 14px;">
      <h4>سجل الدفعات</h4>
      <div class="payment-table-container">
        <table class="payment-table">
          <thead>
            <tr>
              <th>التاريخ</th>
              <th>المبلغ</th>
              <th>طريقة الدفع</th>
              <th>الحالة</th>
              <th>ملاحظات</th>
            </tr>
          </thead>
          <tbody>
            ${renderPaymentHistory(client.payments || [])}
          </tbody>
        </table>
      </div>
    </div>

    <div class="premium-card" style="margin-top: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div>
          <h4>كشف الحجز</h4>
          <p>تحميل نسخة PDF من كشف الحجز الخاص بك</p>
        </div>
        <button class="btn primary" data-statement-client="${client.id}" onclick="downloadReservationStatement('${client.id}')">
          تحميل كشف الحجز
        </button>
      </div>
    </div>
  `;

  dashboard.classList.add("show");
}

function renderPaymentHistory(payments) {
  if (!payments || payments.length === 0) {
    return `
      <tr>
        <td colspan="5" style="text-align: center; padding: 20px; color: #716657;">
          لا توجد دفعات مسجلة حالياً
        </td>
      </tr>
    `;
  }

  return payments.map(payment => `
    <tr>
      <td>${formatDate(payment.date)}</td>
      <td>${formatCurrency(payment.amount)}</td>
      <td>${statusTitle(payment.method)}</td>
      <td>
        <span class="status-badge status-${payment.status}">
          ${statusTitle(payment.status)}
        </span>
      </td>
      <td>${payment.notes || '-'}</td>
    </tr>
  `).join('');
}

async function downloadReservationStatement(clientId) {
  try {
    const response = await apiFetch(`/api/clients/${clientId}/statement`);
    
    // Create download link
    const blob = new Blob([response], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `كشف-حجز-${clientId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('تم تحميل كشف الحجز بنجاح', 'success');
  } catch (error) {
    console.error('Error downloading statement:', error);
    showToast('فشل تحميل كشف الحجز', 'error');
  }
}

// Initialize client portal functionality
document.addEventListener("DOMContentLoaded", () => {
  const clientCodeForm = document.getElementById("clientCodeForm");
  if (!clientCodeForm) return;

  clientCodeForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const codeInput = document.getElementById("reservationCode");
    const button = document.getElementById("clientCodeButton");
    const error = document.getElementById("clientCodeMessage");
    const success = document.getElementById("clientSuccessMessage");
    const code = codeInput.value.trim();

    error.classList.remove("show");
    success.classList.remove("show");
    document.getElementById("clientDashboard").classList.remove("show");

    if (!code || code.trim().length < 8) {
      error.textContent = "كود الحجز غير صالح. يجب أن يكون 8 أحرف على الأقل.";
      error.classList.add("show");
      codeInput.focus();
      return;
    }

    // Show loading state
    button.textContent = "جاري البحث...";
    button.disabled = true;

    try {
      const client = await findClientByCode(code);
      button.textContent = "عرض بيانات الحجز";
      button.disabled = false;

      if (!client) {
        error.textContent = "لم نتمكن من التحقق من كود الحجز. يرجى التأكد من الكود والمحاولة مرة أخرى أو التواصل مع المكتب.";
        error.classList.add("show");
        return;
      }

      // Calculate financials (this would normally come from backend)
      client.paidAmount = client.paid || 0;
      client.remainingAmount = (client.totalAmount || 0) - client.paidAmount;
      client.paymentPercentage = client.totalAmount > 0 ? (client.paidAmount / client.totalAmount) * 100 : 0;

      success.textContent = "تم التحقق من كود الحجز بنجاح.";
      success.classList.add("show");
      renderClientDashboard(client);
    } catch (apiError) {
      button.textContent = "عرض بيانات الحجز";
      button.disabled = false;
      error.textContent = apiError.message || "حدث خطأ في الاتصال بالخادم. يرجى المحاولة مرة أخرى.";
      error.classList.add("show");
    }
  });
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderClientDashboard,
    renderPaymentHistory,
    downloadReservationStatement
  };
}
