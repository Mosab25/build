function initGallery() {
  const grid = qs("#galleryGrid");
  if (!grid) return;
  grid.innerHTML = GALLERY_ORDER.map((item) => `
    <article class="media-card" data-media-key="${item.key}" tabindex="0">
      ${item.type === "video"
        ? `<video poster="${item.poster}" preload="metadata" muted playsinline><source src="${item.src}" type="video/mp4" /></video>`
        : `<img src="${item.src}" alt="${escapeHTML(item.alt)}" loading="lazy" decoding="async" />`}
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

function openMedia(key) {
  const item = GALLERY_ORDER.find((media) => media.key === key);
  if (!item) return;
  openModal(`
    <span class="eyebrow">${escapeHTML(item.label)}</span>
    <h2>${escapeHTML(item.title)}</h2>
    ${item.type === "video"
      ? `<video controls preload="metadata" muted playsinline poster="${item.poster}" style="width:100%;border-radius:8px;background:#000"><source src="${item.src}" type="video/mp4" /></video>`
      : `<img src="${item.src}" alt="${escapeHTML(item.alt || item.title)}" style="width:100%;border-radius:8px" loading="lazy" decoding="async" />`}
  `);
}
