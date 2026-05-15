let updatesAdminFilter = "active";

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
    target.innerHTML = `
      <div class="table-wrap">
        <table>
          <thead><tr><th>العنوان</th><th>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr></thead>
          <tbody>${updates.map((item) => `
            <tr>
              <td>${escapeHTML(item.title)}</td>
              <td>${formatDate(item.update_date)}</td>
              <td>${StatusBadge(item.status)}</td>
              <td class="table-actions">
                ${updatesAdminFilter === "active" ? `
                  ${item.status === "published"
                    ? `<button class="btn ghost small" data-update-unpublish="${item.id}">إلغاء النشر</button>`
                    : `<button class="btn primary small" data-update-publish="${item.id}">نشر</button>`}
                  <button class="btn danger small" data-update-remove="${item.id}" data-update-title="${escapeHTML(item.title)}" type="button">إزالة المنشور</button>
                ` : `<span class="muted">-</span>`}
              </td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
    qsa("[data-update-publish]").forEach((button) => button.addEventListener("click", async () => {
      setButtonLoading(button, true, "جاري النشر...");
      try {
        await UpdatesAPI.publish(button.dataset.updatePublish);
        showToast("تم نشر التحديث بنجاح.", "success");
        await loadUpdatesAdminList(true);
        await initLatestUpdates();
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
        showToast("تم الحفظ بنجاح.", "success");
        await loadUpdatesAdminList(true);
        await initLatestUpdates();
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setButtonLoading(button, false);
      }
    }));
    qsa("[data-update-remove]").forEach((button) => button.addEventListener("click", () => {
      openRemoveUpdateModal(button.dataset.updateRemove, button.dataset.updateTitle);
    }));
  } catch (error) {
    target.innerHTML = ErrorState();
  }
}

function openUpdateForm() {
  openModal(`
    <span class="eyebrow">المنشورات</span>
    <h2>إضافة بوست جديد</h2>
    <form id="updateForm" class="form-grid">
      <div class="form-field"><label for="updateTitle">عنوان البوست</label><input id="updateTitle" required /></div>
      <div class="form-field"><label for="updateDate">تاريخ النشر</label><input id="updateDate" type="date" required /></div>
      <div class="form-field"><label for="updateStage">التصنيف</label><select id="updateStage"><option value="general">عام</option><option value="foundation">الأساسات</option><option value="concrete">الخرسانة</option><option value="walls">المباني</option><option value="finishing">التشطيبات</option></select></div>
      <div class="form-field"><label for="updateStatus">حالة النشر</label><select id="updateStatus"><option value="draft">حفظ كمسودة</option><option value="published">نشر</option></select></div>
      <div class="form-field full"><label for="updateDescription">نص البوست</label><textarea id="updateDescription" required placeholder="اكتب التحديث الذي سيظهر للعملاء والزوار..."></textarea></div>
      <div class="form-field"><label for="updateMediaType">نوع الوسائط</label><select id="updateMediaType"><option value="image">صورة</option><option value="video">فيديو</option></select></div>
      <div class="form-field"><label for="updateFile">صورة/فيديو اختياري</label><input id="updateFile" type="file" accept="image/*,video/*" /></div>
      <button class="btn primary full" type="submit">حفظ البوست</button>
    </form>
  `);
  qs("#updateDate").value = new Date().toISOString().slice(0, 10);
  qs("#updateForm").addEventListener("submit", saveUpdate);
}

async function saveUpdate(event) {
  event.preventDefault();
  const submitButton = qs("#updateForm button[type='submit']");
  try {
    setButtonLoading(submitButton, true, "جاري حفظ المنشور...");
    let mediaUrl = "";
    const status = qs("#updateStatus").value;
    const file = qs("#updateFile").files[0];
    if (file) {
      const upload = await UpdatesAPI.upload(file);
      mediaUrl = upload.url;
    }
    await UpdatesAPI.create({
      title: qs("#updateTitle").value.trim(),
      description: qs("#updateDescription").value.trim(),
      update_date: qs("#updateDate").value,
      stage: qs("#updateStage").value,
      media_type: qs("#updateMediaType").value,
      media_url: mediaUrl,
      status,
    });
    closeModal();
    showToast(status === "published" ? "تم نشر التحديث بنجاح." : "تم الحفظ بنجاح.", "success");
    await loadUpdatesAdminList(true);
    await initLatestUpdates();
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
      await initLatestUpdates();
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setButtonLoading(submitButton, false);
    }
  });
}
