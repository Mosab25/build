const BonyanProjects = [
  {
    id: "abd-elgalil",
    slug: "abd-elgalil",
    name: "عقار في أرض عبدالجليل",
    location: "أرض عبدالجليل",
    status: "تحت الإنشاء",
    deliveryDate: "2026-11-13",
    floorsCount: 7,
    unitsCount: 21,
    unitsPerFloor: 3,
    areas: ["137م²", "125م²", "120م²"],
    coverImage: "media/optimized/facade.webp",
    shortDescription: "مشروع عقاري تحت الإنشاء بإدارة ومتابعة Bonyan Developments، يهدف إلى تقديم تجربة سكنية أكثر تنظيمًا ووضوحًا للعملاء.",
    description: "مشروع عقاري تحت الإنشاء ضمن مشاريع Bonyan Developments، يتم تنفيذه ومتابعته بمنهج منظم يركز على جودة البناء، وضوح البيانات، وتحديث العملاء بشكل مستمر.",
  },
];

const AbdElgalilUnitTypes = [
  { type: "A", area: "137م²", direction: "بحري قبلي" },
  { type: "B", area: "125م²", direction: "بحري" },
  { type: "C", area: "120م²", direction: "قبلي" },
];

let publicProjectsCache = [];
let currentProjectDetailSlug = "";

function initProjects() {
  renderProjectsPage();
  bindProjectsRoute();
  handleProjectsRoute();
}

