// Admin Dashboard Module
let reservationState = {
  clients: [],
  apartments: [],
  payments: [],
  installments: [],
  receipts: [],
  auditLogs: [],
  settings: {},
  searchTerm: "",
  activeFilter: "all",
  selectedApartmentId: null,
  adminUnlocked: false
};

function renderAdminDashboard() {
  syncReservationData();
  renderAdminOverview();
  renderAdminAlerts();
  document.getElementById("buildingMap").innerHTML = BuildingAvailabilityMap();
  document.getElementById("clientTableBody").innerHTML = ClientTable();
  renderAuditLogs();
  populateAdminSelects();
  populateSettingsForm();
  renderSelectedUnitPanel();
}

function renderAdminOverview() {
  const overview = document.getElementById("adminOverview");
  if (!overview) return;

  const stats = {
    totalClients: reservationState.clients.length,
    totalApartments: reservationState.apartments.length,
    totalPayments: reservationState.payments.length,
    totalRevenue: reservationState.payments.reduce((sum, p) => sum + (p.amount || 0), 0),
    pendingApprovals: reservationState.clients.filter(c => c.reservationStatus === "pending").length,
    soldUnits: reservationState.apartments.filter(a => a.status === "Sold").length
  };

  overview.innerHTML = `
    <div class="overview-card">
      <span>إجمالي العملاء</span>
      <strong>${stats.totalClients}</strong>
    </div>
    <div class="overview-card">
      <span>إجمالي الشقق</span>
      <strong>${stats.totalApartments}</strong>
    </div>
    <div class="overview-card">
      <span>الشقق المباعة</span>
      <strong>${stats.soldUnits}</strong>
    </div>
    <div class="overview-card">
      <span>إجمالي الدفعات</span>
      <strong>${stats.totalPayments}</strong>
    </div>
    <div class="overview-card">
      <span>الإيرادات</span>
      <strong>${formatCurrency(stats.totalRevenue)}</strong>
    </div>
    <div class="overview-card">
      <span>في انتظار الموافقة</span>
      <strong>${stats.pendingApprovals}</strong>
    </div>
  `;
}

function BuildingAvailabilityMap() {
  const apartments = reservationState.apartments;
  const floors = {};
  
  // Group apartments by floor
  apartments.forEach(apt => {
    const floor = apt.floor || 1;
    if (!floors[floor]) floors[floor] = [];
    floors[floor].push(apt);
  });

  // Generate HTML for each floor
  return Object.entries(floors)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([floor, floorApts]) => {
      const floorHtml = floorApts.map(apt => {
        const client = getClientForApartment(apt.id);
        const statusClass = getStatusClass(apt.status);
        const clientInfo = client ? `data-client-id="${client.id}"` : '';
        
        return `
          <article class="apartment-card ${statusClass}" data-apartment-id="${apt.id}" ${clientInfo}>
            <div class="apartment-header">
              <span class="unit-code">${apt.unitCode}</span>
              <span class="status-badge status-${apt.status.toLowerCase().replace(' ', '-')}">
                ${statusTitle(apt.status)}
              </span>
            </div>
            <div class="apartment-body">
              <div class="apartment-info">
                <span class="area">${apt.area} م²</span>
                <span class="type">${apt.type}</span>
                <span class="direction">${apt.direction}</span>
              </div>
              <div class="apartment-price">
                <strong>${formatCurrency(apt.price)}</strong>
              </div>
            </div>
          </article>
        `;
      }).join('');

      return `
        <div class="floor-section">
          <h4>الدور ${floor}</h4>
          <div class="apartments-grid">${floorHtml}</div>
        </div>
      `;
    }).join('');
}

