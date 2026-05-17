let updatesAdminFilter = "active";

function detectUpdateFileType(file) {
  const mime = (file?.type || "").toLowerCase();
  const name = (file?.name || "").toLowerCase();
  if (mime.startsWith("video/") || /\.(mp4|webm)$/.test(name)) return "video";
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(name)) return "image";
  return "";
}

function renderAdminUpdateMedia(item) {
  const url = resolveMediaUrl(item.media_url);
  if (!url) return `<span class="muted">بدون وسائط</span>`;
  if (item.media_type === "video") {
    return `
      <div class="admin-update-media">
        <video preload="metadata" muted playsinline poster="${escapeHTML(resolveMediaUrl(item.thumbnail_url || "media/optimized/facade-thumb.webp"))}">
          <source src="${escapeHTML(url)}" type="${escapeHTML(getVideoMimeType(url, item.mimeType))}">
        </video>
        <span>فيديو</span>
      </div>
    `;
  }
  return `
    <div class="admin-update-media">
      <img src="${escapeHTML(url)}" alt="${escapeHTML(item.title || "وسائط التحديث")}" loading="lazy" decoding="async" />
      <span>صورة</span>
    </div>
  `;
}

function renderUpdatesAdminPanel() {
  return `
    <section class="data-panel">
      <div class="dashboard-topbar">
        <div><span class="eyebrow">المنشورات</span><h3>بوستات وتحديثات المشروع</h3></div>
        <button class="btn primary small" id="newUpdateButton" type="button">إضافة بوست</button>
      </div>
      <div class="segmented-control" id="updatesAdminFilter">
        <button class="btn ${updatesAdminFilter === "active" ? "primary" : "ghost"} small" data-updates-filter="active" type="button">المنشورات النشطة</button>
        <button class="btn ${updatesAdminFilter === "archived" ? "primary" : "ghost"} small" data-updates-filter="archived" type="button">المؤرشفة</button>
      </div>
      <div id="updatesAdminList">${LoadingState()}</div>
    </section>
  `;
}

async function bindUpdatesAdminPanel() {
  qs("#newUpdateButton")?.addEventListener("click", openUpdateForm);
  qsa("[data-updates-filter]").forEach((button) => button.addEventListener("click", async () => {
    updatesAdminFilter = button.dataset.updatesFilter;
    qsa("[data-updates-filter]").forEach((item) => {
      item.classList.toggle("primary", item.dataset.updatesFilter === updatesAdminFilter);
      item.classList.toggle("ghost", item.dataset.updatesFilter !== updatesAdminFilter);
    });
    await loadUpdatesAdminList(true);
  }));
  await loadUpdatesAdminList(false);
}

async function loadUpdatesAdminList(force = false) {
  const target = qs("#updatesAdminList");
  try {
    if (force) {
      target.innerHTML = LoadingState("جاري تحديث المنشورات...");
    }
    if (force && updatesAdminFilter === "active") invalidateDashboardCache(["updates"]);
    if (updatesAdminFilter === "active" && !isDashboardLoaded("updates")) {
      await ensureDashboardData(["updates"], APP_STATE.activeDashboardView);
    }
    const result = updatesAdminFilter === "active" && !force
      ? { items: APP_STATE.cache.updates || APP_STATE.dashboard?.updates || [] }
      : await UpdatesAPI.list(1, 20, updatesAdminFilter);
    const updates = (result.items || []).filter((item) => {
      if (updatesAdminFilter === "archived") return item.status === "archived";
      return item.status === "published" || item.status === "draft";
    });
    if (updatesAdminFilter === "active" && force) {
      cacheDashboardData("updates", updates, cacheListMeta(result));
    }
    if (!updates.length) {
      target.innerHTML = updatesAdminFilter === "archived"
        ? EmptyState("لا توجد منشورات مؤرشفة حاليًا.", "المنشورات التي يتم إزالتها ستظهر هنا فقط.")
        : EmptyState("لا توجد منشورات متاحة حاليًا.", "أضف أول بوست ليظهر في قسم التحديثات بالواجهة العامة.");
      return;
    }
    const isMobile = window.matchMedia("(max-width: 720px)").matches;
    if (isMobile) {
      target.innerHTML = `
        <div class="updates-admin-mobile-list">
          ${updates.map((item) => `
            <article class="updates-admin-mobile-card">
              <div class="updates-admin-mobile-media">${renderAdminUpdateMedia(item)}</div>
              <h4>${escapeHTML(item.title)}</h4>
              <div class="updates-admin-mobile-meta">
                <span>${formatDate(item.update_date)}</span>
                ${StatusBadge(item.status)}
              </div>
              <div class="updates-admin-mobile-actions">
                ${updatesAdminFilter === "active" ? `
                  ${item.status === "published"
                    ? `<button class="btn ghost small" data-update-unpublish="${item.id}">????? ?????</button>`
                    : `<button class="btn primary small" data-update-publish="${item.id}">???</button>`}
                  <button class="btn danger small" data-update-remove="${item.id}" data-update-title="${escapeHTML(item.title)}" type="button">????? ???????</button>
                ` : `<span class="muted">-</span>`}
              </div>
            </article>
          `).join("")}
        </div>
      `;
    } else {
      target.innerHTML = `
        <div class="table-wrap updates-admin-table-wrap">
          <table>
            <thead><tr><th>??????????????</th><th>??????????????</th><th>??????????????</th><th>????????????</th><th>??????????????</th></tr></thead>
            <tbody>${updates.map((item) => `
              <tr>
                <td data-label="??????????????">${renderAdminUpdateMedia(item)}</td>
                <td data-label="??????????????">${escapeHTML(item.title)}</td>
                <td data-label="??????????????">${formatDate(item.update_date)}</td>
                <td data-label="????????????">${StatusBadge(item.status)}</td>
                <td class="table-actions">
                  ${updatesAdminFilter === "active" ? `
                    ${item.status === "published"
                      ? `<button class="btn ghost small" data-update-unpublish="${item.id}">?????????? ??????????</button>`
                      : `<button class="btn primary small" data-update-publish="${item.id}">??????</button>`}
                    <button class="btn danger small" data-update-remove="${item.id}" data-update-title="${escapeHTML(item.title)}" type="button">?????????? ??????????????</button>
                  ` : `<span class="muted">-</span>`}
                </td>
              </tr>
            `).join("")}</tbody>
          </table>
        </div>
      `;
    }
    bindUpdateAdminActions();
  } catch (error) {
    target.innerHTML = ErrorState();
  }
}

