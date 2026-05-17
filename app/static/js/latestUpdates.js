const UPDATE_STAGE_LABELS = {
  general: "عام",
  foundation: "الأساسات",
  concrete: "الخرسانة",
  walls: "المباني",
  finishing: "التشطيبات",
  exterior: "الواجهات",
  delivery: "التسليم",
};

function updatesLoadingState() {
  return Array.from({ length: 3 }, () => `
    <article class="update-card update-card-skeleton" aria-hidden="true">
      <div class="skeleton-block skeleton-media"></div>
      <div class="skeleton-line short"></div>
      <div class="skeleton-line"></div>
      <div class="skeleton-line"></div>
    </article>
  `).join("");
}

async function initLatestUpdates() {
  const grid = qs("#updatesGrid");
  if (!grid) return;
  grid.innerHTML = updatesLoadingState();
  scheduleAfterFirstPaint(loadLatestUpdates);
}

async function loadLatestUpdates() {
  const grid = qs("#updatesGrid");
  if (!grid) return;
  try {
    const updates = await PublicAPI.publishedUpdates();
    if (!updates.length) {
      renderUpdatesFallback(grid);
      return;
    }
    grid.innerHTML = updates.map(renderUpdateCard).join("");
    bindUpdateCards(grid);
  } catch (error) {
    grid.innerHTML = ErrorState("تعذر تحميل تحديثات المشروع الآن.", "ستظهر التحديثات تلقائيًا عند عودة الاتصال.");
  }
}

function refreshLatestUpdates() {
  return loadLatestUpdates();
}

function renderUpdatesFallback(grid) {
  grid.innerHTML = EmptyState("لا توجد تحديثات منشورة حاليًا.", "سيتم عرض تحديثات المشروع هنا فور نشرها من الإدارة.");
}

function renderUpdateCard(update) {
  const stage = UPDATE_STAGE_LABELS[update.stage] || update.stage || "عام";
  const description = plainUpdateText(update.description);
  return `
    <article class="update-card" data-update-card>
      ${renderUpdateMedia(update)}
      <div class="update-card-body">
        <div class="update-meta">
          <span class="update-stage-badge">${escapeHTML(stage)}</span>
          <time datetime="${escapeHTML(update.update_date || "")}">${formatDate(update.update_date)}</time>
        </div>
        <h3>${escapeHTML(update.title)}</h3>
        <div class="update-content">
          <p class="update-text" data-update-text>${escapeHTML(description)}</p>
          <button type="button" class="read-more-btn" data-read-more hidden aria-expanded="false">قراءة المزيد</button>
        </div>
      </div>
    </article>
  `;
}

