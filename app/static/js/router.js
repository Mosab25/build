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
          ["partnerships", "الشراكات"],
          ["settings", "الإعدادات"],
          ["audit", "النشاط"],
        ]
      : [
          ["overview", "لوحة الإدارة"],
          ["operations", "العملاء والشقق"],
          ["payments", "المدفوعات"],
          ["installments", "الأقساط"],
          ["updates", "المنشورات"],
          ["partnerships", "الشراكات"],
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
    content.innerHTML = LoadingState("جاري تحميل هذا التبويب...");
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
    if (needsData(["deals"])) return;
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
    if (needsData(["payments"])) return;
    content.innerHTML = renderAdminPaymentsPanel();
    bindPaymentsPanel();
    return;
  }

  if (view === "installments") {
    if (needsData(["installments"])) return;
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
    if (needsData(["clients"])) return;
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

// Navigation simplification layer (UI-only, keeps backend/business logic intact)
const __legacyRenderDashboardNav = renderDashboardNav;
const __legacyRenderActiveDashboardView = renderActiveDashboardView;

function dashboardMainNav(role, isMobile) {
  if (role === "assistant") {
    return [
      ["overview", "الرئيسية"],
      ["newDeal", "إنشاء ديل جديد"],
      ["deals", "ديلاتي"],
      ["apartments", "الشقق المتاحة"],
    ];
  }
  if (isMobile) {
    const items = [
      ["overview", "الرئيسية"],
      ["operations", "التشغيل"],
      ["deals", "الديلات"],
      ["updates", "المنشورات"],
      ["partnerships", "الشراكات"],
      ["settings", "الإعدادات"],
      ["audit", "سجل النشاط"],
    ];
    if (role === "owner" || role === "admin") items.splice(3, 0, ["projects", "المشاريع"]);
    return items;
  }
  const items = [
    ["overview", "الرئيسية"],
    ["operations", "التشغيل"],
    ["deals", "الديلات"],
    ["updates", "المنشورات"],
    ["partnerships", "الشراكات"],
    ["settings", "الإعدادات"],
    ["audit", "سجل النشاط"],
  ];
  if (role === "owner" || role === "admin") items.splice(3, 0, ["projects", "المشاريع"]);
  return items;
}

renderDashboardNav = function renderDashboardNavSimplified(role) {
  const isMobile = window.matchMedia("(max-width: 900px)").matches;
  const navItems = dashboardMainNav(role, isMobile);
  if (!navItems.some(([key]) => key === APP_STATE.activeDashboardView)) {
    if (["approvals", "newDeal"].includes(APP_STATE.activeDashboardView)) APP_STATE.activeDashboardView = "deals";
    else if (APP_STATE.activeDashboardView === "audit") APP_STATE.activeDashboardView = "settings";
    else APP_STATE.activeDashboardView = "overview";
  }
  qs("#dashboardNav").innerHTML = navItems.map(([key, label]) => `
    <button type="button" data-dashboard-view="${key}" class="${APP_STATE.activeDashboardView === key ? "active" : ""}">${label}</button>
  `).join("");
  qsa("[data-dashboard-view]").forEach((button) => {
    button.addEventListener("click", () => {
      APP_STATE.activeDashboardView = button.dataset.dashboardView;
      renderDashboardShell();
      renderActiveDashboardView();
      closeDashboardSidebarDrawer?.();
    });
  });
};

function renderDealsOwnerUnified() {
  const allDeals = APP_STATE.dashboard?.deals || APP_STATE.owner?.deals || [];
  const selected = APP_STATE.ownerDealsStatusFilter || "all";
  const statusMap = {
    all: () => true,
    pending_approval: (deal) => deal.status === "pending_approval",
    approved: (deal) => deal.status === "approved",
    rejected: (deal) => deal.status === "rejected",
  };
  const filtered = allDeals.filter((deal) => (statusMap[selected] || statusMap.all)(deal));
  return `
    <section class="data-panel">
      <div class="dashboard-topbar">
        <div><span class="eyebrow">الديلات</span><h3>إدارة الديلات</h3></div>
        <button class="btn primary" type="button" id="openOwnerDealWizard">+ إنشاء ديل جديد</button>
      </div>
      <div class="segmented-control owner-approval-tabs">
        <button type="button" data-owner-deal-status="all" class="${selected === "all" ? "active" : ""}">الكل</button>
        <button type="button" data-owner-deal-status="pending_approval" class="${selected === "pending_approval" ? "active" : ""}">بانتظار الموافقة</button>
        <button type="button" data-owner-deal-status="approved" class="${selected === "approved" ? "active" : ""}">مقبول</button>
        <button type="button" data-owner-deal-status="rejected" class="${selected === "rejected" ? "active" : ""}">مرفوض</button>
      </div>
      ${renderDealsList(filtered, "owner")}
    </section>
  `;
}

function bindDealsOwnerUnified() {
  qs("#openOwnerDealWizard")?.addEventListener("click", () => {
    APP_STATE.activeDashboardView = "newDeal";
    renderActiveDashboardView();
  });
  qsa("[data-owner-deal-status]").forEach((button) => {
    button.addEventListener("click", () => {
      APP_STATE.ownerDealsStatusFilter = button.dataset.ownerDealStatus;
      renderActiveDashboardView();
    });
  });
  bindDashboardActions();
}

function renderDashboardMoreMenu(role) {
  return `
    <section class="data-panel more-menu-panel">
      <h3>المزيد</h3>
      <div class="panel-actions more-menu-actions">
        <button class="btn secondary full" type="button" data-more-view="updates">المنشورات</button>
        <button class="btn secondary full" type="button" data-more-view="partnerships">الشراكات</button>
        <button class="btn secondary full" type="button" data-more-view="settings">الإعدادات</button>
        <button class="btn secondary full" type="button" data-more-view="audit">${role === "owner" ? "سجل النشاط" : "سجل النشاط"}</button>
        <button class="btn ghost full" type="button" id="moreMenuLogout">تسجيل الخروج</button>
      </div>
    </section>
  `;
}

renderActiveDashboardView = function renderActiveDashboardViewSimplified() {
  const role = APP_STATE.session?.role;
  const view = APP_STATE.activeDashboardView;
  const content = qs("#dashboardContent");
  if ((role === "owner" || role === "admin") && view === "more") {
    content.innerHTML = renderDashboardMoreMenu(role);
    qsa("[data-more-view]").forEach((button) => {
      button.addEventListener("click", () => {
        APP_STATE.activeDashboardView = button.dataset.moreView;
        renderDashboardShell();
        renderActiveDashboardView();
      });
    });
    qs("#moreMenuLogout")?.addEventListener("click", () => qs("#logoutButton")?.click());
    return;
  }

  if (role === "owner" && view === "deals") {
    if (!APP_STATE.dashboard?.deals?.length && !isDashboardLoaded("ownerDeals")) {
      content.innerHTML = LoadingState("جاري تحميل الديلات...");
      ensureDashboardData(["ownerDeals"], view);
      return;
    }
    content.innerHTML = renderDealsOwnerUnified();
    bindDealsOwnerUnified();
    return;
  }

  if ((role === "owner" || role === "admin") && view === "partnerships") {
    content.innerHTML = renderPartnershipsAdminPanel();
    bindPartnershipsAdminPanel();
    return;
  }

  if ((role === "owner" || role === "admin") && view === "projects") {
    if (!isDashboardLoaded("projects")) {
      content.innerHTML = LoadingState("جاري تحميل المشاريع...");
      ensureDashboardData(["projects"], view);
      return;
    }
    content.innerHTML = renderProjectsAdminPanel();
    bindProjectsAdminPanel();
    return;
  }

  if (role === "admin" && view === "deals") {
    if (!APP_STATE.dashboard?.deals?.length && !isDashboardLoaded("deals")) {
      content.innerHTML = LoadingState("جاري تحميل الديلات...");
      ensureDashboardData(["deals"], view);
      return;
    }
    content.innerHTML = `
      <section class="data-panel">
        <div class="dashboard-topbar">
          <div><span class="eyebrow">الديلات</span><h3>إدارة الديلات</h3></div>
          <button class="btn primary" type="button" id="openAdminDealWizard">+ إنشاء ديل جديد</button>
        </div>
        ${renderDealsList(APP_STATE.dashboard.deals || [], "admin")}
      </section>
    `;
    qs("#openAdminDealWizard")?.addEventListener("click", () => {
      APP_STATE.activeDashboardView = "newDeal";
      renderActiveDashboardView();
    });
    bindDashboardActions();
    return;
  }

  __legacyRenderActiveDashboardView();

  if (role === "owner" && view === "settings") {
    const settingsPanel = qs("#dashboardContent .data-panel");
    if (!settingsPanel || settingsPanel.querySelector(".owner-audit-shortcut")) return;
    settingsPanel.insertAdjacentHTML("afterbegin", `
      <div class="panel-actions owner-audit-shortcut">
        <button class="btn secondary" type="button" id="openAuditFromSettings">سجل النشاط</button>
      </div>
    `);
    qs("#openAuditFromSettings")?.addEventListener("click", () => {
      APP_STATE.activeDashboardView = "audit";
      renderDashboardShell();
      renderActiveDashboardView();
    });
  }
};