function ClientTable() {
  let clients = [...reservationState.clients];
  
  // Apply search filter
  if (reservationState.searchTerm) {
    const term = reservationState.searchTerm.toLowerCase();
    clients = clients.filter(client => 
      client.name?.toLowerCase().includes(term) ||
      client.code?.toLowerCase().includes(term) ||
      client.apartmentCode?.toLowerCase().includes(term)
    );
  }

  // Apply status filter
  if (reservationState.activeFilter !== "all") {
    clients = clients.filter(client => 
      client.reservationStatus === reservationState.activeFilter
    );
  }

  if (clients.length === 0) {
    return `
      <tr>
        <td colspan="6">
          <div class="empty-state">لا توجد عملاء مطابقين للبحث</div>
        </td>
      </tr>
    `;
  }

  return clients.map(client => `
    <tr>
      <td>${client.code || '-'}</td>
      <td>${client.name || '-'}</td>
      <td>${client.phone || '-'}</td>
      <td>${client.apartmentCode || '-'}</td>
      <td>
        <span class="status-badge status-${client.reservationStatus?.toLowerCase().replace(' ', '-') || 'pending'}">
          ${statusTitle(client.reservationStatus)}
        </span>
      </td>
      <td>
        <button class="btn secondary" data-client-action="edit" data-client-id="${client.id}">
          تعديل
        </button>
      </td>
    </tr>
  `).join('');
}

function getStatusClass(status) {
  const statusMap = {
    'Available': 'available',
    'Reserved': 'reserved',
    'Sold': 'sold',
    'Pending Payment': 'pending-payment'
  };
  return statusMap[status] || 'available';
}

function getClientForApartment(apartmentId) {
  return reservationState.clients.find(client => client.apartmentId === apartmentId);
}

function getClientById(clientId) {
  return reservationState.clients.find(client => client.id === clientId);
}

function getApartment(apartmentId) {
  return reservationState.apartments.find(apt => apt.id === apartmentId);
}

function renderAuditLogs() {
  const target = document.getElementById("auditLogTableBody");
  if (!target) return;
  
  if (!reservationState.auditLogs.length) {
    target.innerHTML = `<tr><td colspan="5"><div class="empty-state">لا توجد إجراءات إدارية مسجلة حتى الآن.</div></td></tr>`;
    return;
  }

  target.innerHTML = reservationState.auditLogs
    .slice(0, 12)
    .map(log => `
      <tr>
        <td>${escapeHTML(log.admin_name || log.adminName || "النظام")}</td>
        <td>${escapeHTML(log.action_type || log.actionType || "-")}</td>
        <td>${escapeHTML(log.entity_type || log.entityType || "-")}</td>
        <td>${escapeHTML(log.description || "-")}</td>
        <td>${formatDate(log.created_at || log.createdAt)}</td>
      </tr>
    `).join('');
}

function populateAdminSelects() {
  const clientSelect = document.getElementById("assignmentClientSelect");
  const apartmentSelect = document.getElementById("assignmentApartmentSelect");
  
  if (clientSelect) {
    clientSelect.innerHTML = `
      <option value="">اختر العميل</option>
      ${reservationState.clients.map(client => 
        `<option value="${client.id}">${client.name} (${client.code})</option>`
      ).join('')}
    `;
  }

  if (apartmentSelect) {
    apartmentSelect.innerHTML = `
      <option value="">اختر الشقة</option>
      ${reservationState.apartments.map(apt => 
        `<option value="${apt.id}">${apt.unitCode} - ${apt.area}م²</option>`
      ).join('')}
    `;
  }
}

function populateSettingsForm() {
  const settings = reservationState.settings || {};
  const fields = {
    settingOfficeName: settings.office_name,
    settingOfficePhone: settings.office_phone,
    settingWhatsapp: settings.whatsapp_number,
    settingOfficeAddress: settings.office_address,
    settingCurrency: settings.currency,
    settingReceiptPrefix: settings.receipt_prefix,
    settingFooter: settings.statement_footer,
  };
  
  Object.entries(fields).forEach(([id, value]) => {
    const input = document.getElementById(id);
    if (input && document.activeElement !== input) {
      input.value = value || "";
    }
  });
}

