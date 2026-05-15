function renderDashboardNav(role) {
  const navItems = role === "assistant"
    ? [
        ["overview", "لوحة المساعد"],
        ["newDeal", "إنشاء ديل جديد"],
        ["deals", "ديلاتي"],
        ["apartments", "الشقق المتاحة"],
      ]
    : role === "owner"
      ? [
          ["overview", "الرئيسية"],
          ["approvals", "الموافقات"],
          ["operations", "التشغيل"],
          ["updates", "المنشورات"],
          ["settings", "الإعدادات"],
          ["audit", "النشاط"],
        ]
      : [
          ["overview", "لوحة الإدارة"],
          ["operations", "العملاء والشقق"],
          ["payments", "المدفوعات"],
          ["installments", "الأقساط"],
          ["updates", "المنشورات"],
          ["settings", "بيانات الدخول"],
        ];

  if (role === "admin" || role === "owner") {
    navItems.splice(2, 0, ["newDeal", "إنشاء ديل"], ["deals", "الديلات"]);
  }

  qs("#dashboardNav").innerHTML = navItems.map(([key, label]) => `
    <button type="button" data-dashboard-view="${key}" class="${APP_STATE.activeDashboardView === key ? "active" : ""}">${label}</button>
  `).join("");

  qsa("[data-dashboard-view]").forEach((button) => {
    button.addEventListener("click", () => {
      APP_STATE.activeDashboardView = button.dataset.dashboardView;
      renderDashboardShell();
      renderActiveDashboardView();
    });
  });
}

function renderActiveDashboardView() {
  const role = APP_STATE.session?.role;
  const view = APP_STATE.activeDashboardView;
  const content = qs("#dashboardContent");
  if (!APP_STATE.dashboard) {
    content.innerHTML = LoadingState();
    return;
  }

  const needsData = (keys) => {
    const missing = keys.filter((key) => !isDashboardLoaded(key));
    if (!missing.length) return false;
    content.innerHTML = LoadingState();
    ensureDashboardData(missing, view);
    return true;
  };

  if (role === "assistant") {
    if (view === "newDeal") {
      if (needsData(["apartments"])) return;
      content.innerHTML = renderAssistantDealWizard();
      bindAssistantDealWizard();
      return;
    }
    if (view === "apartments") {
      if (needsData(["apartments"])) return;
      content.innerHTML = `<section class="data-panel"><h3>الشقق المتاحة</h3>${renderApartmentsTable((APP_STATE.dashboard.apartments || []).filter((apt) => apt.status === "Available"), false)}</section>`;
      bindDashboardActions();
      return;
    }
    if (needsData(["deals", "apartments"])) return;
    content.innerHTML = renderAssistantDashboard();
    bindAssistantDashboard();
    bindDashboardActions();
    return;
  }

  if (role === "owner") {
    if (view === "newDeal") {
      if (needsData(["ownerApartments"])) return;
      content.innerHTML = renderAssistantDealWizard();
      bindAssistantDealWizard();
      return;
    }
    if (view === "deals") {
      if (needsData(["ownerDeals"])) return;
      content.innerHTML = `<section class="data-panel"><div class="dashboard-topbar"><div><span class="eyebrow">الديلات</span><h3>إدارة الديلات</h3></div></div>${renderDealsList(APP_STATE.dashboard.deals || [], "owner")}</section>`;
      bindDashboardActions();
      return;
    }
    if (view === "approvals") {
      if (needsData(["ownerDeals"])) return;
      content.innerHTML = renderOwnerApprovalCenter();
      bindOwnerApprovalCenter();
      return;
    }
    if (view === "operations") {
      const tab = APP_STATE.ownerOperationsTab || "clients";
      if (tab === "clients" && needsData(["ownerClients"])) return;
      if (tab === "units" && needsData(["ownerApartments"])) return;
      if (tab === "payments" && needsData(["ownerPayments"])) return;
      content.innerHTML = renderOwnerOperations();
      bindOwnerOperations();
      return;
    }
    if (view === "settings") {
      const tab = APP_STATE.ownerSettingsTab || "office";
      const keys = ["ownerSettings"];
      if (tab === "accounts" || tab === "permissions") keys.push("users");
      if (needsData(keys)) return;
      content.innerHTML = renderOwnerSettings();
      bindOwnerSettings();
      return;
    }
    if (view === "updates") {
      if (needsData(["updates"])) return;
      content.innerHTML = renderUpdatesAdminPanel();
      bindUpdatesAdminPanel();
      return;
    }
    if (view === "audit") {
      if (needsData(["ownerAudit"])) return;
      content.innerHTML = renderOwnerAuditLog();
      bindOwnerAuditLog();
      return;
    }
    if (needsData(["ownerSummary"])) return;
    ensureDashboardData(["ownerAlerts", "ownerPerformance"], view);
    content.innerHTML = renderOwnerDashboard();
    bindOwnerDashboard();
    return;
  }

  if (view === "newDeal") {
    if (needsData(["apartments"])) return;
    content.innerHTML = renderAssistantDealWizard();
    bindAssistantDealWizard();
    return;
  }

  if (view === "deals") {
    if (needsData(["deals"])) return;
    content.innerHTML = `<section class="data-panel"><div class="dashboard-topbar"><div><span class="eyebrow">الديلات</span><h3>إدارة الديلات</h3></div></div>${renderDealsList(APP_STATE.dashboard.deals || [], "admin")}</section>`;
    bindDashboardActions();
    return;
  }

  if (view === "settings") {
    if (needsData(["settings"])) return;
    content.innerHTML = renderSettingsPanel();
    bindSettingsForm();
    return;
  }

  if (view === "payments") {
    if (needsData(["payments", "clients", "apartments"])) return;
    content.innerHTML = renderAdminPaymentsPanel();
    bindPaymentsPanel();
    return;
  }

  if (view === "installments") {
    if (needsData(["installments", "clients"])) return;
    content.innerHTML = renderAdminInstallmentsPanel();
    bindInstallmentsPanel();
    return;
  }

  if (view === "updates") {
    if (needsData(["updates"])) return;
    content.innerHTML = renderUpdatesAdminPanel();
    bindUpdatesAdminPanel();
    return;
  }

  if (view === "operations") {
    if (needsData(["clients", "apartments"])) return;
    content.innerHTML = renderAdminDashboard();
    bindAdminDashboard();
    bindDashboardActions();
    return;
  }

  content.innerHTML = renderAdminDashboard();
  bindAdminDashboard();
  bindDashboardActions();
}

function bindDashboardActions() {
  qs("#dashboardContent").onclick = async (event) => {
    const target = event.target.closest("button");
    if (!target) return;
    try {
      if (await handleDealAction(target)) return;
      if (target.dataset.download) downloadFile(target.dataset.download);
    } catch (error) {
      showToast(error.message, "error");
    }
  };
}
