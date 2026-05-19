let partnershipsAdminFilter = "active";
let partnershipsAdminItems = [];
let partnershipsPage = 1;
let partnershipsHasMore = false;
let partnershipsLoading = false;

function canManagePartnerships() {
  return ["owner", "admin"].includes(APP_STATE.session?.role);
}

function resolvePartnershipImage(url) {
  return typeof resolveMediaUrl === "function" ? resolveMediaUrl(url) : String(url || "");
}

function partnershipSkeleton(count = 1) {
  return Array.from({ length: count }, () => `
    <article class="partnership-card partnership-card-skeleton" aria-hidden="true">
      <div class="skeleton-block skeleton-media"></div>
      <div class="partnership-content">
        <div class="skeleton-line short"></div>
        <div class="skeleton-line"></div>
        <div class="skeleton-line"></div>
      </div>
    </article>
  `).join("");
}

function initPartnerships() {
  const section = qs("#partnership");
  if (section) {
    section.dataset.staticFallback = section.innerHTML;
    section.innerHTML = partnershipSkeleton(1);
    scheduleAfterFirstPaint(loadPublicPartnerships);
  }
  bindPartnershipsRoute();
  handlePartnershipsRoute();
}

async function loadPublicPartnerships() {
  const section = qs("#partnership");
  if (!section) return;
  try {
    const result = await PublicAPI.partnerships(1, 3);
    const partnerships = result.items || [];
    if (!partnerships.length) {
      section.innerHTML = section.dataset.staticFallback || "";
      return;
    }
    section.innerHTML = `
      <div class="section-heading partnerships-heading">
        <span class="eyebrow">شركاؤنا في النجاح</span>
        <h2>شراكاتنا</h2>
        <p>شراكات تطويرية تدعم جودة المشروع وتجربة العملاء.</p>
      </div>
      <div class="${partnerships.length === 1 ? "partnership-featured" : "partnerships-grid"}">
        ${partnerships.map((item) => renderPartnershipCard(item, { compact: true })).join("")}
      </div>
      <div class="partnership-actions public-partnership-actions">
        <a class="btn primary" href="#/partnerships">عرض كل الشراكات</a>
      </div>
    `;
    bindPartnershipCards(section);
  } catch (error) {
    section.innerHTML = section.dataset.staticFallback || "";
  }
}

function renderPartnershipImage(item) {
  const src = resolvePartnershipImage(item.image_url);
  if (!src) {
    return `
      <div class="partnership-media partnership-media-placeholder">
        <strong>${escapeHTML(item.partner_name || "شراكة")}</strong>
        <span>لا توجد صورة مرفقة</span>
      </div>
    `;
  }
  return `
    <div class="partnership-media" data-partnership-media>
      <img src="${escapeHTML(src)}" alt="${escapeHTML(item.title || item.partner_name || "شراكة")}" loading="lazy" decoding="async" />
      <div class="media-error" hidden>تعذر تحميل صورة الشراكة.</div>
    </div>
  `;
}

function renderPartnershipCard(item, options = {}) {
  const compact = Boolean(options.compact);
  const description = compact ? item.short_description : (item.description || item.short_description);
  const route = `#/partnerships?id=${encodeURIComponent(item.id || "")}`;
  return `
    <article class="partnership-card ${compact ? "partnership-card-compact" : ""}" data-partnership-card data-partnership-id="${escapeHTML(item.id || "")}">
      ${renderPartnershipImage(item)}
      <div class="partnership-content">
        <span class="partnership-badge">شراكة استراتيجية</span>
        <p class="eyebrow">${escapeHTML(item.partner_name || "")}</p>
        <h2>${escapeHTML(item.title || "")}</h2>
        <p class="partnership-subtitle">${escapeHTML(item.short_description || "")}</p>
        ${description ? `<p class="partnership-description ${compact ? "partnership-description-compact" : ""}" data-partnership-text>${escapeHTML(description)}</p>` : ""}
        <div class="partnership-actions">
          ${compact
            ? `<a class="btn secondary" href="${route}">معرفة المزيد</a>`
            : `<button type="button" class="btn secondary" data-partnership-read-more hidden aria-expanded="false">قراءة المزيد</button>`}
          ${item.link_url ? `<a class="btn ghost" href="${escapeHTML(item.link_url)}">عرض التفاصيل</a>` : ""}
        </div>
      </div>
    </article>
  `;
}

