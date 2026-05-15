function initAuth() {
  qs("#openStaffLogin").addEventListener("click", () => {
    qs("#staffLoginModal").hidden = false;
    qs("#staffEmail").focus();
  });
  qs("#closeStaffLogin").addEventListener("click", () => qs("#staffLoginModal").hidden = true);
  qs("#staffLoginForm").addEventListener("submit", handleStaffLogin);
  qs("#logoutButton").addEventListener("click", logoutStaff);
  qs("#refreshDashboard").addEventListener("click", () => refreshCurrentDashboardView());
  document.addEventListener("click", closeClientMoreDropdownsOnOutsideClick);
}

function closeClientMoreDropdownsOnOutsideClick(event) {
  if (event.target.closest(".client-more-dropdown")) return;
  if (event.target.closest("[data-client-more], [data-owner-client-more]")) return;
  qsa(".client-more-dropdown").forEach((dropdown) => dropdown.remove());
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
    initDashboardSession(result.admin);
    showStaffApp();
    if (result.must_change_password || result.admin?.mustChangePassword) {
      openMustChangePasswordDialog();
      return;
    }
    renderActiveDashboardView();
    scheduleAfterFirstPaint(() => loadDashboard().catch((error) => showToast(error.message, "error")));
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
    initDashboardSession(result.admin);
    if (result.admin?.mustChangePassword) {
      showStaffApp();
      openMustChangePasswordDialog();
      return;
    }
    showStaffApp();
    renderActiveDashboardView();
    await loadDashboard();
  } catch {
    APP_STATE.session = null;
  }
}

function showStaffApp() {
  document.body.classList.add("dashboard-open");
  qs("#staffApp").hidden = false;
  if (window.location.hash !== "#dashboard") {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}#dashboard`);
  }
  renderDashboardShell();
}

