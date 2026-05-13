async function apiRequest(path, options = {}) {
  const isFormData = options.body instanceof FormData;
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(isFormData ? {} : { "Content-Type": "application/json" }),
      ...(options.headers || {}),
    },
  });

  const contentType = response.headers.get("content-type") || "";
  const payload = contentType.includes("application/json")
    ? await response.json()
    : { rawText: await response.text() };

  if (!response.ok) {
    let message = payload?.error?.message || payload?.message || payload?.error || "";
    if (!message && payload?.rawText) {
      if (response.status === 404) {
        message = "المسار غير متاح في النسخة الحالية. يرجى إعادة تشغيل السيرفر ثم تحديث الصفحة.";
      } else if (response.status >= 500) {
        message = "حدث خطأ داخلي في السيرفر. يرجى إعادة تشغيل السيرفر والمحاولة مرة أخرى.";
      }
    }
    if (!message) {
      message = response.status === 403
        ? "ليس لديك صلاحية لتنفيذ هذه العملية."
        : "حدث خطأ أثناء تحميل البيانات.";
    }
    throw new Error(message);
  }

  if (payload && payload.success === true && Object.prototype.hasOwnProperty.call(payload, "data")) {
    return payload.data;
  }
  return payload;
}

const apiGet = (path) => apiRequest(path);
const apiPost = (path, body = {}) => apiRequest(path, { method: "POST", body: JSON.stringify(body) });
const apiPatch = (path, body = {}) => apiRequest(path, { method: "PATCH", body: JSON.stringify(body) });
const apiDelete = (path) => apiRequest(path, { method: "DELETE" });
const uploadFile = (path, file) => {
  const formData = new FormData();
  formData.append("file", file);
  return apiRequest(path, { method: "POST", body: formData });
};
const downloadFile = (path) => window.open(path, "_blank", "noopener");

const AuthAPI = {
  login: (email, password) => apiPost("/api/admin/login", { email, password }),
  logout: () => apiPost("/api/admin/logout"),
  me: () => apiGet("/api/admin/me"),
};

const PublicAPI = {
  overview: () => apiGet("/api/public/overview"),
  publishedUpdates: () => apiGet("/api/project-updates/published"),
};

const ClientAPI = {
  verifyCode: (code) => apiPost("/api/client/verify-code", { code }),
  reservation: (code) => apiGet(`/api/client/reservation/${encodeURIComponent(code)}`),
  statementUrl: (clientId, code) => `/api/client/statement/${encodeURIComponent(clientId)}?code=${encodeURIComponent(code)}`,
};

const AdminAPI = {
  bootstrap: () => apiGet("/api/admin/bootstrap"),
  dashboardSummary: () => apiGet("/api/admin/dashboard-summary"),
  apartments: () => apiGet("/api/admin/apartments"),
  createApartment: (payload) => apiPost("/api/admin/apartments", payload),
  clients: () => apiGet("/api/admin/clients"),
  updateAccount: (payload) => apiPatch("/api/admin/account", payload),
  createClient: (payload) => apiPost("/api/admin/clients", payload),
  updateClient: (id, payload) => apiPatch(`/api/admin/clients/${id}`, payload),
  deleteClient: async (id) => {
    try {
      return await apiDelete(`/api/admin/clients/${id}?confirm=true`);
    } catch (_) {
      return apiPost(`/api/admin/clients/${id}/delete`, { confirm: true });
    }
  },
  updateApartment: (id, payload) => apiPatch(`/api/admin/apartments/${id}`, payload),
  payments: () => apiGet("/api/admin/payments"),
  createPayment: (payload) => apiPost("/api/admin/payments", payload),
  updatePayment: (id, payload) => apiPatch(`/api/admin/payments/${id}`, payload),
  deletePayment: (id) => apiDelete(`/api/admin/payments/${id}?confirm=true`),
  installments: () => apiGet("/api/admin/installments"),
  createInstallment: (payload) => apiPost("/api/admin/installments", payload),
  updateInstallment: (id, payload) => apiPatch(`/api/admin/installments/${id}`, payload),
  deleteInstallment: (id) => apiDelete(`/api/admin/installments/${id}?confirm=true`),
  settings: () => apiGet("/api/admin/settings"),
  updateSettings: (payload) => apiPatch("/api/admin/settings", payload),
  auditLogs: () => apiGet("/api/admin/audit-logs"),
  users: () => apiGet("/api/admin/users"),
  createUser: (payload) => apiPost("/api/admin/users", payload),
  receipt: (paymentId) => apiPost("/api/admin/receipts/generate", { payment_id: paymentId }),
  exportUrl: (kind) => `/api/admin/export/${kind}`,
};

