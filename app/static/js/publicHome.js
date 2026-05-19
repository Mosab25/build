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
    applyHomepageContent(overview.homepageContent || {});
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

function setHomeText(selector, value) {
  const element = qs(selector);
  if (element && value !== undefined && value !== null && String(value).trim() !== "") {
    element.textContent = value;
  }
}

function setHomeHref(selector, value) {
  const element = qs(selector);
  if (element && value !== undefined && value !== null && String(value).trim() !== "") {
    element.setAttribute("href", value);
  }
}

function setHomeImage(selector, value) {
  const element = qs(selector);
  if (element && value !== undefined && value !== null && String(value).trim() !== "") {
    element.setAttribute("src", resolveMediaUrl(value));
  }
}

function setHomeSectionVisible(selector, visible) {
  const element = qs(selector);
  if (!element || visible === undefined || visible === null || visible === "") return;
  element.hidden = String(visible) === "false" || visible === false;
}

function applyHomepageContent(content) {
  if (!content || typeof content !== "object") return;

  setHomeText(".hero-content .eyebrow", content.hero_eyebrow);
  setHomeText(".hero-title", content.hero_title);
  setHomeText(".hero-copy", content.hero_copy);
  setHomeText(".hero-overview-link", content.hero_overview_link_label);
  setHomeHref(".hero-overview-link", content.hero_overview_link_url);
  setHomeText(".hero-actions .btn.primary", content.hero_primary_label);
  setHomeHref(".hero-actions .btn.primary", content.hero_primary_url);
  setHomeText(".hero-actions .btn.secondary", content.hero_secondary_label);
  setHomeHref(".hero-actions .btn.secondary", content.hero_secondary_url);
  setHomeImage(".hero-visual img", content.hero_image);

  setHomeText("#about-bonyan .section-heading .eyebrow", content.about_eyebrow);
  setHomeText("#about-bonyan .section-heading h2", content.about_title);
  setHomeText("#about-bonyan .section-heading p", content.about_text);

  setHomeText("#overview .section-heading .eyebrow", content.overview_eyebrow);
  setHomeText("#overview .section-heading h2", content.overview_title);
  setHomeText("#overview .section-heading p", content.overview_text);

  setHomeText("#partnership .partnership-badge", content.partnership_badge);
  setHomeText("#partnership .partnerships-heading .eyebrow", content.partnership_eyebrow);
  setHomeText("#partnership .partnerships-heading h2", content.partnership_title);
  setHomeText("#partnership .partnerships-heading p", content.partnership_text);
  setHomeText("#partnership .partnership-content .eyebrow", content.partnership_eyebrow);
  setHomeText("#partnership .partnership-content h2", content.partnership_title);
  setHomeText("#partnership .partnership-subtitle", content.partnership_subtitle);
  setHomeText("#partnership .partnership-content > p:not(.eyebrow):not(.partnership-subtitle):not(.partnership-note)", content.partnership_text);
  setHomeText("#partnership .partnership-note", content.partnership_note);
  setHomeText("#partnership .partnership-actions .btn.primary", content.partnership_primary_label);
  setHomeHref("#partnership .partnership-actions .btn.primary", content.partnership_primary_url);
  setHomeText("#partnership .partnership-actions .btn.secondary", content.partnership_secondary_label);
  setHomeHref("#partnership .partnership-actions .btn.secondary", content.partnership_secondary_url);
  setHomeImage("#partnership .partnership-media img", content.partnership_image);

  setHomeText("#gallery .section-heading .eyebrow", content.gallery_eyebrow);
  setHomeText("#gallery .section-heading h2", content.gallery_title);

  setHomeText("#updates .section-heading .eyebrow", content.updates_eyebrow);
  setHomeText("#updates .section-heading h2", content.updates_title);
  setHomeText("#updates .updates-section-copy", content.updates_text);
  setHomeText("#updatesHomeActions .btn", content.updates_all_label);

  setHomeText("#client-access .access-panel .eyebrow", content.portal_eyebrow);
  setHomeText("#client-access .access-panel h2", content.portal_title);
  setHomeText("#client-access .access-panel p:not(.form-message)", content.portal_text);
  setHomeText("#clientCodeButton", content.portal_button_label);

  setHomeText("#contact .eyebrow", content.contact_eyebrow);
  setHomeText("#contact h2", content.contact_title);
  setHomeText("#officeContactText", content.contact_text);
  setHomeText("#publicWhatsapp", content.whatsapp_label);
  setHomeText("#publicPhone", content.phone_label);
  if (content.whatsapp_message) {
    qs("#publicWhatsapp").href = `https://wa.me/${APP_CONFIG.whatsappNumber}?text=${encodeURIComponent(content.whatsapp_message)}`;
  }

  setHomeSectionVisible("#about-bonyan", content.show_about);
  setHomeSectionVisible("#overview", content.show_overview);
  setHomeSectionVisible("#partnership", content.show_partnerships);
  setHomeSectionVisible("#gallery", content.show_gallery);
  setHomeSectionVisible("#updates", content.show_updates);
  setHomeSectionVisible("#client-access", content.show_client_portal);
  setHomeSectionVisible("#contact", content.show_contact);
  setHomeSectionVisible("#projectCountdown", content.show_countdown);
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
