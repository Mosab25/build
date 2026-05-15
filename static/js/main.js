async function initApp() {
  qs("#navToggle").addEventListener("click", () => qs("#navLinks").classList.toggle("open"));
  qsa("a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => qs("#navLinks").classList.remove("open"));
  });
  initAuth();
  initClientPortal();
  initLatestUpdates();
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