function projectRouteSlug() {
  const match = window.location.hash.match(/^#\/projects\/([^?/#]+)/);
  return match ? decodeURIComponent(match[1]) : "";
}

function isProjectsRoute() {
  return window.location.hash === "#/projects" || window.location.hash.startsWith("#/projects/");
}

function bindProjectsRoute() {
  if (document.body.dataset.projectsRouteBound) return;
  document.body.dataset.projectsRouteBound = "true";
  window.addEventListener("hashchange", handleProjectsRoute);
}

function handleProjectsRoute() {
  const projectsPage = qs("#projectsPage");
  const detailPage = qs("#projectDetailPage");
  if (!projectsPage || !detailPage) return;
  const open = isProjectsRoute();
  const slug = projectRouteSlug();
  document.body.classList.toggle("public-projects-route", open);
  projectsPage.hidden = !open || Boolean(slug);
  detailPage.hidden = !open || !slug;
  if (!open) return;
  if (slug) {
    renderProjectDetail(slug);
    return;
  }
  renderProjectsPage();
}

async function renderProjectsPage() {
  const grid = qs("#projectsGrid");
  if (!grid) return;
  grid.innerHTML = projectCardsLoadingState(2);
  try {
    const result = await PublicAPI.projects(1, 12);
    const projects = result.items || [];
    publicProjectsCache = projects;
    if (!projects.length) {
      grid.innerHTML = EmptyState("لا توجد مشاريع منشورة حاليًا.", "ستظهر مشاريع Bonyan Developments هنا فور نشرها من لوحة التحكم.");
      return;
    }
    grid.innerHTML = projects.map(renderProjectCard).join("");
  } catch (error) {
    grid.innerHTML = ErrorState("تعذر تحميل المشاريع الآن.");
  }
}

function refreshProjectsPage() {
  if (isProjectsRoute() && !projectRouteSlug()) return renderProjectsPage();
  return Promise.resolve();
}

function projectCardsLoadingState(count = 1) {
  return Array.from({ length: count }, () => `
    <article class="project-card project-card-skeleton">
      <div class="skeleton-block skeleton-media"></div>
      <div class="project-card-content">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
      </div>
    </article>
  `).join("");
}

function renderProjectCard(project) {
  const coverImage = projectCoverImage(project);
  return `
    <article class="project-card">
      <div class="project-card-media">
        ${coverImage
          ? `<img src="${escapeHTML(resolveMediaUrl(coverImage))}" alt="${escapeHTML(project.name)}" loading="lazy" decoding="async" />`
          : `<div class="project-cover-placeholder"><strong>${escapeHTML(project.name)}</strong></div>`}
      </div>
      <div class="project-card-content">
        <span class="eyebrow">مشروع عقاري</span>
        <h3>${escapeHTML(project.name)}</h3>
        <p>${escapeHTML(project.shortDescription)}</p>
        <div class="project-meta-grid">
          ${projectMeta("الموقع", project.location)}
        ${projectMeta("الحالة", projectStatusLabel(project))}
        ${projectMeta("نسبة الإنجاز", `${Number(project.progress || 0)}%`)}
        ${projectMeta("التسليم المتوقع", formatDate(project.deliveryDate || project.delivery_date))}
        ${projectMeta("عدد الأدوار", `${Number(project.floorsCount ?? project.floors_count ?? 0)} أدوار`)}
        ${projectMeta("عدد الوحدات", `${Number(project.unitsCount ?? project.units_count ?? 0)} وحدة`)}
        ${projectMeta("كل دور", `${Number(project.unitsPerFloor ?? project.units_per_floor ?? 0)} شقق`)}
        ${project.slug === "abd-elgalil" ? projectMeta("المساحات", "137م²، 125م²، 120م²") : ""}
        </div>
        <div class="project-card-actions">
          <a class="btn primary" href="#/projects/${escapeHTML(project.slug)}">عرض المشروع</a>
        </div>
      </div>
    </article>
  `;
}

function projectMeta(label, value) {
  return `<div><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></div>`;
}

function projectCoverImage(project) {
  return project.coverImage || project.cover_image || (project.slug === "abd-elgalil" ? "media/optimized/facade.webp" : "");
}

function projectStatusLabel(project) {
  if (project.slug === "abd-elgalil") return "تحت الإنشاء";
  return statusLabel(project.status || "published");
}

async function renderProjectDetail(slug) {
  const target = qs("#projectDetailContent");
  if (!target) return;
  currentProjectDetailSlug = slug;
  target.innerHTML = LoadingState("جاري تحميل بيانات المشروع...");
  try {
    const result = await PublicAPI.project(slug);
    const project = result.project || result;
    if (currentProjectDetailSlug !== slug) return;
    renderProjectDetailContent(project, target);
  } catch (error) {
    target.innerHTML = ErrorState(error.message || "المشروع غير متاح حاليًا.");
    return;
  }
}

function renderProjectDetailContent(project, target) {
  const coverImage = projectCoverImage(project);
  const detail = project.detailContent || project.detail_content || {};
  const projectName = project.name || "";
  target.innerHTML = `
    <section class="project-hero">
      <div class="project-hero-copy">
        <span class="eyebrow">${escapeHTML(detail.hero_eyebrow || "مشروع من Bonyan Developments")}</span>
        <h1>${escapeHTML(project.name)}</h1>
        <p>${escapeHTML(project.description)}</p>
        <div class="project-hero-actions">
          <a class="btn primary" href="${escapeHTML(detail.primary_url || "#client-access")}">${escapeHTML(detail.primary_label || "دخول بوابة العملاء")}</a>
          <button class="btn secondary" type="button" data-project-scroll="projectUpdatesInProject">${escapeHTML(detail.secondary_label || "مشاهدة التحديثات")}</button>
        </div>
      </div>
      <div class="project-hero-media">
        ${coverImage
          ? `<img src="${escapeHTML(resolveMediaUrl(coverImage))}" alt="${escapeHTML(project.name)}" loading="lazy" decoding="async" />`
          : `<div class="project-cover-placeholder large"><strong>${escapeHTML(project.name)}</strong></div>`}
      </div>
    </section>

    <section class="project-detail-section" id="projectAboutInProject">
      <div class="section-heading">
        <span class="eyebrow">${escapeHTML(detail.about_eyebrow || "نبذة عن المشروع")}</span>
        <h2>${escapeHTML(project.name)}</h2>
        <p>${escapeHTML(project.shortDescription)}</p>
      </div>
    </section>

    <section class="project-detail-section">
      <div class="section-heading">
        <span class="eyebrow">${escapeHTML(detail.info_eyebrow || "بيانات المشروع")}</span>
        <h2>${escapeHTML(detail.info_title || "بيانات واضحة للعملاء والمتابعة")}</h2>
      </div>
      <div class="project-info-grid">
        ${projectMetaCard("الموقع", project.location)}
        ${projectMetaCard("الحالة", projectStatusLabel(project))}
        ${projectMetaCard("نسبة الإنجاز", `${Number(project.progress || 0)}%`)}
        ${projectMetaCard("التسليم المتوقع", formatDate(project.deliveryDate || project.delivery_date))}
        ${projectMetaCard("عدد الأدوار", String(project.floorsCount ?? project.floors_count ?? 0))}
        ${projectMetaCard("إجمالي الوحدات", String(project.unitsCount ?? project.units_count ?? 0))}
        ${projectMetaCard("وحدات كل دور", `${Number(project.unitsPerFloor ?? project.units_per_floor ?? 0)} شقق`)}
        ${project.slug === "abd-elgalil" ? `
          ${projectMetaCard("الشقة A", "137م²")}
          ${projectMetaCard("الشقة B", "125م²")}
          ${projectMetaCard("الشقة C", "120م²")}
        ` : ""}
      </div>
    </section>

    ${detail.show_units === false ? "" : `
    <section class="project-detail-section">
      <div class="section-heading">
        <span class="eyebrow">${escapeHTML(detail.units_eyebrow || "الوحدات والمساحات")}</span>
        <h2>${escapeHTML(detail.units_title || "توزيع الوحدات على الأدوار")}</h2>
      </div>
      <div class="project-units-grid">
        ${renderProjectUnits(project)}
      </div>
    </section>
    `}

    ${detail.show_gallery === false ? "" : `
    <section class="project-detail-section" data-project-gallery-section>
      <div class="section-heading">
        <span class="eyebrow">${escapeHTML(detail.gallery_eyebrow || "معرض الصور والفيديو")}</span>
        <h2>${escapeHTML(detail.gallery_title || "لقطات من المشروع والوحدات")}</h2>
      </div>
      <div class="gallery-grid project-gallery-grid" id="projectGalleryGrid"></div>
    </section>
    `}

    ${detail.show_updates === false ? "" : `
    <section class="project-detail-section project-updates-section" id="projectUpdatesInProject">
      <div class="section-heading">
        <span class="eyebrow">${escapeHTML(detail.updates_eyebrow || "آخر تحديثات المشروع")}</span>
        <h2>${escapeHTML(detail.updates_title || "تحديثات المشروع")}</h2>
        <p>${escapeHTML(detail.updates_text || `آخر التحديثات المنشورة الخاصة بمشروع ${projectName}.`)}</p>
      </div>
      <div class="updates-grid project-updates-grid" id="projectDetailUpdatesGrid"></div>
    </section>
    `}

    ${detail.show_partnerships === false ? "" : `
    <section class="project-detail-section project-partnership-section">
      <div class="section-heading">
        <span class="eyebrow">${escapeHTML(detail.partnerships_eyebrow || "الشراكات المرتبطة بالمشروع")}</span>
        <h2>${escapeHTML(detail.partnerships_title || "شراكات تطوير وتنفيذ")}</h2>
        <p>${escapeHTML(detail.partnerships_text || (project.slug === "abd-elgalil" ? "Bonyan Developments لمشروع عقاري في أرض عبدالجليل، برؤية تركز على جودة التنفيذ، وضوح المتابعة، وتعزيز ثقة العملاء." : "شراكات تطوير وتنفيذ مرتبطة بالمشروع عند توفرها."))}</p>
      </div>
      <div id="projectDetailPartnerships"></div>
    </section>
    `}

    ${detail.show_portal === false ? "" : `
    <section class="project-detail-section project-client-portal-card">
      <div>
        <span class="eyebrow">${escapeHTML(detail.portal_eyebrow || "بوابة عملاء بنيان")}</span>
        <h2>${escapeHTML(detail.portal_title || "متابعة الحجز والمدفوعات")}</h2>
        <p>${escapeHTML(detail.portal_text || "يمكن للعملاء متابعة بيانات الحجز، الوحدات، المدفوعات، والمتبقي من خلال كود الحجز.")}</p>
      </div>
      <a class="btn primary" href="#client-access">${escapeHTML(detail.portal_button || "دخول بوابة العملاء")}</a>
    </section>
    `}

    ${detail.show_contact === false ? "" : `
    <section class="project-detail-section project-contact-card">
      <div>
        <span class="eyebrow">${escapeHTML(detail.contact_eyebrow || "تواصل معنا")}</span>
        <h2>${escapeHTML(detail.contact_title || `اسأل عن ${projectName}`)}</h2>
        <p>${escapeHTML(detail.contact_text || "فريق بنيان جاهز للإجابة على استفسارات المشروع ومتابعة بيانات الحجز.")}</p>
      </div>
      <a class="btn secondary" href="#contact">${escapeHTML(detail.contact_button || "تواصل معنا")}</a>
    </section>
    `}
  `;
  bindProjectDetailActions();
  if (detail.show_gallery !== false) renderProjectGallery();
  if (detail.show_updates !== false) loadProjectDetailUpdates(project.slug);
  if (detail.show_partnerships !== false) loadProjectDetailPartnerships(project.slug);
}

function projectMetaCard(label, value) {
  return `
    <article>
      <span>${escapeHTML(label)}</span>
      <strong>${escapeHTML(value)}</strong>
    </article>
  `;
}

function renderProjectUnits(project) {
  if (project.slug !== "abd-elgalil") {
    return `
      <article class="project-floor-card project-general-units">
        <h3>بيانات الوحدات</h3>
        <div>
          <span><strong>عدد الأدوار</strong>${Number(project.floorsCount ?? project.floors_count ?? 0)}</span>
          <span><strong>إجمالي الوحدات</strong>${Number(project.unitsCount ?? project.units_count ?? 0)}</span>
          <span><strong>وحدات كل دور</strong>${Number(project.unitsPerFloor ?? project.units_per_floor ?? 0)}</span>
        </div>
      </article>
    `;
  }
  return Array.from({ length: 7 }, (_, index) => {
    const floor = index + 1;
    return `
      <article class="project-floor-card">
        <h3>الدور ${floor.toLocaleString("ar-EG")}</h3>
        <div>
          ${AbdElgalilUnitTypes.map((unit) => `
            <span><strong>شقة ${unit.type}</strong>${unit.area} - ${unit.direction}</span>
          `).join("")}
        </div>
      </article>
    `;
  }).join("");
}

function bindProjectDetailActions() {
  qsa("[data-project-scroll]").forEach((button) => {
    button.addEventListener("click", () => {
      qs(`#${button.dataset.projectScroll}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  });
}

function renderProjectGallery() {
  const grid = qs("#projectGalleryGrid");
  if (!grid || !Array.isArray(GALLERY_ORDER)) return;
  grid.innerHTML = GALLERY_ORDER.map((item, index) => `
    <article class="media-card" data-project-media-key="${escapeHTML(item.key)}" tabindex="0">
      ${renderGalleryCardMedia(item, index)}
      <div class="media-card-body">
        <span class="eyebrow">${item.type === "video" ? "فيديو" : "صورة"}</span>
        <h3>${escapeHTML(item.label)}</h3>
      </div>
    </article>
  `).join("");
  qsa("[data-project-media-key]", grid).forEach((card) => {
    card.addEventListener("click", () => openMedia(card.dataset.projectMediaKey));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openMedia(card.dataset.projectMediaKey);
    });
  });
}

async function loadProjectDetailUpdates(slug) {
  const grid = qs("#projectDetailUpdatesGrid");
  if (!grid) return;
  grid.innerHTML = updatesLoadingState(3);
  try {
    const result = await PublicAPI.projectUpdates(1, 6, slug);
    const updates = result.items || [];
    if (!updates.length) {
      grid.innerHTML = EmptyState("لا توجد تحديثات منشورة حاليًا.", "ستظهر تحديثات المشروع هنا بعد نشرها من لوحة التحكم.");
      return;
    }
    grid.innerHTML = updates.map((update) => renderUpdateCard(update)).join("");
    bindUpdateCards(grid);
  } catch (error) {
    grid.innerHTML = ErrorState("تعذر تحميل تحديثات المشروع الآن.");
  }
}

async function loadProjectDetailPartnerships(slug) {
  const target = qs("#projectDetailPartnerships");
  if (!target) return;
  target.innerHTML = partnershipSkeleton(1);
  try {
    const result = await PublicAPI.partnerships(1, 3, slug);
    const partnerships = result.items || [];
    if (!partnerships.length) {
      target.innerHTML = renderStaticProjectPartnership();
      return;
    }
    target.innerHTML = `<div class="partnerships-grid">${partnerships.map((item) => renderPartnershipCard(item, { compact: true })).join("")}</div>`;
    bindPartnershipCards(target);
  } catch (error) {
    target.innerHTML = renderStaticProjectPartnership();
  }
}

function renderStaticProjectPartnership() {
  return `
    <article class="partnership-card project-static-partnership">
      <div class="partnership-media">
        <img src="${escapeHTML(resolveMediaUrl("media/partnership-bonyan-abdeljalil.png"))}" alt="Bonyan Developments لمشروع عقاري في أرض عبدالجليل" loading="lazy" decoding="async" />
      </div>
      <div class="partnership-content">
        <span class="partnership-badge">شراكة استراتيجية</span>
        <h2>Bonyan Developments لمشروع عقاري في أرض عبدالجليل</h2>
        <p class="partnership-subtitle">شراكة تطوير وتنفيذ تعزز جودة المشروع وتدعم تجربة العملاء.</p>
      </div>
    </article>
  `;
}
