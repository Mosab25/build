function renderAuditLogs(logs = []) {
  if (!logs.length) return EmptyState("لا توجد إجراءات إدارية مسجلة حاليًا.", "سيتم عرض سجل النشاط هنا بعد تنفيذ العمليات.");
  return `
    <div class="table-wrap">
      <table>
        <thead><tr><th>المسؤول</th><th>الإجراء</th><th>العنصر</th><th>التفاصيل</th><th>التاريخ</th></tr></thead>
        <tbody>
          ${logs.map((log) => `
            <tr>
              <td>${escapeHTML(log.admin_name || "النظام")}</td>
              <td>${escapeHTML(log.action_type || "-")}</td>
              <td>${escapeHTML(log.entity_type || "-")}</td>
              <td>${escapeHTML(log.description || "-")}</td>
              <td>${formatDate(log.created_at)}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;
}