function bindPartnershipCards(scope = document) {
  window.requestAnimationFrame(() => updatePartnershipReadMoreVisibility(scope));
  if (!scope.dataset?.partnershipCardsBound) {
    if (scope.dataset) scope.dataset.partnershipCardsBound = "true";
    scope.addEventListener("click", (event) => {
      const button = event.target.closest("[data-partnership-read-more]");
      if (!button) return;
      const card = button.closest("[data-partnership-card]");
      const text = qs("[data-partnership-text]", card);
      if (!text) return;
      const expanded = text.classList.toggle("expanded");
      button.textContent = expanded ? "عرض أقل" : "قراءة المزيد";
      button.setAttribute("aria-expanded", String(expanded));
    });
  }
  qsa("[data-partnership-media]", scope).forEach((media) => {
    const errorBox = qs(".media-error", media);
    qs("img", media)?.addEventListener("error", () => {
      if (errorBox) errorBox.hidden = false;
      media.classList.add("has-media-error");
    });
  });
}

function updatePartnershipReadMoreVisibility(scope = document) {
  qsa("[data-partnership-card]", scope).forEach((card) => {
    const text = qs("[data-partnership-text]", card);
    const button = qs("[data-partnership-read-more]", card);
    if (!text || !button) return;
    const wasExpanded = text.classList.contains("expanded");
    if (wasExpanded) text.classList.remove("expanded");
    const overflowing = text.scrollHeight > text.clientHeight + 2;
    button.hidden = !overflowing;
    if (wasExpanded && overflowing) text.classList.add("expanded");
    if (!overflowing) {
      text.classList.remove("expanded");
      button.textContent = "قراءة المزيد";
      button.setAttribute("aria-expanded", "false");
    }
  });
}

function isPartnershipsRoute() {
  return window.location.hash.startsWith("#/partnerships");
}

function selectedPartnershipFromHash() {
  const raw = window.location.hash.split("?", 2)[1] || "";
  return new URLSearchParams(raw).get("id") || "";
}

function bindPartnershipsRoute() {
  if (document.body.dataset.partnershipsRouteBound) return;
  document.body.dataset.partnershipsRouteBound = "true";
  window.addEventListener("hashchange", handlePartnershipsRoute);
}

function handlePartnershipsRoute() {
  const page = qs("#allPartnershipsPage");
  if (!page) return;
  const open = isPartnershipsRoute();
  document.body.classList.toggle("public-partnerships-route", open);
  page.hidden = !open;
  if (open) {
    loadPartnershipsPage({ reset: true, selectedId: selectedPartnershipFromHash() });
  }
}

async function loadPartnershipsPage({ reset = false, selectedId = "" } = {}) {
  const grid = qs("#allPartnershipsGrid");
  const actions = qs("#allPartnershipsActions");
  if (!grid || partnershipsLoading) return;
  partnershipsLoading = true;
  try {
    if (reset) {
      partnershipsPage = 1;
      grid.innerHTML = partnershipSkeleton(3);
      actions.hidden = true;
      actions.innerHTML = "";
    }
    const result = await PublicAPI.partnerships(partnershipsPage, 12);
    const items = result.items || [];
    if (!items.length && partnershipsPage === 1) {
      grid.innerHTML = EmptyState("لا توجد شراكات منشورة حاليًا.", "ستظهر الشراكات هنا بعد نشرها من لوحة التحكم.");
      return;
    }
    const html = items.map((item) => renderPartnershipCard(item)).join("");
    grid.innerHTML = partnershipsPage === 1 ? html : `${grid.innerHTML}${html}`;
    partnershipsHasMore = result.hasMore;
    renderPartnershipsPageActions(actions);
    bindPartnershipCards(grid);
    if (selectedId) expandSelectedPartnership(selectedId);
  } catch (error) {
    grid.innerHTML = ErrorState("تعذر تحميل الشراكات الآن.");
  } finally {
    partnershipsLoading = false;
  }
}

