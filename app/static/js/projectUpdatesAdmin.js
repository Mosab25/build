let updatesAdminFilter = "active";
let updatesAdminItems = [];

function canManageProjectUpdates() {
  return ["owner", "admin"].includes(APP_STATE.session?.role);
}

function detectUpdateFileType(file) {
  const mime = (file?.type || "").toLowerCase();
  const name = (file?.name || "").toLowerCase();
  if (mime.startsWith("video/") || /\.(mp4|webm)$/.test(name)) return "video";
  if (mime.startsWith("image/") || /\.(jpe?g|png|webp)$/.test(name)) return "image";
  return "";
}

function refreshPublicUpdatesSafe() {
  if (typeof refreshLatestUpdates === "function") return refreshLatestUpdates();
  if (typeof initLatestUpdates === "function") return initLatestUpdates();
  return Promise.resolve();
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
        ${canManageProjectUpdates() ? `<button class="btn primary small" id="newUpdateButton" type="button">إضافة بوست</button>` : ""}
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
  qs("#newUpdateButton")?.addEventListener("click", () => openUpdateForm());
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

function bindUpdateAdminActions() {
  qsa("[data-update-edit]").forEach((button) => button.addEventListener("click", () => {
    const item = updatesAdminItems.find((update) => update.id === button.dataset.updateEdit);
    if (item) openUpdateForm(item);
  }));

  qsa("[data-update-publish]").forEach((button) => button.addEventListener("click", async () => {
    setButtonLoading(button, true, "جاري النشر...");
    try {
      await UpdatesAPI.publish(button.dataset.updatePublish);
      showToast("تم نشر التحديث بنجاح.", "success");
      await loadUpdatesAdminList(true);
      await refreshPublicUpdatesSafe();
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
      await refreshPublicUpdatesSafe();
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
    updatesAdminItems = updates;

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
              <h4>${escapeHTML(item.title)}</h4>
              <div class="updates-admin-mobile-meta">
                <span>${formatDate(item.update_date)}</span>
                ${StatusBadge(item.status)}
              </div>
              <div class="updates-admin-mobile-actions">
                ${renderUpdateActionButtons(item)}
              </div>
            </article>
          `).join("")}
        </div>
      `;
    } else {
      target.innerHTML = `
        <div class="table-wrap updates-admin-table-wrap">
          <table>
            <thead><tr><th>العنوان</th><th>التاريخ</th><th>الحالة</th><th>الإجراءات</th></tr></thead>
            <tbody>${updates.map((item) => `
              <tr>
                <td data-label="العنوان">${escapeHTML(item.title)}</td>
                <td data-label="التاريخ">${formatDate(item.update_date)}</td>
                <td data-label="الحالة">${StatusBadge(item.status)}</td>
                <td data-label="الإجراءات" class="table-actions horizontal-actions">
                  ${renderUpdateActionButtons(item)}
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

function renderUpdateActionButtons(item) {
  if (updatesAdminFilter !== "active" || !canManageProjectUpdates()) {
    return `<span class="muted">-</span>`;
  }
  return `
    <button class="btn secondary small" data-update-edit="${escapeHTML(item.id)}" type="button">تعديل</button>
    ${item.status === "published"
      ? `<button class="btn ghost small" data-update-unpublish="${escapeHTML(item.id)}" type="button">إلغاء النشر</button>`
      : `<button class="btn primary small" data-update-publish="${escapeHTML(item.id)}" type="button">نشر</button>`}
    <button class="btn danger small" data-update-remove="${escapeHTML(item.id)}" data-update-title="${escapeHTML(item.title)}" type="button">إزالة المنشور</button>
  `;
}

function openUpdateForm(update = null) {
  const isEdit = Boolean(update?.id);
  openModal(`
    <span class="eyebrow">المنشورات</span>
    <h2>${isEdit ? "تعديل المنشور" : "إضافة بوست جديد"}</h2>
    <form id="updateForm" class="form-grid" data-update-id="${escapeHTML(update?.id || "")}">
      <div class="form-field"><label for="updateTitle">عنوان البوست</label><input id="updateTitle" required /></div>
      <div class="form-field"><label for="updateDate">تاريخ النشر</label><input id="updateDate" type="date" required /></div>
      <div class="form-field"><label for="updateProject">المشروع</label><select id="updateProject"><option value="">عقار في أرض عبدالجليل</option></select></div>
      <div class="form-field"><label for="updateStage">التصنيف</label><select id="updateStage"><option value="general">عام</option><option value="foundation">الأساسات</option><option value="concrete">الخرسانة</option><option value="walls">المباني</option><option value="finishing">التشطيبات</option><option value="exterior">الواجهات</option><option value="delivery">التسليم</option></select></div>
      <div class="form-field"><label for="updateStatus">حالة النشر</label><select id="updateStatus"><option value="draft">مسودة</option><option value="published">منشور</option></select></div>
      <div class="form-field full"><label for="updateDescription">نص البوست</label><textarea id="updateDescription" required placeholder="اكتب التحديث الذي سيظهر للعملاء والزوار..."></textarea></div>
      <div class="form-field"><label for="updateMediaType">نوع الوسائط</label><select id="updateMediaType"><option value="image">صورة</option><option value="video">فيديو</option></select></div>
      <div class="form-field"><label for="updateFile">${isEdit ? "استبدال الصورة/الفيديو اختياري" : "صورة/فيديو اختياري"}</label><input id="updateFile" type="file" accept=".jpg,.jpeg,.png,.webp,.mp4,.webm,image/jpeg,image/png,image/webp,video/mp4,video/webm" /></div>
      <div class="form-field full"><div id="updateUploadStatus" class="upload-status">لم يتم اختيار ملف.</div><div id="updateMediaPreview" class="update-form-preview" hidden></div></div>
      <button class="btn primary full" type="submit">${isEdit ? "حفظ التعديل" : "حفظ البوست"}</button>
    </form>
  `);

  qs("#updateDate").value = update?.update_date || new Date().toISOString().slice(0, 10);
  qs("#updateTitle").value = update?.title || "";
  qs("#updateDescription").value = update?.description || "";
  qs("#updateStage").value = update?.stage || "general";
  qs("#updateStatus").value = update?.status || "draft";
  qs("#updateMediaType").value = update?.media_type || "image";
  populateUpdateProjectOptions(update);
  renderExistingUpdatePreview(update);
  qs("#updateFile")?.addEventListener("change", handleUpdateFileSelection);
  qs("#updateForm").addEventListener("submit", saveUpdate);
}

async function populateUpdateProjectOptions(update = null) {
  const select = qs("#updateProject");
  if (!select) return;
  try {
    if (!isDashboardLoaded("projects")) {
      const result = await AdminAPI.projects(1, 100, "active");
      cacheDashboardData("projects", result.items || [], cacheListMeta(result));
    }
    const projects = APP_STATE.dashboard?.projects || [];
    select.innerHTML = projects.map((project) => `
      <option value="${escapeHTML(project.id)}">${escapeHTML(project.name)}</option>
    `).join("") || `<option value="">عقار في أرض عبدالجليل</option>`;
    const selectedProject = update?.project_id || update?.projectId || projects.find((project) => project.slug === "abd-elgalil")?.id || "";
    select.value = selectedProject;
  } catch (error) {
    select.innerHTML = `<option value="">عقار في أرض عبدالجليل</option>`;
  }
}

function renderExistingUpdatePreview(update) {
  const status = qs("#updateUploadStatus");
  const preview = qs("#updateMediaPreview");
  const url = resolveMediaUrl(update?.media_url);
  if (!url) {
    status.textContent = "لم يتم اختيار ملف.";
    return;
  }
  status.textContent = "الوسائط الحالية محفوظة. اختر ملفًا جديدًا إذا أردت استبدالها.";
  preview.hidden = false;
  preview.innerHTML = update.media_type === "video"
    ? `<video controls muted playsinline preload="metadata" src="${escapeHTML(url)}"></video>`
    : `<img src="${escapeHTML(url)}" alt="معاينة الوسائط الحالية" loading="lazy" decoding="async" />`;
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
  const form = qs("#updateForm");
  const updateId = form.dataset.updateId;
  const isEdit = Boolean(updateId);
  const existing = isEdit ? updatesAdminItems.find((item) => item.id === updateId) : null;
  const submitButton = qs("#updateForm button[type='submit']");
  try {
    setButtonLoading(submitButton, true, isEdit ? "جاري حفظ التعديل..." : "جاري حفظ المنشور...");
    let mediaUrl = existing?.media_url || "";
    let mediaType = qs("#updateMediaType").value || existing?.media_type || "image";
    let mimeType = existing?.mimeType || "";
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

    const payload = {
      title: qs("#updateTitle").value.trim(),
      description: qs("#updateDescription").value.trim(),
      update_date: qs("#updateDate").value,
      stage: qs("#updateStage").value,
      media_type: mediaType,
      media_url: mediaUrl,
      mimeType,
      status,
      project_id: qs("#updateProject")?.value || undefined,
    };

    if (isEdit) {
      await UpdatesAPI.update(updateId, payload);
    } else {
      await UpdatesAPI.create(payload);
    }

    closeModal();
    showToast(isEdit ? "تم تعديل المنشور بنجاح" : (status === "published" ? "تم نشر التحديث بنجاح." : "تم الحفظ بنجاح."), "success");
    await loadUpdatesAdminList(true);
    await refreshPublicUpdatesSafe();
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    setButtonLoading(submitButton, false);
  }
}

function removeUpdateFromActiveCache(updateId) {
  const cachedUpdates = (APP_STATE.dashboard?.updates || []).filter((item) => item.id !== updateId);
  cacheDashboardData("updates", cachedUpdates, APP_STATE.dashboard?.updatesPagination || APP_STATE.cache?.updatesMeta || null);
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
      await refreshPublicUpdatesSafe();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}