const OwnerAPI = {
  dashboardSummary: () => apiGet("/api/owner/dashboard-summary"),
  alerts: () => apiGet("/api/owner/alerts"),
  assistantPerformance: () => apiGet("/api/owner/assistant-performance"),
  deals: () => apiGet("/api/owner/deals"),
  deal: (id) => apiGet(`/api/owner/deals/${id}`),
  approveDeal: (id, ownerNotes = "") => apiPost(`/api/owner/deals/${id}/approve`, { owner_notes: ownerNotes }),
  rejectDeal: (id, ownerNotes = "") => apiPost(`/api/owner/deals/${id}/reject`, { owner_notes: ownerNotes }),
  requestRevision: (id, ownerNotes = "") => apiPost(`/api/owner/deals/${id}/request-revision`, { owner_notes: ownerNotes }),
  finalizeDeal: (id, ownerPin = "") => apiPost(`/api/owner/deals/${id}/finalize`, { owner_pin: ownerPin }),
  clients: () => apiGet("/api/owner/clients"),
  client: (id) => apiGet(`/api/owner/clients/${id}`),
  apartments: () => apiGet("/api/owner/apartments"),
  apartmentTimeline: (id) => apiGet(`/api/owner/apartments/${id}/timeline`),
  updateApartment: (id, payload) => apiPatch(`/api/owner/apartments/${id}`, payload),
  payments: () => apiGet("/api/owner/payments"),
  contracts: () => apiGet("/api/owner/contracts"),
  settings: () => apiGet("/api/owner/settings"),
  updateSettings: (payload) => apiPatch("/api/owner/settings", payload),
  contractTemplate: () => apiGet("/api/owner/contract-template"),
  updateContractTemplate: (payload) => apiPatch("/api/owner/contract-template", payload),
  priceSettings: () => apiGet("/api/owner/price-settings"),
  updatePriceSettings: (payload) => apiPatch("/api/owner/price-settings", payload),
  auditLogs: () => apiGet("/api/owner/audit-logs"),
  auditLog: (id) => apiGet(`/api/owner/audit-logs/${id}`),
};

const DealAPI = {
  list: () => apiGet("/api/admin/deals"),
  create: (payload) => apiPost("/api/admin/deals", payload),
  update: (id, payload) => apiPatch(`/api/admin/deals/${id}`, payload),
  submit: (id) => apiPost(`/api/admin/deals/${id}/submit`),
  approve: (id, ownerNotes = "") => apiPost(`/api/admin/deals/${id}/approve`, { owner_notes: ownerNotes }),
  reject: (id, ownerNotes = "") => apiPost(`/api/admin/deals/${id}/reject`, { owner_notes: ownerNotes }),
  requestRevision: (id, ownerNotes = "") => apiPost(`/api/admin/deals/${id}/request-revision`, { owner_notes: ownerNotes }),
};

const ContractAPI = {
  list: () => apiGet("/api/admin/contracts"),
  generate: (dealId, contractType) => apiPost("/api/admin/contracts/generate", { deal_id: dealId, contract_type: contractType }),
};

const UpdatesAPI = {
  list: () => apiGet("/api/admin/project-updates"),
  create: (payload) => apiPost("/api/admin/project-updates", payload),
  update: (id, payload) => apiPatch(`/api/admin/project-updates/${id}`, payload),
  remove: (id) => apiDelete(`/api/admin/project-updates/${id}`),
  publish: (id) => apiPost(`/api/admin/project-updates/${id}/publish`),
  unpublish: (id) => apiPost(`/api/admin/project-updates/${id}/unpublish`),
  upload: (file) => uploadFile("/api/admin/uploads/project-update-media", file),
};