function renderSelectedUnitPanel() {
  const panel = document.getElementById("selectedUnitPanel");
  if (!panel || !reservationState.selectedApartmentId) return;

  const apartment = getApartment(reservationState.selectedApartmentId);
  const client = getClientForApartment(reservationState.selectedApartmentId);

  if (!apartment) return;

  panel.innerHTML = `
    <div class="premium-card">
      <h4>تفاصيل الوحدة المختارة</h4>
      <div class="apartment-card-layout">
        <div class="apartment-visual">
          <div class="unit-code-large">${apartment.unitCode}</div>
        </div>
        <div>
          <div class="detail-list">
            <div class="detail-item">
              <span>المساحة</span>
              <strong>${apartment.area} م²</strong>
            </div>
            <div class="detail-item">
              <span>النوع</span>
              <strong>${apartment.type}</strong>
            </div>
            <div class="detail-item">
              <span>الدور</span>
              <strong>${apartment.floor}</strong>
            </div>
            <div class="detail-item">
              <span>الاتجاه</span>
              <strong>${apartment.direction}</strong>
            </div>
          </div>
          <div class="feature-list">
            <span class="feature-pill">غرف نوم: ${apartment.bedrooms}</span>
            <span class="feature-pill">حمام: ${apartment.bathrooms}</span>
            <span class="feature-pill">مطبخ: ${apartment.kitchen}</span>
          </div>
        </div>
      </div>
      <div class="detail-list" style="margin-top: 10px;">
        <div class="detail-item">
          <span>السعر</span>
          <strong>${formatCurrency(apartment.price)}</strong>
        </div>
        <div class="detail-item">
          <span>الحالة</span>
          <strong>
            <span class="status-badge status-${apartment.status.toLowerCase().replace(' ', '-')}">
              ${statusTitle(apartment.status)}
            </span>
          </strong>
        </div>
        ${client ? `
          <div class="detail-item">
            <span>العميل</span>
            <strong>${client.name} (${client.code})</strong>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

async function loadAdminData() {
  try {
    const [clients, apartments, payments, auditLogs] = await Promise.all([
      apiFetch('/api/admin/clients'),
      apiFetch('/api/admin/apartments'),
      apiFetch('/api/admin/payments'),
      apiFetch('/api/admin/audit-logs')
    ]);

    reservationState.clients = clients || [];
    reservationState.apartments = apartments || [];
    reservationState.payments = payments || [];
    reservationState.auditLogs = auditLogs || [];

    renderAdminDashboard();
  } catch (error) {
    console.error('Failed to load admin data:', error);
    showToast('فشل تحميل بيانات الإدارة', 'error');
  }
}

function syncReservationData() {
  // This would sync with backend data
}

function renderAdminAlerts() {
  // Implementation for admin alerts
}

// Initialize admin dashboard
document.addEventListener("DOMContentLoaded", () => {
  // Admin login handler
  const adminCodeForm = document.getElementById("adminCodeForm");
  if (adminCodeForm) {
    adminCodeForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const emailInput = document.getElementById("adminEmail");
      const codeInput = document.getElementById("adminCode");
      const error = document.getElementById("adminCodeMessage");
      const button = document.getElementById("adminCodeButton");

      error.classList.remove("show");
      if (!emailInput.value.trim() || !codeInput.value.trim()) {
        error.textContent = "يرجى إدخال البريد الإلكتروني وكلمة المرور.";
        error.classList.add("show");
        (!emailInput.value.trim() ? emailInput : codeInput).focus();
        return;
      }

      button.textContent = "جاري تسجيل الدخول...";
      button.disabled = true;

      try {
        await adminLogin(emailInput.value.trim(), codeInput.value);
        reservationState.adminUnlocked = true;
        document.getElementById("adminGate").style.display = "none";
        document.getElementById("adminDashboard").classList.add("show");
        await loadAdminData();
      } catch (apiError) {
        error.textContent = apiError.message || "تعذر تسجيل الدخول. يرجى مراجعة البيانات.";
        error.classList.add("show");
      } finally {
        button.textContent = "تسجيل الدخول";
        button.disabled = false;
      }
    });
  }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderAdminDashboard,
    loadAdminData,
    reservationState
  };
}
