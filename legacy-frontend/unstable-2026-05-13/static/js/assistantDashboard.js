// Assistant Dashboard Module
let assistantState = {
  deals: [],
  currentDeal: null
};

function renderAssistantDashboard() {
  const dashboard = document.getElementById("assistantDashboard");
  if (!dashboard) return;

  dashboard.innerHTML = `
    <div class="assistant-topline">
      <div>
        <h3>لوحة المساعد</h3>
        <p>إنشاء وإدارة العقود المبدئية وإرسالها للموافقة</p>
      </div>
    </div>

    <div class="deal-form">
      <h4>إنشاء عقد جديد</h4>
      <form id="newDealForm">
        <div class="form-grid">
          <div class="form-field">
            <label for="dealClient">العميل</label>
            <select id="dealClient" required>
              <option value="">اختر العميل</option>
              ${renderClientOptions()}
            </select>
          </div>
          <div class="form-field">
            <label for="dealApartment">الشقة</label>
            <select id="dealApartment" required>
              <option value="">اختر الشقة</option>
              ${renderApartmentOptions()}
            </select>
          </div>
          <div class="form-field">
            <label for="dealPrice">السعر</label>
            <input type="number" id="dealPrice" required min="0" step="1000">
          </div>
          <div class="form-field">
            <label for="dealDate">تاريخ العقد</label>
            <input type="date" id="dealDate" required>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn primary">إنشاء عقد مبدئي</button>
        </div>
      </form>
    </div>

    <div class="deal-status">
      <h4>حالة العقود</h4>
      ${renderDealStatus()}
    </div>

    <div class="deals-list">
      <h4>العقود السابقة</h4>
      <div class="deals-table-container">
        <table class="admin-updates-table">
          <thead>
            <tr>
              <th>العميل</th>
              <th>الشقة</th>
              <th>السعر</th>
              <th>التاريخ</th>
              <th>الحالة</th>
              <th>الإجراءات</th>
            </tr>
          </thead>
          <tbody id="dealsTableBody">
            ${renderDealsTable()}
          </tbody>
        </table>
      </div>
    </div>
  `;

  dashboard.classList.add("show");
  initializeAssistantEventListeners();
}

function renderClientOptions() {
  // This would fetch clients from API
  return `
    <option value="client1">أحمد محمد (RES-001)</option>
    <option value="client2">فاطمة علي (RES-002)</option>
    <option value="client3">خالد حسن (RES-003)</option>
  `;
}

function renderApartmentOptions() {
  // This would fetch available apartments from API
  return `
    <option value="apt1">شقة 101 - 137م²</option>
    <option value="apt2">شقة 102 - 125م²</option>
    <option value="apt3">شقة 103 - 120م²</option>
  `;
}

function renderDealStatus() {
  const stats = {
    total: assistantState.deals.length,
    pending: assistantState.deals.filter(d => d.status === 'pending').length,
    approved: assistantState.deals.filter(d => d.status === 'approved').length,
    rejected: assistantState.deals.filter(d => d.status === 'rejected').length
  };

  return `
    <div class="status-card">
      <h4>إجمالي العقود</h4>
      <p>${stats.total}</p>
    </div>
    <div class="status-card">
      <h4>في انتظار الموافقة</h4>
      <p>${stats.pending}</p>
    </div>
    <div class="status-card">
      <h4>معتمدة</h4>
      <p>${stats.approved}</p>
    </div>
    <div class="status-card">
      <h4>مرفوضة</h4>
      <p>${stats.rejected}</p>
    </div>
  `;
}

function renderDealsTable() {
  if (!assistantState.deals.length) {
    return `
      <tr>
        <td colspan="6" style="text-align: center; padding: 20px;">
          لا توجد عقود مسجلة حالياً
        </td>
      </tr>
    `;
  }

  return assistantState.deals.map(deal => `
    <tr>
      <td>${deal.clientName}</td>
      <td>${deal.apartmentCode}</td>
      <td>${formatCurrency(deal.price)}</td>
      <td>${formatDate(deal.date)}</td>
      <td>
        <span class="status-badge status-${deal.status}">
          ${getDealStatusText(deal.status)}
        </span>
      </td>
      <td>
        ${deal.status === 'pending' ? `
          <button class="btn secondary" onclick="submitDealForApproval('${deal.id}')">
            إرسال للموافقة
          </button>
        ` : deal.status === 'approved' ? `
          <button class="btn primary" onclick="downloadFinalContract('${deal.id}')">
            تحميل العقد النهائي
          </button>
        ` : ''}
      </td>
    </tr>
  `).join('');
}

function getDealStatusText(status) {
  const statusMap = {
    'draft': 'مسودة',
    'pending': 'في انتظار الموافقة',
    'approved': 'معتمد',
    'rejected': 'مرفوض',
    'finalized': 'نهائي'
  };
  return statusMap[status] || status;
}

function initializeAssistantEventListeners() {
  const dealForm = document.getElementById("newDealForm");
  if (dealForm) {
    dealForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      
      const formData = new FormData(dealForm);
      const dealData = {
        clientId: formData.get('dealClient'),
        apartmentId: formData.get('dealApartment'),
        price: parseFloat(formData.get('dealPrice')),
        date: formData.get('dealDate'),
        status: 'draft'
      };

      try {
        // API call to create deal
        const response = await apiFetch('/api/assistant/deals', {
          method: 'POST',
          body: JSON.stringify(dealData)
        });

        assistantState.deals.push(response.deal);
        renderAssistantDashboard();
        showToast('تم إنشاء العقد المبدئي بنجاح', 'success');
      } catch (error) {
        showToast('فشل إنشاء العقد', 'error');
      }
    });
  }
}

async function submitDealForApproval(dealId) {
  try {
    await apiFetch(`/api/assistant/deals/${dealId}/submit`, {
      method: 'POST'
    });

    const deal = assistantState.deals.find(d => d.id === dealId);
    if (deal) {
      deal.status = 'pending';
    }

    renderAssistantDashboard();
    showToast('تم إرسال العقد للموافقة', 'success');
  } catch (error) {
    showToast('فشل إرسال العقد', 'error');
  }
}

async function downloadFinalContract(dealId) {
  try {
    const response = await apiFetch(`/api/assistant/deals/${dealId}/contract`);
    
    // Create download link
    const blob = new Blob([response], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `عقد-نهائي-${dealId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('تم تحميل العقد النهائي', 'success');
  } catch (error) {
    showToast('فشل تحميل العقد', 'error');
  }
}

async function loadAssistantData() {
  try {
    const deals = await apiFetch('/api/assistant/deals');
    assistantState.deals = deals || [];
  } catch (error) {
    console.error('Failed to load assistant data:', error);
    showToast('فشل تحميل بيانات المساعد', 'error');
  }
}

// Initialize assistant dashboard
document.addEventListener("DOMContentLoaded", () => {
  const assistantTab = document.getElementById("assistantPortalTab");
  if (assistantTab) {
    assistantTab.addEventListener("click", async () => {
      await loadAssistantData();
      renderAssistantDashboard();
    });
  }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderAssistantDashboard,
    loadAssistantData,
    assistantState
  };
}
