function renderSettingsPanel() {
  const settings = APP_STATE.dashboard.settings || {};
  const homepage = settings.homepageContent || {};
  const profile = APP_STATE.session || {};
  return `
    <section class="data-panel">
      <span class="eyebrow">إعدادات النظام</span>
      <h3>بيانات المكتب والإيصالات</h3>
      <form id="settingsForm" class="form-grid">
        <div class="form-field"><label for="officeName">اسم المكتب</label><input id="officeName" value="${escapeHTML(settings.office_name || "")}" /></div>
        <div class="form-field"><label for="officePhone">رقم الهاتف</label><input id="officePhone" value="${escapeHTML(settings.office_phone || "")}" /></div>
        <div class="form-field"><label for="whatsappNumber">رقم واتساب</label><input id="whatsappNumber" value="${escapeHTML(settings.whatsapp_number || "")}" /></div>
        <div class="form-field"><label for="currency">العملة</label><input id="currency" value="${escapeHTML(settings.currency || "EGP")}" /></div>
        <div class="form-field"><label for="receiptPrefix">بادئة رقم الإيصال</label><input id="receiptPrefix" value="${escapeHTML(settings.receipt_prefix || "RCPT")}" /></div>
        <div class="form-field full"><label for="officeAddress">العنوان</label><textarea id="officeAddress">${escapeHTML(settings.office_address || "")}</textarea></div>
        <div class="form-field full"><label for="statementFooter">نص أسفل الإيصال</label><textarea id="statementFooter">${escapeHTML(settings.statement_footer || "")}</textarea></div>
        <button class="btn primary full" type="submit">حفظ الإعدادات</button>
      </form>
    </section>
    <section class="data-panel">
      <span class="eyebrow">الصفحة الرئيسية</span>
      <h3>تعديل أقسام عن بنيان وبيانات المشروع والمعرض</h3>
      <form id="homepageSectionsForm" class="form-grid">
        <div class="form-field"><label for="aboutEyebrow">عن بنيان - العنوان الصغير</label><input id="aboutEyebrow" value="${escapeHTML(homepage.about_eyebrow || "عن بنيان")}" /></div>
        <div class="form-field"><label for="aboutTitle">عن بنيان - العنوان</label><input id="aboutTitle" value="${escapeHTML(homepage.about_title || "Bonyan Developments")}" /></div>
        <div class="form-field full"><label for="aboutText">عن بنيان - النص</label><textarea id="aboutText">${escapeHTML(homepage.about_text || "بنيان للتطوير العقاري تعمل على تطوير وإدارة مشاريع عقارية بمنهج منظم يركز على جودة التنفيذ، وضوح البيانات، ومتابعة العملاء في كل مرحلة من مراحل المشروع.")}</textarea></div>

        <div class="form-field"><label for="overviewEyebrow">بيانات المشروع - العنوان الصغير</label><input id="overviewEyebrow" value="${escapeHTML(homepage.overview_eyebrow || "بيانات المشروع")}" /></div>
        <div class="form-field"><label for="overviewTitle">بيانات المشروع - العنوان</label><input id="overviewTitle" value="${escapeHTML(homepage.overview_title || "نظرة تشغيلية على حالة الوحدات")}" /></div>
        <div class="form-field full"><label for="overviewText">بيانات المشروع - الوصف</label><textarea id="overviewText">${escapeHTML(homepage.overview_text || "تعرض هذه المؤشرات بيانات فعلية من قاعدة النظام، ويتم تحديثها عند إضافة الحجوزات والمدفوعات من لوحة الإدارة.")}</textarea></div>

        <div class="form-field"><label for="galleryEyebrow">المعرض - العنوان الصغير</label><input id="galleryEyebrow" value="${escapeHTML(homepage.gallery_eyebrow || "المعرض")}" /></div>
        <div class="form-field"><label for="galleryTitle">المعرض - العنوان</label><input id="galleryTitle" value="${escapeHTML(homepage.gallery_title || "صور المشروع والرسومات المعتمدة")}" /></div>
        <button class="btn primary full" type="submit">حفظ أقسام الصفحة الرئيسية</button>
      </form>
    </section>
    <section class="data-panel">
      <span class="eyebrow">بيانات الدخول / الملف الشخصي</span>
      <h3>بيانات حسابي</h3>
      <form id="profileForm" class="form-grid" autocomplete="off">
        <div class="form-field"><label for="profileFullName">الاسم</label><input id="profileFullName" value="${escapeHTML(profile.fullName || "")}" required /></div>
        <div class="form-field"><label for="profileEmail">البريد الإلكتروني</label><input id="profileEmail" type="email" value="${escapeHTML(profile.email || "")}" required /></div>
        <div class="form-field full"><label for="profilePhone">رقم الهاتف</label><input id="profilePhone" value="${escapeHTML(profile.phone || "")}" /></div>
        <button class="btn secondary full" type="submit">حفظ بيانات الحساب</button>
      </form>
    </section>
    <section class="data-panel">
      <span class="eyebrow">أمان الحساب</span>
      <h3>تغيير كلمة المرور</h3>
      <form id="passwordForm" class="form-grid" autocomplete="off">
        <div class="form-field full"><label for="currentAdminPassword">كلمة المرور الحالية</label><input id="currentAdminPassword" type="password" required /></div>
        <div class="form-field"><label for="newAdminPassword">كلمة المرور الجديدة</label><input id="newAdminPassword" type="password" minlength="8" required /></div>
        <div class="form-field"><label for="confirmAdminPassword">تأكيد كلمة المرور</label><input id="confirmAdminPassword" type="password" minlength="8" required /></div>
        <button class="btn secondary full" type="submit">تغيير كلمة المرور</button>
      </form>
    </section>
    ${APP_STATE.session?.role === "admin" ? renderSettingsAccountsSection() : ""}
  `;
}

