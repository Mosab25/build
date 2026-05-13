function renderSettingsPanel() {
  const settings = APP_STATE.dashboard.settings || {};
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
      <span class="eyebrow">أمان الحساب</span>
      <h3>تغيير بيانات دخول الإدارة</h3>
      <form id="accountForm" class="form-grid" autocomplete="off">
        <div class="form-field"><label for="newAdminEmail">البريد الإلكتروني الجديد</label><input id="newAdminEmail" type="email" placeholder="${escapeHTML(APP_STATE.session?.email || "")}" /></div>
        <div class="form-field"><label for="currentAdminPassword">كلمة المرور الحالية</label><input id="currentAdminPassword" type="password" required /></div>
        <div class="form-field"><label for="newAdminPassword">كلمة المرور الجديدة</label><input id="newAdminPassword" type="password" minlength="8" /></div>
        <button class="btn secondary full" type="submit">تحديث بيانات الدخول</button>
      </form>
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
        await loadDashboard();
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  const accountForm = qs("#accountForm");
  if (accountForm) {
    accountForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const button = qs("#accountForm button[type='submit']");
      setButtonLoading(button, true, "جاري التحديث...");
      try {
        const newEmail = qs("#newAdminEmail").value.trim().toLowerCase();
        const currentPassword = qs("#currentAdminPassword").value;
        const newPassword = qs("#newAdminPassword").value;
        await AdminAPI.updateAccount({
          current_password: currentPassword,
          new_email: newEmail,
          new_password: newPassword,
        });
        showToast("تم تحديث بيانات الدخول بنجاح.", "success");
        accountForm.reset();
        await loadDashboard();
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        setButtonLoading(button, false);
      }
    });
  }
}
