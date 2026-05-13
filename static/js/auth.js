function initAuth() {
  qs("#openStaffLogin").addEventListener("click", () => {
    qs("#staffLoginModal").hidden = false;
    qs("#staffEmail").focus();
  });
  qs("#closeStaffLogin").addEventListener("click", () => qs("#staffLoginModal").hidden = true);
  qs("#staffLoginForm").addEventListener("submit", handleStaffLogin);
  qs("#logoutButton").addEventListener("click", logoutStaff);
  qs("#refreshDashboard").addEventListener("click", loadDashboard);
}

async function handleStaffLogin(event) {
  event.preventDefault();
  const button = qs("#staffLoginButton");
  const message = qs("#staffLoginMessage");
  message.textContent = "";
  setButtonLoading(button, true, "جاري تسجيل الدخول...");
  try {
    const result = await AuthAPI.login(qs("#staffEmail").value.trim(), qs("#staffPassword").value);
    APP_STATE.session = result.admin;
    qs("#staffLoginModal").hidden = true;
    qs("#staffLoginForm").reset();
    await loadDashboard();
    showStaffApp();
  } catch (error) {
    message.textContent = error.message || "يرجى مراجعة بيانات الدخول.";
  } finally {
    setButtonLoading(button, false);
  }
}

async function restoreSession() {
  try {
    const result = await AuthAPI.me();
    APP_STATE.session = result.admin;
    await loadDashboard();
    showStaffApp();
  } catch {
    APP_STATE.session = null;
  }
}

function showStaffApp() {
  document.body.classList.add("dashboard-open");
  qs("#staffApp").hidden = false;
  renderDashboardShell();
}

async function logoutStaff() {
  await AuthAPI.logout().catch(() => null);
  APP_STATE.session = null;
  APP_STATE.dashboard = null;
  APP_STATE.owner = null;
  document.body.classList.remove("dashboard-open");
  qs("#staffApp").hidden = true;
}

async function loadDashboard() {
  APP_STATE.dashboard = await AdminAPI.bootstrap();
  APP_STATE.session = APP_STATE.dashboard.admin;
  if (APP_STATE.session?.role === "owner") {
    await loadOwnerData();
  }
  renderDashboardShell();
  renderActiveDashboardView();
}

async function loadOwnerData() {
  const [summary, alerts, performance, deals, clients, apartments, payments, audit, settings] = await Promise.all([
    OwnerAPI.dashboardSummary(),
    OwnerAPI.alerts(),
    OwnerAPI.assistantPerformance(),
    OwnerAPI.deals(),
    OwnerAPI.clients(),
    OwnerAPI.apartments(),
    OwnerAPI.payments(),
    OwnerAPI.auditLogs(),
    OwnerAPI.settings(),
  ]);

  APP_STATE.owner = {
    summary: summary.summary || {},
    alerts: alerts.alerts || [],
    assistantPerformance: performance.assistants || [],
    deals: deals.deals || [],
    clients: clients.clients || [],
    apartments: apartments.apartments || [],
    payments: payments.payments || [],
    auditLogs: audit.auditLogs || [],
    settings: settings.settings || {},
  };

  APP_STATE.dashboard.summary = { ...(APP_STATE.dashboard.summary || {}), ...APP_STATE.owner.summary };
  APP_STATE.dashboard.deals = APP_STATE.owner.deals;
  APP_STATE.dashboard.clients = APP_STATE.owner.clients;
  APP_STATE.dashboard.apartments = APP_STATE.owner.apartments;
  APP_STATE.dashboard.payments = APP_STATE.owner.payments;
  APP_STATE.dashboard.auditLogs = APP_STATE.owner.auditLogs;
  APP_STATE.dashboard.settings = {
    ...(APP_STATE.dashboard.settings || {}),
    ...(APP_STATE.owner.settings?.office || {}),
  };
}

function renderDashboardShell() {
  const user = APP_STATE.session;
  if (!user) return;
  qs("#dashboardRoleLabel").textContent = ROLE_LABELS[user.role] || "لوحة التحكم";
  qs("#dashboardTitle").textContent = user.role === "assistant"
    ? "إدارة الديلات الخاصة بي"
    : user.role === "owner"
      ? "منصة تحكم المالك"
      : "إدارة الحجوزات";
  qs("#currentUserCard").innerHTML = `<strong>${escapeHTML(user.fullName)}</strong><br><span>${escapeHTML(user.email)}</span>`;
  renderDashboardNav(user.role);
}