function renderSettingsAccountsSection() {
  const users = APP_STATE.dashboard?.users || [];
  return `
    <section class="data-panel">
      <span class="eyebrow">إدارة الحسابات</span>
      <h3>الحسابات</h3>
      ${users.length ? `
        <div class="table-wrap">
          <table>
            <thead><tr><th>الاسم</th><th>البريد الإلكتروني</th><th>الدور</th><th>رقم الهاتف</th><th>الحالة</th><th>آخر دخول</th><th>الإجراءات</th></tr></thead>
            <tbody>
              ${users.map((user) => `
                <tr>
                  <td>${escapeHTML(user.fullName || "-")}</td>
                  <td>${escapeHTML(user.email || "-")}</td>
                  <td>${escapeHTML(user.role || "-")}</td>
                  <td>${escapeHTML(user.phone || "-")}</td>
                  <td>${user.isActive ? "نشط" : "موقوف"}</td>
                  <td>${formatDateTime(user.lastLoginAt)}</td>
                  <td>
                    <button class="btn ghost small" type="button" data-settings-account-edit="${user.id}">تعديل البيانات</button>
                    ${user.role !== "owner" ? `<button class="btn secondary small" type="button" data-settings-account-reset="${user.id}">إعادة تعيين كلمة المرور</button>` : ""}
                    ${user.isActive
                      ? (user.role !== "owner" && user.id !== APP_STATE.session?.id ? `<button class="btn danger small" type="button" data-settings-account-disable="${user.id}">إيقاف الحساب</button>` : "")
                      : `<button class="btn primary small" type="button" data-settings-account-enable="${user.id}">تفعيل الحساب</button>`}
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      ` : EmptyState("لا توجد حسابات متاحة حاليًا.", "سيتم عرض الحسابات هنا بعد إضافتها.")}
    </section>
  `;
}

function bindSettingsForm() {
  const form = qs("#settingsForm");
  if (form) {
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      try {
        await AdminAPI.updateSettings({
          office_name: qs("#officeName").value.trim(),
          office_phone: qs("#officePhone").value.trim(),
          whatsapp_number: qs("#whatsappNumber").value.trim(),
          currency: qs("#currency").value.trim(),
          receipt_prefix: qs("#receiptPrefix").value.trim(),
          office_address: qs("#officeAddress").value.trim(),
          statement_footer: qs("#statementFooter").value.trim(),
        });
        showToast("تم حفظ الإعدادات بنجاح.", "success");
        await refreshDashboardKeys(["settings"], { loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الإعدادات..." });
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  const homepageSectionsForm = qs("#homepageSectionsForm");
  if (homepageSectionsForm) {
    homepageSectionsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = qs("#homepageSectionsForm button[type='submit']");
      setButtonLoading(button, true, "جاري الحفظ...");
      try {
        await AdminAPI.updateSettings({
          homepageContent: {
            about_eyebrow: qs("#aboutEyebrow").value.trim(),
            about_title: qs("#aboutTitle").value.trim(),
            about_text: qs("#aboutText").value.trim(),
            overview_eyebrow: qs("#overviewEyebrow").value.trim(),
            overview_title: qs("#overviewTitle").value.trim(),
            overview_text: qs("#overviewText").value.trim(),
            gallery_eyebrow: qs("#galleryEyebrow").value.trim(),
            gallery_title: qs("#galleryTitle").value.trim(),
          },
        });
        showToast("تم حفظ أقسام الصفحة الرئيسية بنجاح.", "success");
        await refreshDashboardKeys(["settings"], { loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الإعدادات..." });
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  const profileForm = qs("#profileForm");
  if (profileForm) {
    profileForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = qs("#profileForm button[type='submit']");
      setButtonLoading(button, true, "جاري الحفظ...");
      try {
        const result = await AdminAPI.updateProfile({
          full_name: qs("#profileFullName").value.trim(),
          email: qs("#profileEmail").value.trim().toLowerCase(),
          phone: qs("#profilePhone").value.trim(),
        });
        APP_STATE.session = result.admin || result.profile || APP_STATE.session;
        showToast("تم تحديث بيانات الحساب بنجاح.", "success");
        renderDashboardShell();
        renderActiveDashboardView();
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  const passwordForm = qs("#passwordForm");
  if (passwordForm) {
    passwordForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = qs("#passwordForm button[type='submit']");
      setButtonLoading(button, true, "جاري التحديث...");
      try {
        await AdminAPI.changePassword({
          current_password: qs("#currentAdminPassword").value,
          new_password: qs("#newAdminPassword").value,
          confirm_password: qs("#confirmAdminPassword").value,
        });
        showToast("تم تغيير كلمة المرور بنجاح.", "success");
        passwordForm.reset();
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setButtonLoading(button, false);
      }
    });
  }

  qsa("[data-settings-account-edit]").forEach((button) => button.addEventListener("click", () => openSettingsAccountEdit(button.dataset.settingsAccountEdit)));
  qsa("[data-settings-account-reset]").forEach((button) => button.addEventListener("click", () => openSettingsAccountPasswordReset(button.dataset.settingsAccountReset)));
  qsa("[data-settings-account-disable]").forEach((button) => button.addEventListener("click", () => toggleSettingsAccountStatus(button.dataset.settingsAccountDisable, false)));
  qsa("[data-settings-account-enable]").forEach((button) => button.addEventListener("click", () => toggleSettingsAccountStatus(button.dataset.settingsAccountEnable, true)));
}

function openSettingsAccountEdit(userId) {
  const user = (APP_STATE.dashboard?.users || []).find((item) => item.id === userId);
  if (!user) return;
  const roles = user.role === "owner" ? ["owner"] : ["assistant", "accountant", "viewer"];
  openModal(`
    <span class="eyebrow">إدارة الحسابات</span>
    <h2>تعديل البيانات</h2>
    <form id="settingsAccountEditForm" class="form-grid" autocomplete="off">
      <div class="form-field"><label>الاسم</label><input name="full_name" value="${escapeHTML(user.fullName || "")}" required /></div>
      <div class="form-field"><label>البريد الإلكتروني</label><input name="email" type="email" value="${escapeHTML(user.email || "")}" required /></div>
      <div class="form-field"><label>رقم الهاتف</label><input name="phone" value="${escapeHTML(user.phone || "")}" /></div>
      <div class="form-field"><label>الدور</label><select name="role">${roles.map((role) => `<option value="${role}" ${role === user.role ? "selected" : ""}>${escapeHTML(role)}</option>`).join("")}</select></div>
      <button class="btn primary full" type="submit">حفظ التعديل</button>
    </form>
  `);
  qs("#settingsAccountEditForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await AdminAPI.updateUser(userId, {
        full_name: form.get("full_name"),
        email: String(form.get("email") || "").toLowerCase(),
        phone: form.get("phone"),
        role: form.get("role"),
      });
      closeModal();
      showToast("تم حفظ بيانات الحساب.", "success");
      await refreshDashboardKeys(["users"], { loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الحسابات..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

function openSettingsAccountPasswordReset(userId) {
  openModal(`
    <span class="eyebrow">إدارة الحسابات</span>
    <h2>إعادة تعيين كلمة المرور</h2>
    <form id="settingsAccountResetForm" class="form-grid" autocomplete="off">
      <div class="form-field full"><label>كلمة المرور المؤقتة</label><input name="temporary_password" type="password" minlength="8" required /></div>
      <button class="btn primary full" type="submit">إعادة التعيين</button>
    </form>
  `);
  qs("#settingsAccountResetForm").addEventListener("submit", async (event) => {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await AdminAPI.resetUserPassword(userId, { temporary_password: form.get("temporary_password") });
      closeModal();
      showToast("تمت إعادة تعيين كلمة المرور.", "success");
      await refreshDashboardKeys(["users"], { loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الحسابات..." });
    } catch (error) {
      showToast(error.message, "error");
    }
  });
}

async function toggleSettingsAccountStatus(userId, enabled) {
  if (!confirm(enabled ? "هل تريد تفعيل هذا الحساب؟" : "هل تريد إيقاف هذا الحساب؟")) return;
  try {
    if (enabled) await AdminAPI.enableUser(userId);
    else await AdminAPI.disableUser(userId);
    showToast(enabled ? "تم تفعيل الحساب." : "تم إيقاف الحساب.", "success");
    await refreshDashboardKeys(["users"], { loadingSelector: "#dashboardContent .data-panel", loadingText: "جاري تحديث الحسابات..." });
  } catch (error) {
    showToast(error.message, "error");
  }
}