function renderPartnershipsPageActions(actions) {
  if (!actions) return;
  actions.hidden = false;
  actions.innerHTML = `
    <a class="btn secondary" href="#partnership">العودة إلى الشراكات</a>
    ${partnershipsHasMore ? `<button class="btn primary" type="button" id="loadMorePartnershipsButton">تحميل المزيد</button>` : ""}
  `;
  qs("#loadMorePartnershipsButton")?.addEventListener("click", async () => {
    partnershipsPage += 1;
    await loadPartnershipsPage();
  });
}

function expandSelectedPartnership(partnershipId) {
  const escapedId = typeof CSS !== "undefined" && CSS.escape ? CSS.escape(partnershipId) : String(partnershipId).replace(/"/g, '\\"');
  const card = qs(`[data-partnership-id="${escapedId}"]`);
  if (!card) return;
  const text = qs("[data-partnership-text]", card);
  const button = qs("[data-partnership-read-more]", card);
  if (text && button) {
    text.classList.add("expanded");
    button.hidden = false;
    button.textContent = "عرض أقل";
    button.setAttribute("aria-expanded", "true");
  }
}

function renderPartnershipsAdminPanel() {
  return `
    <section class="data-panel">
      <div class="dashboard-topbar">
        <div><span class="eyebrow">الشراكات</span><h3>إدارة شراكات الموقع</h3></div>
        <button class="btn primary small" id="newPartnershipButton" type="button">إضافة شراكة</button>
      </div>
      <div class="segmented-control" id="partnershipsAdminFilter">
        <button class="btn ${partnershipsAdminFilter === "active" ? "primary" : "ghost"} small" data-partnerships-filter="active" type="button">الشراكات النشطة</button>
        <button class="btn ${partnershipsAdminFilter === "archived" ? "primary" : "ghost"} small" data-partnerships-filter="archived" type="button">المؤرشفة</button>
      </div>
      <div id="partnershipsAdminList">${LoadingState()}</div>
    </section>
  `;
}

async function bindPartnershipsAdminPanel() {
  qs("#newPartnershipButton")?.addEventListener("click", () => openPartnershipForm());
  qsa("[data-partnerships-filter]").forEach((button) => button.addEventListener("click", async () => {
    partnershipsAdminFilter = button.dataset.partnershipsFilter;
    qsa("[data-partnerships-filter]").forEach((item) => {
      item.classList.toggle("primary", item.dataset.partnershipsFilter === partnershipsAdminFilter);
      item.classList.toggle("ghost", item.dataset.partnershipsFilter !== partnershipsAdminFilter);
    });
    await loadPartnershipsAdminList(true);
  }));
  await loadPartnershipsAdminList(false);
}

async function loadPartnershipsAdminList(force = false) {
  const target = qs("#partnershipsAdminList");
  if (!target) return;
  try {
    if (force) target.innerHTML = LoadingState("جاري تحديث الشراكات...");
    const result = await PartnershipsAPI.list(1, 50, partnershipsAdminFilter);
    partnershipsAdminItems = result.items || [];
    if (!partnershipsAdminItems.length) {
      target.innerHTML = partnershipsAdminFilter === "archived"
        ? EmptyState("لا توجد شراكات مؤرشفة حاليًا.", "الشراكات التي يتم إزالتها ستظهر هنا.")
        : EmptyState("لا توجد شراكات حاليًا.", "أضف أول شراكة لتظهر في الموقع بعد نشرها.");
      return;
    }
    const isMobile = window.matchMedia("(max-width: 720px)").matches;
    if (isMobile) {
      target.innerHTML = `
        <div class="updates-admin-mobile-list">
          ${partnershipsAdminItems.map((item) => `
            <article class="updates-admin-mobile-card">
              <h4>${escapeHTML(item.partner_name)}</h4>
              <div class="updates-admin-mobile-meta">
                <span>${escapeHTML(item.title)}</span>
                ${StatusBadge(item.status)}
              </div>
              <span class="muted">${formatDate(item.created_at)}</span>
              <div class="updates-admin-mobile-actions">${renderPartnershipAdminActions(item)}</div>
            </article>
          `).join("")}
        </div>
      `;
    } else {
      target.innerHTML = `
        <div class="table-wrap partnerships-admin-table-wrap">
          <table>
            <thead><tr><th>اسم الشريك</th><th>عنوان الشراكة</th><th>الحالة</th><th>تاريخ الإضافة</th><th>الإجراءات</th></tr></thead>
            <tbody>${partnershipsAdminItems.map((item) => `
              <tr>
                <td data-label="اسم الشريك">${escapeHTML(item.partner_name)}</td>
                <td data-label="عنوان الشراكة">${escapeHTML(item.title)}</td>
                <td data-label="الحالة">${StatusBadge(item.status)}</td>
                <td data-label="تاريخ الإضافة">${formatDate(item.created_at)}</td>
                <td data-label="الإجراءات" class="table-actions horizontal-actions">${renderPartnershipAdminActions(item)}</td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      `;
    }
    bindPartnershipAdminActions();
  } catch (error) {
    target.innerHTML = ErrorState("تعذر تحميل الشراكات الآن.");
  }
}

function renderPartnershipAdminActions(item) {
  if (partnershipsAdminFilter !== "active" || !canManagePartnerships()) return `<span class="muted">-</span>`;
  return `
    <button class="btn secondary small" data-partnership-edit="${escapeHTML(item.id)}" type="button">تعديل</button>
    ${item.status === "published"
      ? `<button class="btn ghost small" data-partnership-unpublish="${escapeHTML(item.id)}" type="button">إخفاء</button>`
      : `<button class="btn primary small" data-partnership-publish="${escapeHTML(item.id)}" type="button">نشر</button>`}
    <button class="btn danger small" data-partnership-archive="${escapeHTML(item.id)}" data-partnership-title="${escapeHTML(item.title)}" type="button">إزالة الشراكة</button>
  `;
}

function bindPartnershipAdminActions() {
  qsa("[data-partnership-edit]").forEach((button) => button.addEventListener("click", () => {
    const item = partnershipsAdminItems.find((partnership) => partnership.id === button.dataset.partnershipEdit);
    if (item) openPartnershipForm(item);
  }));
  qsa("[data-partnership-publish]").forEach((button) => button.addEventListener("click", () => setPartnershipStatus(button, "publish")));
  qsa("[data-partnership-unpublish]").forEach((button) => button.addEventListener("click", () => setPartnershipStatus(button, "unpublish")));
  qsa("[data-partnership-archive]").forEach((button) => button.addEventListener("click", () => openArchivePartnershipModal(button.dataset.partnershipArchive, button.dataset.partnershipTitle)));
}

async function setPartnershipStatus(button, action) {
  const id = button.dataset.partnershipPublish || button.dataset.partnershipUnpublish;
  setButtonLoading(button, true, action === "publish" ? "جاري النشر..." : "جاري الإخفاء...");
  try {
    if (action === "publish") await PartnershipsAPI.publish(id);
    else await PartnershipsAPI.unpublish(id);
    showToast("تم حفظ الشراكة بنجاح", "success");
    await loadPartnershipsAdminList(true);
    await loadPublicPartnerships();
    if (isPartnershipsRoute()) await loadPartnershipsPage({ reset: true });
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(button, false);
  }
}

function openPartnershipForm(partnership = null) {
  const isEdit = Boolean(partnership?.id);
  openModal(`
    <span class="eyebrow">الشراكات</span>
    <h2>${isEdit ? "تعديل شراكة" : "إضافة شراكة"}</h2>
    <form id="partnershipForm" class="form-grid" data-partnership-id="${escapeHTML(partnership?.id || "")}">
      <div class="form-field"><label for="partnershipPartnerName">اسم الشريك</label><input id="partnershipPartnerName" required /></div>
      <div class="form-field"><label for="partnershipTitle">عنوان الشراكة</label><input id="partnershipTitle" required /></div>
      <div class="form-field full"><label for="partnershipShortDescription">الوصف المختصر</label><textarea id="partnershipShortDescription"></textarea></div>
      <div class="form-field full"><label for="partnershipDescription">الوصف الكامل</label><textarea id="partnershipDescription"></textarea></div>
      <div class="form-field full"><label for="partnershipImageUrl">صورة الشراكة / البانر</label><input id="partnershipImageUrl" placeholder="media/partnership-bonyan-abdeljalil.png" /></div>
      <div class="form-field"><label for="partnershipLinkUrl">رابط اختياري</label><input id="partnershipLinkUrl" placeholder="#overview" /></div>
      <div class="form-field"><label for="partnershipStatus">الحالة</label><select id="partnershipStatus"><option value="draft">draft</option><option value="published">published</option><option value="archived">archived</option></select></div>
      <div class="form-field"><label for="partnershipDisplayOrder">ترتيب العرض</label><input id="partnershipDisplayOrder" type="number" step="1" /></div>
      <button class="btn primary full" type="submit">${isEdit ? "حفظ التعديل" : "حفظ الشراكة"}</button>
    </form>
  `);
  qs("#partnershipPartnerName").value = partnership?.partner_name || "";
  qs("#partnershipTitle").value = partnership?.title || "";
  qs("#partnershipShortDescription").value = partnership?.short_description || "";
  qs("#partnershipDescription").value = partnership?.description || "";
  qs("#partnershipImageUrl").value = partnership?.image_url || "";
  qs("#partnershipLinkUrl").value = partnership?.link_url || "";
  qs("#partnershipStatus").value = partnership?.status || "draft";
  qs("#partnershipDisplayOrder").value = partnership?.display_order ?? 0;
  qs("#partnershipForm").addEventListener("submit", savePartnership);
}

async function savePartnership(event) {
  event.preventDefault();
  const form = qs("#partnershipForm");
  const id = form.dataset.partnershipId;
  const submitButton = qs("#partnershipForm button[type='submit']");
  const payload = {
    partner_name: qs("#partnershipPartnerName").value.trim(),
    title: qs("#partnershipTitle").value.trim(),
    short_description: qs("#partnershipShortDescription").value.trim(),
    description: qs("#partnershipDescription").value.trim(),
    image_url: qs("#partnershipImageUrl").value.trim(),
    link_url: qs("#partnershipLinkUrl").value.trim(),
    status: qs("#partnershipStatus").value,
    display_order: Number(qs("#partnershipDisplayOrder").value || 0),
  };
  try {
    setButtonLoading(submitButton, true, "جاري الحفظ...");
    if (id) await PartnershipsAPI.update(id, payload);
    else await PartnershipsAPI.create(payload);
    closeModal();
    showToast("تم حفظ الشراكة بنجاح", "success");
    await loadPartnershipsAdminList(true);
    await loadPublicPartnerships();
    if (isPartnershipsRoute()) await loadPartnershipsPage({ reset: true });
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(submitButton, false);
  }
}

function openArchivePartnershipModal(id, title) {
  openModal(`
    <span class="eyebrow">الشراكات</span>
    <h2>إزالة الشراكة</h2>
    <p>هل أنت متأكد من إزالة هذه الشراكة من الموقع؟</p>
    <p><strong>${escapeHTML(title || "")}</strong></p>
    <div class="form-actions">
      <button class="btn danger" type="button" id="confirmArchivePartnership">إزالة الشراكة</button>
      <button class="btn ghost" type="button" id="cancelArchivePartnership">تراجع</button>
    </div>
  `);
  qs("#cancelArchivePartnership")?.addEventListener("click", closeModal);
  qs("#confirmArchivePartnership")?.addEventListener("click", async (event) => {
    const button = event.currentTarget;
    try {
      setButtonLoading(button, true, "جاري الإزالة...");
      await PartnershipsAPI.archive(id);
      closeModal();
      showToast("تم حفظ الشراكة بنجاح", "success");
      await loadPartnershipsAdminList(true);
      await loadPublicPartnerships();
      if (isPartnershipsRoute()) await loadPartnershipsPage({ reset: true });
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  });
}
