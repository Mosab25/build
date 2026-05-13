function renderUpdatesAdminPanel() {
  return `
    <section class="data-panel">
      <div class="dashboard-topbar">
        <div><span class="eyebrow">المنشورات</span><h3>بوستات وتحديثات المشروع</h3></div>
        <button class="btn primary small" id="newUpdateButton" type="button">إضافة بوست</button>
      </div>
      <div id="updatesAdminList">${LoadingState()}</div>
    </section>
  `;
}

async function bindUpdatesAdminPanel() {
  qs("#newUpdateButton")?.addEventListener("click", openUpdateForm);
  await loadUpdatesAdminList();
}

async function loadUpdatesAdminList() {
  const target = qs("#updatesAdminList");
  try {
    const updates = await UpdatesAPI.list();
    if (!updates.length) {
      target.innerHTML = EmptyState("لا توجد منشورات متاحة حاليًا.", "أضف أول بوست ليظهر في قسم التحديثات بالواجهة العامة.");
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
              <td>
                ${item.status === "published"
                  ? `<button class="btn ghost small" data-update-unpublish="${item.id}">إلغاء النشر</button>`
                  : `<button class="btn primary small" data-update-publish="${item.id}">نشر</button>`}
              </td>
            </tr>
          `).join("")}</tbody>
        </table>
      </div>
    `;
    qsa("[data-update-publish]").forEach((button) => button.addEventListener("click", async () => {
      await UpdatesAPI.publish(button.dataset.updatePublish);
      showToast("تم نشر التحديث بنجاح.", "success");
      await loadUpdatesAdminList();
      await initLatestUpdates();
    }));
    qsa("[data-update-unpublish]").forEach((button) => button.addEventListener("click", async () => {
      await UpdatesAPI.unpublish(button.dataset.updateUnpublish);
      showToast("تم الحفظ بنجاح.", "success");
      await loadUpdatesAdminList();
      await initLatestUpdates();
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
  try {
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
    await loadUpdatesAdminList();
    await initLatestUpdates();
  } catch (error) {
    showToast(error.message, "error");
  }
}