function plainUpdateText(value) {
  return String(value || "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/__(.*?)__/g, "$1")
    .replace(/^\s*[-*]\s+/gm, "")
    .trim();
}

function resolveMediaUrl(url) {
  const value = String(url || "").trim();
  if (!value) return "";
  if (/^(https?:)?\/\//i.test(value) || value.startsWith("data:") || value.startsWith("blob:")) {
    return value;
  }
  return `/${value.replace(/^\/+/, "")}`;
}

function getVideoMimeType(url, fallbackMime) {
  const fallback = fallbackMime || "";
  const cleanUrl = String(url || "").split("?")[0].split("#")[0].toLowerCase();
  if (cleanUrl.endsWith(".mp4")) return "video/mp4";
  if (cleanUrl.endsWith(".webm")) return "video/webm";
  if (cleanUrl.endsWith(".mov")) return "video/quicktime";
  return fallback.startsWith("video/") ? fallback : "video/mp4";
}

function renderUpdateMedia(update) {
  const src = resolveMediaUrl(update.media_url);
  if (!src) return "";
  const title = update.title || "تحديث المشروع";
  const poster = resolveMediaUrl(update.thumbnail_url || "media/optimized/facade-thumb.webp");
  const mediaType = update.media_type === "video" ? "video" : "image";

  if (mediaType === "video") {
    return `
      <div class="update-media" data-update-media>
        <video class="update-video" controls preload="metadata" playsinline poster="${escapeHTML(poster)}">
          <source src="${escapeHTML(src)}" type="${escapeHTML(getVideoMimeType(src, update.mimeType))}">
          متصفحك لا يدعم تشغيل الفيديو.
        </video>
        <button type="button" class="media-open-btn" data-media-open data-media-type="video" data-media-src="${escapeHTML(src)}" data-media-poster="${escapeHTML(poster)}" data-media-title="${escapeHTML(title)}">فتح</button>
        <div class="media-error" hidden>تعذر تحميل الفيديو. جرّب فتحه في نافذة مستقلة أو أعد رفعه بصيغة mp4 أو webm.</div>
      </div>
    `;
  }

  return `
    <div class="update-media" data-update-media>
      <img class="update-image" src="${escapeHTML(src)}" alt="${escapeHTML(title)}" loading="lazy" decoding="async" />
      <button type="button" class="media-open-btn" data-media-open data-media-type="image" data-media-src="${escapeHTML(src)}" data-media-title="${escapeHTML(title)}">فتح</button>
      <div class="media-error" hidden>تعذر تحميل الصورة.</div>
    </div>
  `;
}

function bindUpdateCards(scope = document) {
  window.requestAnimationFrame(() => updateReadMoreVisibility(scope));

  const bindTarget = scope.dataset ? scope : document;
  if (!bindTarget.dataset?.updateCardsBound) {
    if (bindTarget.dataset) bindTarget.dataset.updateCardsBound = "true";
    bindTarget.addEventListener("click", (event) => {
      const readMoreButton = event.target.closest("[data-read-more]");
      if (readMoreButton) {
        const card = readMoreButton.closest("[data-update-card]");
        const text = qs("[data-update-text]", card);
        if (!text) return;
        const expanded = text.classList.toggle("expanded");
        readMoreButton.textContent = expanded ? "عرض أقل" : "قراءة المزيد";
        readMoreButton.setAttribute("aria-expanded", String(expanded));
        return;
      }

      const mediaButton = event.target.closest("[data-media-open]");
      if (!mediaButton) return;
      const src = mediaButton.dataset.mediaSrc;
      const title = mediaButton.dataset.mediaTitle || "وسائط التحديث";
      if (!src) return;
      if (mediaButton.dataset.mediaType === "video") {
        const poster = mediaButton.dataset.mediaPoster || "";
        openModal(`
          <span class="eyebrow">وسائط التحديث</span>
          <h2>${escapeHTML(title)}</h2>
          <video class="update-video modal-media" controls preload="metadata" playsinline autoplay poster="${escapeHTML(poster)}">
            <source src="${escapeHTML(src)}" type="${escapeHTML(getVideoMimeType(src))}">
            متصفحك لا يدعم تشغيل الفيديو.
          </video>
        `);
        return;
      }
      openModal(`
        <span class="eyebrow">وسائط التحديث</span>
        <h2>${escapeHTML(title)}</h2>
        <img class="update-image modal-media" src="${escapeHTML(src)}" alt="${escapeHTML(title)}" loading="lazy" decoding="async" />
      `);
    });
  }

  qsa("[data-update-media]", scope).forEach((media) => {
    const errorBox = qs(".media-error", media);
    qsa("img, video, source", media).forEach((element) => {
      element.addEventListener("error", () => {
        if (errorBox) errorBox.hidden = false;
        media.classList.add("has-media-error");
      });
    });
  });
}

function updateReadMoreVisibility(scope = document) {
  qsa("[data-update-card]", scope).forEach((card) => {
    const text = qs("[data-update-text]", card);
    const button = qs("[data-read-more]", card);
    if (!text || !button) return;
    const wasExpanded = text.classList.contains("expanded");
    if (wasExpanded) text.classList.remove("expanded");
    const isOverflowing = text.scrollHeight > text.clientHeight + 2;
    button.hidden = !isOverflowing;
    if (wasExpanded && isOverflowing) text.classList.add("expanded");
    if (!isOverflowing) {
      text.classList.remove("expanded");
      button.textContent = "قراءة المزيد";
      button.setAttribute("aria-expanded", "false");
    }
  });
}

let updateResizeTimer = null;
window.addEventListener("resize", () => {
  window.clearTimeout(updateResizeTimer);
  updateResizeTimer = window.setTimeout(() => updateReadMoreVisibility(qs("#updatesGrid") || document), 120);
});
