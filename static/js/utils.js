const qs = (selector, scope = document) => scope.querySelector(selector);
const qsa = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  })[char]);
}

function formatMoney(value) {
  return `${Number(value || 0).toLocaleString("ar-EG")} ${APP_CONFIG.currencyLabel}`;
}

function formatDate(value) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-EG", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

function formatDateTime(value) {
  if (!value) return "غير محدد";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "غير محدد";
  return new Intl.DateTimeFormat("ar-EG", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatPercent(value) {
  return `${Math.round(Number(value || 0)).toLocaleString("ar-EG")}%`;
}

function statusLabel(value) {
  return STATUS_LABELS[value] || PAYMENT_METHOD_LABELS[value] || value || "غير محدد";
}

function statusClass(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function StatusBadge(value) {
  return `<span class="status-badge status-${statusClass(value)}">${escapeHTML(statusLabel(value))}</span>`;
}

function EmptyState(title = "لا توجد بيانات متاحة حاليًا.", text = "سيتم عرض البيانات هنا فور إضافتها من لوحة الإدارة.") {
  return `<div class="empty-state"><strong>${escapeHTML(title)}</strong><br><span>${escapeHTML(text)}</span></div>`;
}

function LoadingState(text = "جاري تحميل البيانات...") {
  return `<div class="loading-state">${escapeHTML(text)}</div>`;
}

function ErrorState(text = "حدث خطأ أثناء تحميل البيانات. يرجى المحاولة مرة أخرى.") {
  return `<div class="error-state">${escapeHTML(text)}</div>`;
}

function ProgressBar(value) {
  const cleanValue = Math.max(0, Math.min(100, Math.round(Number(value || 0))));
  return `<div class="progress-track" aria-label="نسبة السداد ${cleanValue}%"><div class="progress-fill" style="width:${cleanValue}%"></div></div>`;
}

function showToast(message, type = "info") {
  const host = qs("#toastHost");
  if (!host) return;
  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  host.appendChild(toast);
  window.setTimeout(() => toast.remove(), 4200);
}

function openModal(content) {
  const modal = qs("#appModal");
  modal.innerHTML = `<div class="modal-card"><button class="modal-close" type="button" aria-label="إغلاق">×</button>${content}</div>`;
  modal.hidden = false;
  modal.onclick = (event) => {
    if (event.target === modal) closeModal();
  };
  document.addEventListener("keydown", handleModalEscape);
  qs(".modal-close", modal).addEventListener("click", closeModal);
}

function closeModal() {
  const modal = qs("#appModal");
  qsa("video, audio", modal).forEach((media) => media.pause());
  modal.hidden = true;
  modal.innerHTML = "";
  modal.onclick = null;
  document.removeEventListener("keydown", handleModalEscape);
}

function handleModalEscape(event) {
  if (event.key === "Escape") closeModal();
}

function downloadUrl(url) {
  window.open(url, "_blank", "noopener");
}

function setButtonLoading(button, isLoading, loadingText = "جاري الحفظ...") {
  if (!button) return;
  if (isLoading) {
    button.dataset.originalText = button.textContent;
    button.textContent = loadingText;
    button.disabled = true;
  } else {
    button.textContent = button.dataset.originalText || button.textContent;
    button.disabled = false;
  }
}

function normalizeAmountValue(value) {
  const arabicDigits = "٠١٢٣٤٥٦٧٨٩";
  const easternDigits = "۰۱۲۳۴۵۶۷۸۹";
  return String(value || "")
    .replace(/[٠-٩]/g, (digit) => arabicDigits.indexOf(digit))
    .replace(/[۰-۹]/g, (digit) => easternDigits.indexOf(digit))
    .replace(/[^\d.]/g, "");
}