function openMustChangePasswordDialog() {
  openModal(`
    <span class="eyebrow">بيانات الدخول</span>
    <h2>تغيير كلمة المرور مطلوب</h2>
    <form id="mustChangePasswordForm" class="form-grid" autocomplete="off">
      <div class="form-field full"><label for="forcedCurrentPassword">كلمة المرور المؤقتة</label><input id="forcedCurrentPassword" type="password" required /></div>
      <div class="form-field"><label for="forcedNewPassword">كلمة المرور الجديدة</label><input id="forcedNewPassword" type="password" minlength="8" required /></div>
      <div class="form-field"><label for="forcedConfirmPassword">تأكيد كلمة المرور</label><input id="forcedConfirmPassword" type="password" minlength="8" required /></div>
      <button class="btn primary full" type="submit">تغيير كلمة المرور</button>
    </form>
  `);
  qs("#mustChangePasswordForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    try {
      await AdminAPI.changePassword({
        current_password: qs("#forcedCurrentPassword").value,
        new_password: qs("#forcedNewPassword").value,
        confirm_password: qs("#forcedConfirmPassword").value,
      });
      closeModal();
      showToast("تم تغيير كلمة المرور بنجاح.", "success");
      await loadDashboard();
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

async function logoutStaff() {
  await AuthAPI.logout().catch(() => null);
  APP_STATE.session = null;
  APP_STATE.dashboard = null;
  APP_STATE.cache = {};
  APP_STATE.owner = null;
  document.body.classList.remove("dashboard-open");
  qs("#staffApp").hidden = true;
  if (window.location.hash === "#dashboard") {
    history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
  }
}

async function loadDashboard(options = {}) {
  const keys = activeDashboardDataKeys();
  const force = Boolean(options.force);
  if (force) invalidateDashboardCache(["summary", ...keys]);
  renderDashboardShell();
  await loadDashboardSummary(force);
  if (keys.length) {
    if (keys.every((key) => isDashboardLoaded(key))) {
      renderActiveDashboardView();
      return;
    }
    qs("#dashboardContent").innerHTML = LoadingState("جاري تحميل هذا التبويب...");
    await ensureDashboardData(keys, APP_STATE.activeDashboardView);
    return;
  }
  renderActiveDashboardView();
}

function initDashboardSession(admin, seed = {}) {
  APP_STATE.cache = {};
  APP_STATE.dashboardLoaded = {};
  APP_STATE.dashboardLoading = {};
  APP_STATE.owner = null;
  APP_STATE.session = admin;
  APP_STATE.dashboard = {
    admin,
    summary: seed.summary || {},
    settings: seed.settings || {},
    rolePermissions: seed.rolePermissions || {},
    apartments: [],
    clients: [],
    payments: [],
    installments: [],
    deals: [],
    auditLogs: [],
    users: [],
    updates: [],
  };
  if (seed.summary) cacheDashboardData("summary", seed.summary);
  if (seed.settings) cacheDashboardData("settings", seed.settings);
}

async function loadDashboardSummary(force = false) {
  if (!APP_STATE.dashboard && APP_STATE.session) {
    initDashboardSession(APP_STATE.session);
  }
  if (!force && isDashboardLoaded("summary")) return;
  const result = await AdminAPI.dashboardSummary();
  cacheDashboardData("summary", result.summary || {});
}

function markDashboardLoaded(key, value = true) {
  APP_STATE.dashboardLoaded[key] = value;
  APP_STATE.dashboardLoading[key] = false;
}

function isDashboardLoaded(key) {
  return Boolean(APP_STATE.dashboardLoaded?.[key]);
}

function cacheDashboardData(key, value, meta = null) {
  APP_STATE.cache[key] = value;
  if (meta) APP_STATE.cache[`${key}Meta`] = meta;
  if (!APP_STATE.dashboard) return markDashboardLoaded(key);
  if (key === "summary") APP_STATE.dashboard.summary = value || {};
  else if (key === "settings") APP_STATE.dashboard.settings = value || {};
  else if (key === "apartments") APP_STATE.dashboard.apartments = value || [];
  else if (key === "clients") {
    APP_STATE.dashboard.clients = value || [];
    APP_STATE.dashboard.clientsPagination = meta;
  } else if (key === "payments") {
    APP_STATE.dashboard.payments = value || [];
    APP_STATE.dashboard.paymentsPagination = meta;
  } else if (key === "installments") {
    APP_STATE.dashboard.installments = value || [];
    APP_STATE.dashboard.installmentsPagination = meta;
  } else if (key === "deals") {
    APP_STATE.dashboard.deals = value || [];
    APP_STATE.dashboard.dealsPagination = meta;
  } else if (key === "auditLogs") {
    APP_STATE.dashboard.auditLogs = value || [];
    APP_STATE.dashboard.auditPagination = meta;
  } else if (key === "users") APP_STATE.dashboard.users = value || [];
  else if (key === "updates") {
    APP_STATE.dashboard.updates = value || [];
    APP_STATE.dashboard.updatesPagination = meta;
  }
  markDashboardLoaded(key);
}

function cacheListMeta(result) {
  return {
    page: result.page || 1,
    limit: result.limit || 20,
    total: result.total ?? result.items?.length ?? 0,
    hasMore: Boolean(result.hasMore),
  };
}

function invalidateDashboardCache(keys) {
  keys.forEach((key) => {
    delete APP_STATE.cache[key];
    delete APP_STATE.cache[`${key}Meta`];
    delete APP_STATE.dashboardLoaded[key];
    delete APP_STATE.dashboardLoading[key];
  });
}

function activeDashboardDataKeys() {
  const role = APP_STATE.session?.role;
  const view = APP_STATE.activeDashboardView;
  if (role === "assistant") {
    if (view === "newDeal" || view === "apartments") return ["apartments"];
    return ["deals", "apartments"];
  }
  if (role === "owner") {
    if (view === "newDeal") return ["ownerApartments"];
    if (view === "deals" || view === "approvals") return ["ownerDeals"];
    if (view === "operations") {
      const tab = APP_STATE.ownerOperationsTab || "clients";
      if (tab === "units") return ["ownerApartments"];
      if (tab === "payments") return ["ownerPayments"];
      return ["ownerClients"];
    }
    if (view === "settings") {
      const tab = APP_STATE.ownerSettingsTab || "office";
      return tab === "accounts" || tab === "permissions" ? ["ownerSettings", "users"] : ["ownerSettings"];
    }
    if (view === "audit") return ["ownerAudit"];
    if (view === "updates") return ["updates"];
    return ["ownerSummary"];
  }
  if (view === "newDeal") return ["apartments"];
  if (view === "deals") return ["deals"];
  if (view === "settings") return ["settings"];
  if (view === "payments") return ["payments", "clients", "apartments"];
  if (view === "installments") return ["installments", "clients"];
  if (view === "updates") return ["updates"];
  if (view === "operations") return ["clients", "apartments"];
  return [];
}

async function refreshCurrentDashboardView() {
  const keys = activeDashboardDataKeys();
  invalidateDashboardCache(["summary", ...keys]);
  await loadDashboardSummary(true);
  if (keys.length) {
    qs("#dashboardContent").innerHTML = LoadingState("جاري تحديث هذا التبويب...");
    await ensureDashboardData(keys, APP_STATE.activeDashboardView);
    return;
  }
  renderActiveDashboardView();
}

async function refreshDashboardKeys(keys = [], options = {}) {
  const uniqueKeys = [...new Set(keys.filter(Boolean))];
  const viewName = options.viewName || APP_STATE.activeDashboardView;
  const section = options.loadingSelector ? qs(options.loadingSelector) : null;
  if (section && options.loadingText) {
    section.innerHTML = LoadingState(options.loadingText);
  }
  invalidateDashboardCache(uniqueKeys);
  if (options.summary) {
    if (APP_STATE.session?.role === "owner") {
      invalidateDashboardCache(["ownerSummary"]);
      await loadDashboardDataset("ownerSummary");
    } else {
      await loadDashboardSummary(true);
    }
  }
  for (const key of uniqueKeys) {
    await loadDashboardDataset(key);
  }
  if (options.render !== false && APP_STATE.activeDashboardView === viewName) {
    renderActiveDashboardView();
  }
}

async function refreshSummaryOnly(options = {}) {
  await loadDashboardSummary(true);
  if (options.render && APP_STATE.activeDashboardView === (options.viewName || APP_STATE.activeDashboardView)) {
    renderActiveDashboardView();
  }
}

async function refreshClientsAfterChange(options = {}) {
  const role = APP_STATE.session?.role;
  if (role === "owner") {
    await refreshDashboardKeys(["ownerClients", "ownerApartments"], { summary: true, ...options });
    return;
  }
  await refreshDashboardKeys(["clients", "apartments"], { summary: true, ...options });
}

async function refreshClientsAfterPriceChange(options = {}) {
  const role = APP_STATE.session?.role;
  if (role === "owner") {
    await refreshDashboardKeys(["ownerClients"], { summary: true, ...options });
    return;
  }
  await refreshDashboardKeys(["clients"], { summary: true, ...options });
}

async function refreshPaymentsAfterChange(options = {}) {
  const role = APP_STATE.session?.role;
  if (role === "owner") {
    await refreshDashboardKeys(["ownerPayments", "ownerClients"], { summary: true, ...options });
    return;
  }
  await refreshDashboardKeys(["payments", "clients"], { summary: true, ...options });
}

async function refreshInstallmentsAfterChange(options = {}) {
  await refreshDashboardKeys(["installments", "clients"], { summary: true, ...options });
}

async function refreshUpdatesAfterChange(options = {}) {
  await refreshDashboardKeys(["updates"], options);
}

async function refreshDealsAfterChange(options = {}) {
  if (APP_STATE.session?.role === "owner") {
    await refreshDashboardKeys(["ownerDeals", "ownerApartments", "ownerClients"], { summary: true, ...options });
    return;
  }
  await refreshDashboardKeys(["deals", "apartments"], { summary: true, ...options });
}

async function ensureDashboardData(keys, viewName = APP_STATE.activeDashboardView) {
  const missing = keys.filter((key) => !isDashboardLoaded(key));
  if (!missing.length) return true;
  const loadingKey = missing.join(":");
  if (APP_STATE.dashboardLoading[loadingKey]) return false;
  APP_STATE.dashboardLoading[loadingKey] = true;
  let loadError = null;
  try {
    for (const key of missing) {
      await loadDashboardDataset(key);
    }
  } catch (error) {
    loadError = error;
    showToast(error.message || "تعذر تحميل البيانات.", "error");
  } finally {
    APP_STATE.dashboardLoading[loadingKey] = false;
  }
  if (APP_STATE.activeDashboardView === viewName) {
    if (loadError) {
      qs("#dashboardContent").innerHTML = ErrorState(loadError.message || "تعذر تحميل بيانات هذا التبويب.");
      return false;
    }
    renderActiveDashboardView();
  }
  return false;
}

async function loadDashboardDataset(key) {
  if (!APP_STATE.dashboard) return;
  if (key === "summary") {
    await loadDashboardSummary(true);
    return;
  }
  if (key === "apartments") {
    const result = await AdminAPI.apartments();
    cacheDashboardData(key, result.apartments || []);
    return;
  }
  if (key === "clients") {
    const result = await AdminAPI.clients();
    cacheDashboardData(key, result.items || [], cacheListMeta(result));
    return;
  }
  if (key === "payments") {
    const result = await AdminAPI.payments();
    cacheDashboardData(key, result.items || [], cacheListMeta(result));
    return;
  }
  if (key === "installments") {
    const result = await AdminAPI.installments();
    cacheDashboardData(key, result.items || [], cacheListMeta(result));
    return;
  }
  if (key === "deals") {
    const result = await DealAPI.list();
    cacheDashboardData(key, result.items || [], cacheListMeta(result));
    return;
  }
  if (key === "auditLogs") {
    const result = await AdminAPI.auditLogs();
    cacheDashboardData(key, result.items || [], cacheListMeta(result));
    return;
  }
  if (key === "settings") {
    const result = await AdminAPI.settings();
    cacheDashboardData(key, result.settings || {});
    return;
  }
  if (key === "users") {
    const result = await AdminAPI.users();
    cacheDashboardData(key, result.users || []);
    return;
  }
  if (key === "updates") {
    const result = await UpdatesAPI.list();
    cacheDashboardData(key, result.items || [], cacheListMeta(result));
    return;
  }
  if (key === "ownerSummary") {
    const result = await OwnerAPI.dashboardSummary();
    APP_STATE.owner = { ...(APP_STATE.owner || {}), summary: result.summary || {} };
    APP_STATE.dashboard.summary = { ...(APP_STATE.dashboard.summary || {}), ...(result.summary || {}) };
    markDashboardLoaded(key);
    return;
  }
  if (key === "ownerAlerts") {
    const result = await OwnerAPI.alerts();
    APP_STATE.owner = { ...(APP_STATE.owner || {}), alerts: result.alerts || [] };
    markDashboardLoaded(key);
    return;
  }
  if (key === "ownerPerformance") {
    const result = await OwnerAPI.assistantPerformance();
    APP_STATE.owner = { ...(APP_STATE.owner || {}), assistantPerformance: result.assistants || [] };
    markDashboardLoaded(key);
    return;
  }
  if (key === "ownerDeals") {
    const result = await OwnerAPI.deals();
    APP_STATE.owner = { ...(APP_STATE.owner || {}), deals: result.deals || [] };
    APP_STATE.dashboard.deals = result.deals || [];
    markDashboardLoaded(key);
    return;
  }
  if (key === "ownerClients") {
    const result = await OwnerAPI.clients();
    APP_STATE.owner = { ...(APP_STATE.owner || {}), clients: result.clients || [] };
    APP_STATE.dashboard.clients = result.clients || [];
    markDashboardLoaded(key);
    return;
  }
  if (key === "ownerApartments") {
    const result = await OwnerAPI.apartments();
    APP_STATE.owner = { ...(APP_STATE.owner || {}), apartments: result.apartments || [] };
    APP_STATE.dashboard.apartments = result.apartments || [];
    markDashboardLoaded(key);
    return;
  }
  if (key === "ownerPayments") {
    const result = await OwnerAPI.payments();
    APP_STATE.owner = { ...(APP_STATE.owner || {}), payments: result.payments || [] };
    APP_STATE.dashboard.payments = result.payments || [];
    markDashboardLoaded(key);
    return;
  }
  if (key === "ownerAudit") {
    const result = await OwnerAPI.auditLogs();
    APP_STATE.owner = { ...(APP_STATE.owner || {}), auditLogs: result.auditLogs || [] };
    APP_STATE.dashboard.auditLogs = result.auditLogs || [];
    markDashboardLoaded(key);
    return;
  }
  if (key === "ownerSettings") {
    const result = await OwnerAPI.settings();
    APP_STATE.owner = { ...(APP_STATE.owner || {}), settings: result.settings || {} };
    APP_STATE.dashboard.settings = {
      ...(APP_STATE.dashboard.settings || {}),
      ...(result.settings?.office || {}),
    };
    markDashboardLoaded(key);
  }
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
