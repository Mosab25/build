async function initPublicHome() {
  initProjectCountdown();
  renderPublicStatsSkeleton();
  renderAvailabilitySkeleton();
  scheduleAfterFirstPaint(loadPublicOverview);
}

async function loadPublicOverview() {
  try {
    const overview = await PublicAPI.overview();
    APP_STATE.overview = overview;
    applyOfficeSettings(overview.settings || {});
    renderPublicStats(overview.summary || {});
    renderAvailabilityOverview(overview.apartments || []);
  } catch (error) {
    APP_STATE.overview = null;
    renderPublicStats({});
    renderAvailabilityOverview([]);
  }
}

function applyOfficeSettings(settings) {
  APP_CONFIG.officeName = settings.officeName || APP_CONFIG.officeName;
  APP_CONFIG.officePhone = settings.officePhone || APP_CONFIG.officePhone;
  APP_CONFIG.whatsappNumber = settings.whatsappNumber || APP_CONFIG.whatsappNumber;
  APP_CONFIG.location = settings.officeAddress || APP_CONFIG.location;
  qs("#publicWhatsapp").href = `https://wa.me/${APP_CONFIG.whatsappNumber}?text=${encodeURIComponent("مرحبًا، أريد الاستفسار عن مشاريع بنيان للتطوير العقاري.")}`;
  qs("#publicPhone").href = `tel:+2${APP_CONFIG.officePhone}`;
}

const PROJECT_DELIVERY_TARGET = new Date("2026-11-13T00:00:00");

function initProjectCountdown() {
  const target = qs("#projectCountdown");
  if (!target) return;

  const render = () => {
    const remaining = PROJECT_DELIVERY_TARGET.getTime() - Date.now();
    if (remaining <= 0) {
      target.innerHTML = `
        <div>
          <span class="eyebrow">حالة المشروع</span>
          <strong>تم الوصول إلى موعد التسليم المتوقع</strong>
        </div>
      `;
      window.clearInterval(APP_STATE.projectCountdownTimer);
      return;
    }

    const totalSeconds = Math.floor(remaining / 1000);
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    target.innerHTML = `
      <div>
        <span class="eyebrow">الوقت المتبقي لانتهاء المشروع</span>
        <strong>التسليم المتوقع: 13 نوفمبر 2026</strong>
      </div>
      <div class="countdown-grid">
        ${countdownItem("يوم", days)}
        ${countdownItem("ساعة", hours)}
        ${countdownItem("دقيقة", minutes)}
        ${countdownItem("ثانية", seconds)}
      </div>
    `;
  };

  render();
  window.clearInterval(APP_STATE.projectCountdownTimer);
  APP_STATE.projectCountdownTimer = window.setInterval(render, 1000);
}

function countdownItem(label, value) {
  return `<article><strong>${Number(value || 0).toLocaleString("ar-EG")}</strong><span>${escapeHTML(label)}</span></article>`;
}

function renderPublicStats(summary) {
  const stats = [
    ["إجمالي الشقق", summary.totalApartments || 21],
    ["المتاحة", summary.availableApartments || 0],
    ["المحجوزة", summary.reservedApartments || 0],
    ["المباعة", summary.soldApartments || 0],
  ];
  qs("#publicStats").innerHTML = stats.map(([label, value]) => `
    <article class="stat-card">
      <strong>${Number(value).toLocaleString("ar-EG")}</strong>
      <span>${escapeHTML(label)}</span>
    </article>
  `).join("");
}

function renderPublicStatsSkeleton() {
  const target = qs("#publicStats");
  if (!target) return;
  target.innerHTML = Array.from({ length: 4 }, () => `
    <article class="stat-card stat-card-skeleton" aria-hidden="true">
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
    </article>
  `).join("");
}

function renderAvailabilitySkeleton() {
  const target = qs("#publicAvailability");
  if (!target) return;
  target.innerHTML = Array.from({ length: 7 }, (_, index) => `
    <article class="floor-mini floor-mini-skeleton" aria-hidden="true">
      <strong>الدور ${(7 - index).toLocaleString("ar-EG")}</strong>
      <div class="unit-dots">
        <span class="unit-dot skeleton-dot"></span>
        <span class="unit-dot skeleton-dot"></span>
        <span class="unit-dot skeleton-dot"></span>
      </div>
    </article>
  `).join("");
}

function renderAvailabilityOverview(apartments) {
  const grouped = Array.from({ length: 7 }, (_, index) => {
    const floor = index + 1;
    return { floor, units: apartments.filter((apt) => apt.floorNumber === floor) };
  }).reverse();
  qs("#publicAvailability").innerHTML = grouped.map(({ floor, units }) => `
    <article class="floor-mini">
      <strong>الدور ${floor.toLocaleString("ar-EG")}</strong>
      <div class="unit-dots">
        ${units.map((unit) => `<span class="unit-dot ${statusClass(unit.status)}" title="${escapeHTML(unit.unitCode)}"></span>`).join("")}
      </div>
    </article>
  `).join("");
}

function renderApartmentModels() {
  const target = qs("#apartmentModels");
  if (!target) return;
  target.innerHTML = APARTMENT_MODELS.map((model) => `
    <article class="model-card">
      <img src="${model.thumbSrc || model.src}" alt="${escapeHTML(model.alt)}" loading="lazy" decoding="async" onerror="this.replaceWith(mediaFallback('${escapeHTML(model.title)}'))" />
      <div class="model-card-body">
        <span class="eyebrow">Type ${model.apartmentType}</span>
        <h3>${escapeHTML(model.title)}</h3>
        <p>${model.area}م² — ${escapeHTML(model.direction)}</p>
      </div>
    </article>
  `).join("");
}