function bindUpdateAdminActions() {
  qsa("[data-update-publish]").forEach((button) => button.addEventListener("click", async () => {
    setButtonLoading(button, true, "جاري النشر...");
    try {
      await UpdatesAPI.publish(button.dataset.updatePublish);
      showToast("تم نشر التحديث بنجاح.", "success");
      await loadUpdatesAdminList(true);
      await refreshLatestUpdates();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }));
  qsa("[data-update-unpublish]").forEach((button) => button.addEventListener("click", async () => {
    setButtonLoading(button, true, "جاري إلغاء النشر...");
    try {
      await UpdatesAPI.unpublish(button.dataset.updateUnpublish);
      showToast("تم إلغاء النشر بنجاح.", "success");
      await loadUpdatesAdminList(true);
      await refreshLatestUpdates();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(button, false);
    }
  }));
  qsa("[data-update-remove]").forEach((button) => button.addEventListener("click", () => {
    openRemoveUpdateModal(button.dataset.updateRemove, button.dataset.updateTitle);
  }));
}

function openUpdateForm() {
  openModal(`
    <span class="eyebrow">المنشورات</span>
    <h2>إضافة بوست جديد</h2>
    <form id="updateForm" class="form-grid">
      <div class="form-field"><label for="updateTitle">عنوان البوست</label><input id="updateTitle" required /></div>
      <div class="form-field"><label for="updateDate">تاريخ النشر</label><input id="updateDate" type="date" required /></div>
      <div class="form-field"><label for="updateStage">التصنيف</label><select id="updateStage"><option value="general">عام</option><option value="foundation">الأساسات</option><option value="concrete">الخرسانة</option><option value="walls">المباني</option><option value="finishing">التشطيبات</option><option value="exterior">الواجهات</option><option value="delivery">التسليم</option></select></div>
      <div class="form-field"><label for="updateStatus">حالة النشر</label><select id="updateStatus"><option value="draft">حفظ كمسودة</option><option value="published">نشر</option></select></div>
      <div class="form-field full"><label for="updateDescription">نص البوست</label><textarea id="updateDescription" required placeholder="اكتب التحديث الذي سيظهر للعملاء والزوار..."></textarea></div>
      <div class="form-field"><label for="updateMediaType">نوع الوسائط</label><select id="updateMediaType"><option value="image">صورة</option><option value="video">فيديو</option></select></div>
      <div class="form-field"><label for="updateFile">صورة/فيديو اختياري</label><input id="updateFile" type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,image/jpeg,image/png,image/webp,video/mp4,video/webm" /></div>
      <div class="form-field full"><div id="updateUploadStatus" class="upload-status">لم يتم اختيار ملف.</div><div id="updateMediaPreview" class="update-form-preview" hidden></div></div>
      <button class="btn primary full" type="submit">حفظ البوست</button>
    </form>
  `);
  qs("#updateDate").value = new Date().toISOString().slice(0, 10);
  qs("#updateFile").addEventListener("change", handleUpdateFileSelection);
  qs("#updateForm").addEventListener("submit", saveUpdate);
}

function handleUpdateFileSelection(event) {
  const file = event.target.files[0];
  const status = qs("#updateUploadStatus");
  const preview = qs("#updateMediaPreview");
  preview.hidden = true;
  preview.innerHTML = "";
  if (!file) {
    status.textContent = "لم يتم اختيار ملف.";
    return;
  }
  const type = detectUpdateFileType(file);
  if (!type) {
    status.textContent = "صيغة الملف غير مدعومة. استخدم صورة jpg/png/webp أو فيديو mp4/webm.";
    return;
  }
  qs("#updateMediaType").value = type;
  const objectUrl = URL.createObjectURL(file);
  status.textContent = `${type === "video" ? "فيديو" : "صورة"} جاهز للرفع: ${file.name}`;
  preview.hidden = false;
  preview.innerHTML = type === "video"
    ? `<video controls muted playsinline preload="metadata" src="${objectUrl}"></video>`
    : `<img src="${objectUrl}" alt="معاينة الملف" />`;
}

async function saveUpdate(event) {
  event.preventDefault();
  const submitButton = qs("#updateForm button[type='submit']");
  try {
    setButtonLoading(submitButton, true, "جاري حفظ المنشور...");
    let mediaUrl = "";
    let mediaType = qs("#updateMediaType").value;
    let mimeType = "";
    const status = qs("#updateStatus").value;
    const file = qs("#updateFile").files[0];
    if (file) {
      const detectedType = detectUpdateFileType(file);
      if (!detectedType) {
        throw new Error("صيغة الملف غير مدعومة. استخدم صورة jpg/png/webp أو فيديو mp4/webm.");
      }
      qs("#updateUploadStatus").textContent = "جاري رفع الملف...";
      setButtonLoading(submitButton, true, "جاري رفع الوسائط...");
      const upload = await UpdatesAPI.upload(file);
      mediaUrl = upload.url;
      mediaType = upload.mediaType || detectedType;
      mimeType = upload.mimeType || file.type || "";
      qs("#updateMediaType").value = mediaType;
      qs("#updateUploadStatus").textContent = `تم رفع ${mediaType === "video" ? "الفيديو" : "الصورة"} بنجاح.`;
    }
    await UpdatesAPI.create({
      title: qs("#updateTitle").value.trim(),
      description: qs("#updateDescription").value.trim(),
      update_date: qs("#updateDate").value,
      stage: qs("#updateStage").value,
      media_type: mediaType,
      media_url: mediaUrl,
      mimeType,
      status,
    });
    closeModal();
    showToast(status === "published" ? "تم نشر التحديث بنجاح." : "تم الحفظ بنجاح.", "success");
    await loadUpdatesAdminList(true);
    await refreshLatestUpdates();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(submitButton, false);
  }
}

function removeUpdateFromActiveCache(updateId) {
  const cachedUpdates = (APP_STATE.dashboard?.updates || []).filter((item) => item.id !== updateId);
  cacheDashboardData("updates", cachedUpdates, APP_STATE.dashboard?.updatesPagination || APP_STATE.cache?.updatesMeta || null);
  qsa("[data-update-remove]").find((button) => button.dataset.updateRemove === updateId)?.closest("tr")?.remove();
}

function openRemoveUpdateModal(updateId, updateTitle) {
  openModal(`
    <span class="eyebrow">المنشورات</span>
    <h2>إزالة المنشور</h2>
    <p>هل أنت متأكد من إزالة هذا المنشور؟ لن يظهر للعملاء بعد الإزالة.</p>
    <p><strong>العنوان:</strong> ${escapeHTML(updateTitle)}</p>
    <form id="removeUpdateForm" class="form-grid">
      <div class="form-field full">
        <label for="removeReason">سبب الإزالة (اختياري)</label>
        <textarea id="removeReason" placeholder="اكتب سبب الإزالة إن وجد..."></textarea>
      </div>
      <button class="btn danger full" type="submit">تأكيد الإزالة</button>
      <button class="btn ghost full" type="button" id="cancelRemoveBtn">تراجع</button>
    </form>
  `);

  qs("#cancelRemoveBtn")?.addEventListener("click", closeModal);

  qs("#removeUpdateForm")?.addEventListener("submit", async (event) => {
    event.preventDefault();
    const reason = qs("#removeReason").value.trim();
    const submitButton = qs("#removeUpdateForm button[type='submit']");
    try {
      setButtonLoading(submitButton, true, "جاري الإزالة...");
      await UpdatesAPI.remove(updateId, { reason });
      removeUpdateFromActiveCache(updateId);
      closeModal();
      showToast("تم إزالة المنشور بنجاح", "success");
      await loadUpdatesAdminList(true);
      await refreshLatestUpdates();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}
