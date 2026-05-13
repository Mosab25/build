// Main Application Initialization
function init() {
  hydrateProjectData();
  renderTimeline();
  renderUpdates();
  renderGallery();
  renderStats();
  initReservationSystem();
  enableGalleryFilters();
  enableLeadForm();
  enableRevealAnimations();
  updateCountdown();
  setProgressBars();
  window.setInterval(updateCountdown, 1000);
  
  // Load updates table if updates admin tab is active
  const updatesTab = document.getElementById("updatesAdminTab");
  if (updatesTab && updatesTab.classList.contains("active")) {
    loadUpdatesTable();
  }
}

function hydrateProjectData() {
  // This would normally fetch from API
  document.getElementById("projectName").textContent = project.name;
  document.getElementById("projectLocation").textContent = project.location;
  document.getElementById("currentPhase").textContent = project.currentPhase;
  document.getElementById("deliveryDate").textContent = project.deliveryDate;
  document.getElementById("totalFloors").textContent = project.floors;
  document.getElementById("totalUnits").textContent = project.totalUnits;
  document.getElementById("soldUnits").textContent = project.soldUnits;
  document.getElementById("availableSpaces").textContent = project.spaces;
}

function renderTimeline() {
  const container = document.getElementById("timelineGrid");
  if (!container) return;

  container.innerHTML = stages
    .map(
      (stage, index) => `
    <article class="stage ${stage.className} reveal" style="--delay:${index * 70}ms">
      ${stage.status === "active" ? '<div class="stage-status">قيد التنفيذ</div>' : ""}
      <h3>${stage.title}</h3>
      <p>${stage.description}</p>
      <div class="stage-date">
        <span>البداية: ${formatDate(stage.start)}</span>
        <span>النهاية: ${formatDate(stage.end)}</span>
      </div>
      <div class="stage-progress">
        <div class="stage-progress-head">
          <span>نسبة الإنجاز</span>
          <span>${formatPercent(stage.progress)}</span>
        </div>
        <div class="progress-track" aria-label="نسبة اكتمال ${stage.title}">
          <div class="progress-fill" data-progress="${stage.progress}"></div>
        </div>
      </div>
    </article>
      `,
    )
    .join("");
}

function renderStats() {
  const container = document.getElementById("statsGrid");
  if (!container) return;

  container.innerHTML = `
    <article class="stat-card reveal" style="--delay:0ms">
      <strong>${project.floors}</strong>
      <span>عدد الطوابق</span>
      <small>مبنى سكني مكون من ${project.floors} طابق</small>
    </article>
    <article class="stat-card reveal" style="--delay:70ms">
      <strong>${project.totalUnits}</strong>
      <span>إجمالي الوحدات</span>
      <small>مجموع الشقق في المشروع</small>
    </article>
    <article class="stat-card reveal" style="--delay:140ms">
      <strong>${project.soldUnits}</strong>
      <span>الوحدات المباعة</span>
      <small>عدد الشقق المباعة حالياً</small>
    </article>
    <article class="stat-card reveal" style="--delay:210ms">
      <strong>${project.spaces}</strong>
      <span>المساحات</span>
      <small>تنوع المساحات المتاحة</small>
    </article>
  `;
}

function enableLeadForm() {
  const form = document.getElementById("leadForm");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const formData = new FormData(form);
    const leadData = {
      name: formData.get('name'),
      phone: formData.get('phone'),
      email: formData.get('email'),
      message: formData.get('message')
    };

    try {
      await apiFetch('/api/leads', {
        method: 'POST',
        body: JSON.stringify(leadData)
      });

      showToast('تم إرسال بياناتك بنجاح. سنتواصل معك قريباً', 'success');
      form.reset();
    } catch (error) {
      showToast('فشل إرسال البيانات. يرجى المحاولة مرة أخرى', 'error');
    }
  });
}

function enableRevealAnimations() {
  const revealItems = document.querySelectorAll(".reveal");

  if (!("IntersectionObserver" in window)) {
    revealItems.forEach((item) => item.classList.add("visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("visible");
        }
      });
    },
    { threshold: 0.1 }
  );

  revealItems.forEach((item) => observer.observe(item));
}

function updateCountdown() {
  const countdownElement = document.getElementById("countdown");
  if (!countdownElement) return;

  const now = new Date().getTime();
  const target = new Date(project.deliveryDate).getTime();
  const distance = target - now;

  if (distance < 0) {
    countdownElement.innerHTML = "<strong>تم التسليم</strong>";
    return;
  }

  const days = Math.floor(distance / (1000 * 60 * 60 * 24));
  const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
  const seconds = Math.floor((distance % (1000 * 60)) / 1000);

  countdownElement.innerHTML = `
    <strong>${toArabicNumber(days)}</strong> يوم
    <strong>${toArabicNumber(hours)}</strong> ساعة
    <strong>${toArabicNumber(minutes)}</strong> دقيقة
    <strong>${toArabicNumber(seconds)}</strong> ثانية
  `;
}

function setProgressBars() {
  const progressBars = document.querySelectorAll(".progress-fill");
  progressBars.forEach((bar) => {
    const progress = bar.dataset.progress;
    if (progress) {
      setTimeout(() => {
        bar.style.width = `${progress}%`;
      }, 100);
    }
  });
}

function initReservationSystem() {
  // Initialize portal tabs
  document.querySelectorAll("[data-portal-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.portalTab;
      document
        .querySelectorAll("[data-portal-tab]")
        .forEach((tabButton) => {
          const isActive = tabButton.dataset.portalTab === target;
          tabButton.classList.toggle("active", isActive);
          tabButton.setAttribute("aria-selected", String(isActive));
        });
      document
        .querySelectorAll(".portal-panel")
        .forEach((panel) => panel.classList.remove("active"));
      document
        .getElementById(`${target}PortalPanel`)
        ?.classList.add("active");
    });
  });
}

// Initialize application when DOM is ready
document.addEventListener("DOMContentLoaded", init);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    init,
    hydrateProjectData,
    renderTimeline,
    renderStats,
    enableLeadForm,
    enableRevealAnimations,
    updateCountdown,
    setProgressBars,
    initReservationSystem
  };
}
