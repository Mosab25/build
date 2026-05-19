async function initApp() {
  qs("#navToggle").addEventListener("click", () => qs("#navLinks").classList.toggle("open"));
  qs("#mobileStaffLoginLink")?.addEventListener("click", (event) => {
    event.preventDefault();
    qs("#staffLoginModal").hidden = false;
    qs("#navLinks").classList.remove("open");
  });
  qsa("a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => qs("#navLinks").classList.remove("open"));
  });
  initAuth();
  initClientPortal();
  initLatestUpdates();
  if (typeof initPartnerships === "function") initPartnerships();
  if (typeof initProjects === "function") initProjects();
  initPublicHome();
  scheduleAfterFirstPaint(initGallery);
  if (shouldRestoreDashboardSession()) {
    restoreSession();
  }
}

function shouldRestoreDashboardSession() {
  const params = new URLSearchParams(window.location.search);
  return window.location.hash === "#dashboard" || params.has("dashboard");
}

document.addEventListener("DOMContentLoaded", initApp);
