async function initLatestUpdates() {
  const grid = qs("#updatesGrid");
  if (!grid) return;
  grid.innerHTML = LoadingState("جاري تحميل تحديثات المشروع...");
  try {
    const updates = await PublicAPI.publishedUpdates();
    if (!updates.length) {
      grid.innerHTML = EmptyState("لا توجد تحديثات منشورة حاليًا.", "سيتم عرض تحديثات المشروع هنا فور نشرها من الإدارة.");
      return;
    }
    grid.innerHTML = updates.map((update) => `
      <article class="update-card">
        <span class="eyebrow">${formatDate(update.update_date)}</span>
        <h3>${escapeHTML(update.title)}</h3>
        <div class="update-content">
          <p class="update-text">${escapeHTML(update.description)}</p>
          <button type="button" class="btn ghost small read-more-btn mobile-only" onclick="this.previousElementSibling.classList.toggle('expanded'); this.textContent = this.textContent === 'قراءة المزيد' ? 'عرض أقل' : 'قراءة المزيد'">قراءة المزيد</button>
        </div>
        ${update.media_url ? renderUpdateMedia(update) : ""}
      </article>
    `).join("");
  } catch (error) {
    grid.innerHTML = ErrorState();
  }
}

function renderUpdateMedia(update) {
  if (update.media_type === "video") {
    return `<video controls preload="metadata" muted playsinline style="width:100%;border-radius:8px"><source src="${update.media_url}" type="video/mp4" /></video>`;
  }
  return `<img src="${update.media_url}" alt="${escapeHTML(update.title)}" style="width:100%;border-radius:8px" loading="lazy" decoding="async" onerror="this.style.display='none'" />`;
}
