// API Functions
async function apiFetch(url, options = {}) {
  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json',
    },
  };

  const finalOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...options.headers,
    },
  };

  try {
    const response = await fetch(url, finalOptions);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
}

// Auth API
async function adminLogin(email, password) {
  return apiFetch('/api/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

async function adminLogout() {
  return apiFetch('/api/admin/logout', {
    method: 'POST',
  });
}

// Client API
async function findClientByCode(code) {
  return apiFetch(`/api/clients/by-code/${encodeURIComponent(code)}`);
}

// Project Updates API
async function getPublishedUpdates() {
  return apiFetch('/api/project-updates/published');
}

async function getAllProjectUpdates() {
  return apiFetch('/api/admin/project-updates');
}

async function createProjectUpdate(payload) {
  return apiFetch('/api/admin/project-updates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function updateProjectUpdate(id, payload) {
  return apiFetch(`/api/admin/project-updates/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

async function deleteProjectUpdate(id) {
  return apiFetch(`/api/admin/project-updates/${id}`, {
    method: 'DELETE',
  });
}

async function publishProjectUpdate(id) {
  return apiFetch(`/api/admin/project-updates/${id}/publish`, {
    method: 'POST',
  });
}

async function unpublishProjectUpdate(id) {
  return apiFetch(`/api/admin/project-updates/${id}/unpublish`, {
    method: 'POST',
  });
}

// Media Upload API
async function uploadProjectUpdateMedia(file) {
  const formData = new FormData();
  formData.append('file', file);
  
  return apiFetch('/api/admin/uploads/project-update-media', {
    method: 'POST',
    body: formData,
    headers: {}, // Let browser set Content-Type for FormData
  });
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    apiFetch,
    adminLogin,
    adminLogout,
    findClientByCode,
    getPublishedUpdates,
    getAllProjectUpdates,
    createProjectUpdate,
    updateProjectUpdate,
    deleteProjectUpdate,
    publishProjectUpdate,
    unpublishProjectUpdate,
    uploadProjectUpdateMedia
  };
}
