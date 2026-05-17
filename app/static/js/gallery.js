function initGallery() {
  const grid = qs("#galleryGrid");
  if (!grid) return;
  grid.innerHTML = GALLERY_ORDER.map((item, index) => `
    <article class="media-card" data-media-key="${item.key}" tabindex="0">
      ${renderGalleryCardMedia(item, index)}
      <div class="media-card-body">
        <span class="eyebrow">${item.type === "video" ? "فيديو" : "صورة"}</span>
        <h3>${escapeHTML(item.label)}</h3>
      </div>
    </article>
  `).join("");

  qsa("[data-media-key]", grid).forEach((card) => {
    card.addEventListener("click", () => openMedia(card.dataset.mediaKey));
    card.addEventListener("keydown", (event) => {
      if (event.key === "Enter") openMedia(card.dataset.mediaKey);
    });
  });
  qsa("img", grid).forEach((image) => {
    image.addEventListener("error", () => {
      image.replaceWith(mediaFallback(image.alt || "وسائط المشروع"));
    });
  });
}

function renderGalleryCardMedia(item, index) {
  if (item.type === "video") {
    return `
      <div class="media-poster">
        <img src="${escapeHTML(resolveMediaUrl(item.poster))}" alt="${escapeHTML(item.alt || item.label)}" loading="lazy" decoding="async" />
        <span>${escapeHTML(item.label)}</span>
      </div>
    `;
  }
  const loading = index < 2 ? "eager" : "lazy";
  return `<img src="${escapeHTML(resolveMediaUrl(item.thumbSrc || item.src))}" alt="${escapeHTML(item.alt)}" loading="${loading}" decoding="async" />`;
}

function openMedia(key) {
  const item = GALLERY_ORDER.find((media) => media.key === key);
  if (!item) return;
  openModal(`
    <span class="eyebrow">${escapeHTML(item.label)}</span>
    <h2>${escapeHTML(item.title)}</h2>
    ${item.type === "video"
      ? `<video class="update-video modal-media" controls preload="metadata" muted playsinline poster="${escapeHTML(resolveMediaUrl(item.poster))}"><source src="${escapeHTML(resolveMediaUrl(item.src))}" type="${escapeHTML(getVideoMimeType(item.src))}" />متصفحك لا يدعم تشغيل الفيديو.</video><div class="media-error" hidden>تعذر تشغيل الفيديو.</div>`
      : `<img class="update-image modal-media" src="${escapeHTML(resolveMediaUrl(item.src))}" alt="${escapeHTML(item.alt || item.title)}" loading="lazy" decoding="async" />`}
  `);
  const modal = qs("#appModal");
  const media = qs("img, video, source", modal);
  const errorBox = qs(".media-error", modal);
  media?.addEventListener("error", () => {
    if (errorBox) errorBox.hidden = false;
  });
}

function mediaFallback(label) {
  const fallback = document.createElement("div");
  fallback.className = "media-fallback";
  fallback.innerHTML = `<span>${label}</span>`;
  return fallback;
}
