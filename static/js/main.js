async function initApp() {
  qs("#navToggle").addEventListener("click", () => qs("#navLinks").classList.toggle("open"));
  qsa("a[href^='#']").forEach((link) => {
    link.addEventListener("click", () => qs("#navLinks").classList.remove("open"));
  });
  initAuth();
  initClientPortal();
  initGallery();
  initLatestUpdates();
  await initPublicHome();
  await restoreSession();
}

document.addEventListener("DOMContentLoaded", initApp);
