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

  if (role === "assistant") {
    if (view === "newDeal") {
      content.innerHTML = renderAssistantDealWizard();
      bindAssistantDealWizard();
      return;
    }
    if (view === "apartments") {
      content.innerHTML = `<section class="data-panel"><h3>الشقق المتاحة</h3>${renderApartmentsTable((APP_STATE.dashboard.apartments || []).filter((apt) => apt.status === "Available"), false)}</section>`;
      bindDashboardActions();
      return;
    }
    content.innerHTML = renderAssistantDashboard();
    bindAssistantDashboard();
    bindDashboardActions();
    return;
  }

  if (role === "owner") {
    if (view === "newDeal") {
      content.innerHTML = renderAssistantDealWizard();
      bindAssistantDealWizard();
      return;
    }
    if (view === "deals") {
      content.innerHTML = `<section class="data-panel"><div class="dashboard-topbar"><div><span class="eyebrow">الديلات</span><h3>إدارة الديلات</h3></div></div>${renderDealsList(APP_STATE.dashboard.deals || [], "owner")}</section>`;
      bindDashboardActions();
      return;
    }
    if (view === "approvals") {
      content.innerHTML = renderOwnerApprovalCenter();
      bindOwnerApprovalCenter();
      return;
    }
    if (view === "operations") {
      content.innerHTML = renderOwnerOperations();
      bindOwnerOperations();
      return;
    }
    if (view === "settings") {
      content.innerHTML = renderOwnerSettings();
      bindOwnerSettings();
      return;
    }
    if (view === "updates") {
      content.innerHTML = renderUpdatesAdminPanel();
      bindUpdatesAdminPanel();
      return;
    }
    if (view === "audit") {
      content.innerHTML = renderOwnerAuditLog();
      bindOwnerAuditLog();
      return;
    }
    content.innerHTML = renderOwnerDashboard();
    bindOwnerDashboard();
    return;
  }

  if (view === "newDeal") {
    content.innerHTML = renderAssistantDealWizard();
    bindAssistantDealWizard();
    return;
  }

  if (view === "deals") {
    content.innerHTML = `<section class="data-panel"><div class="dashboard-topbar"><div><span class="eyebrow">الديلات</span><h3>إدارة الديلات</h3></div></div>${renderDealsList(APP_STATE.dashboard.deals || [], "admin")}</section>`;
    bindDashboardActions();
    return;
  }

  if (view === "settings") {
    content.innerHTML = renderSettingsPanel();
    bindSettingsForm();
    return;
  }

  if (view === "payments") {
    content.innerHTML = renderAdminPaymentsPanel();
    bindPaymentsPanel();
    return;
  }

  if (view === "installments") {
    content.innerHTML = renderAdminInstallmentsPanel();
    bindInstallmentsPanel();
    return;
  }

  if (view === "updates") {
    content.innerHTML = renderUpdatesAdminPanel();
    bindUpdatesAdminPanel();
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
