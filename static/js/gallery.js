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
}

function renderGalleryCardMedia(item, index) {
  if (item.type === "video") {
    return `<div class="media-fallback media-poster" style="background-image:url('${item.poster}')"><span>${escapeHTML(item.label)}</span></div>`;
  }
  const loading = index < 2 ? "eager" : "lazy";
  return `<img src="${item.thumbSrc || item.src}" alt="${escapeHTML(item.alt)}" loading="${loading}" decoding="async" onerror="this.replaceWith(mediaFallback('${escapeHTML(item.label)}'))" />`;
}

function openMedia(key) {
  const item = GALLERY_ORDER.find((media) => media.key === key);
  if (!item) return;
  openModal(`
    <span class="eyebrow">${escapeHTML(item.label)}</span>
    <h2>${escapeHTML(item.title)}</h2>
    ${item.type === "video"
      ? `<video controls preload="metadata" muted playsinline poster="${item.poster}" style="width:100%;border-radius:8px;background:#000"><source src="${item.src}" type="video/mp4" /></video>`
      : `<img src="${item.src}" alt="${escapeHTML(item.alt || item.title)}" style="width:100%;border-radius:8px" loading="lazy" decoding="async" onerror="this.replaceWith(mediaFallback('${escapeHTML(item.label)}'))" />`}
  `);
}

function mediaFallback(label) {
  const fallback = document.createElement("div");
  fallback.className = "media-fallback";
  fallback.innerHTML = `<span>${label}</span>`;
  return fallback;
}
