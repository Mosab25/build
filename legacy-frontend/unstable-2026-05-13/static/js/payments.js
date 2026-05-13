// Payments Module
async function renderPaymentForm(clientId, apartmentId) {
  const formContainer = document.getElementById("paymentFormContainer");
  if (!formContainer) return;

  formContainer.innerHTML = `
    <div class="premium-card">
      <h4>إضافة دفعة جديدة</h4>
      <form id="paymentForm">
        <div class="form-grid">
          <div class="form-field">
            <label for="paymentAmount">المبلغ</label>
            <input type="number" id="paymentAmount" required min="0" step="100">
          </div>
          <div class="form-field">
            <label for="paymentDate">التاريخ</label>
            <input type="date" id="paymentDate" required>
          </div>
          <div class="form-field">
            <label for="paymentMethod">طريقة الدفع</label>
            <select id="paymentMethod" required>
              <option value="">اختر الطريقة</option>
              <option value="cash">نقدي</option>
              <option value="bank_transfer">تحويل بنكي</option>
              <option value="installment">قسط</option>
              <option value="office_payment">دفع بالمكتب</option>
              <option value="other">أخرى</option>
            </select>
          </div>
          <div class="form-field">
            <label for="paymentNotes">ملاحظات</label>
            <textarea id="paymentNotes" rows="3"></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn primary">حفظ الدفعة</button>
          <button type="button" class="btn secondary" onclick="resetPaymentForm()">إلغاء</button>
        </div>
      </form>
    </div>
  `;

  // Set default date
  document.getElementById("paymentDate").value = new Date().toISOString().slice(0, 10);
  
  // Initialize form event listener
  initializePaymentForm(clientId, apartmentId);
}

function initializePaymentForm(clientId, apartmentId) {
  const paymentForm = document.getElementById("paymentForm");
  if (!paymentForm) return;

  paymentForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const formData = new FormData(paymentForm);
    const paymentData = {
      clientId: clientId,
      apartmentId: apartmentId,
      amount: parseFloat(formData.get('paymentAmount')),
      date: formData.get('paymentDate'),
      method: formData.get('paymentMethod'),
      notes: formData.get('paymentNotes'),
      status: 'confirmed'
    };

    try {
      await apiFetch('/api/admin/payments', {
        method: 'POST',
        body: JSON.stringify(paymentData)
      });

      showToast('تم إضافة الدفعة بنجاح', 'success');
      resetPaymentForm();
      
      // Refresh admin dashboard
      if (typeof renderAdminDashboard === 'function') {
        renderAdminDashboard();
      }
    } catch (error) {
      showToast('فشل إضافة الدفعة', 'error');
      console.error('Payment error:', error);
    }
  });
}

function resetPaymentForm() {
  const paymentForm = document.getElementById("paymentForm");
  if (paymentForm) {
    paymentForm.reset();
    document.getElementById("paymentDate").value = new Date().toISOString().slice(0, 10);
  }
}

function renderPaymentHistory(payments) {
  const container = document.getElementById("paymentHistoryContainer");
  if (!container) return;

  if (!payments || payments.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="text-align: center; padding: 40px;">
        <p>لا توجد دفعات مسجلة حالياً</p>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="payment-table-container">
      <table class="payment-table">
        <thead>
          <tr>
            <th>التاريخ</th>
            <th>العميل</th>
            <th>الشقة</th>
            <th>المبلغ</th>
            <th>الطريقة</th>
            <th>الحالة</th>
            <th>ملاحظات</th>
          </tr>
        </thead>
        <tbody>
          ${payments.map(payment => `
            <tr>
              <td>${formatDate(payment.date)}</td>
              <td>${payment.clientName || '-'}</td>
              <td>${payment.apartmentCode || '-'}</td>
              <td>${formatCurrency(payment.amount)}</td>
              <td>
                <span class="status-badge status-${payment.method}">
                  ${statusTitle(payment.method)}
                </span>
              </td>
              <td>
                <span class="status-badge status-${payment.status}">
                  ${statusTitle(payment.status)}
                </span>
              </td>
              <td>${payment.notes || '-'}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

async function loadPaymentHistory() {
  try {
    const payments = await apiFetch('/api/admin/payments');
    renderPaymentHistory(payments);
  } catch (error) {
    console.error('Failed to load payment history:', error);
    showToast('فشل تحميل سجل الدفعات', 'error');
  }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderPaymentForm,
    resetPaymentForm,
    renderPaymentHistory,
    loadPaymentHistory
  };
}
