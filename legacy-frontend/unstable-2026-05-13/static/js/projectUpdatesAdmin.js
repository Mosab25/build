// Project Updates Admin Module
async function loadUpdatesTable() {
  try {
    const response = await getAllProjectUpdates();
    const updates = response || [];
    
    const tbody = document.getElementById("updatesTableBody");
    if (!tbody) return;
    
    tbody.innerHTML = updates.map(update => `
      <tr>
        <td>${update.title}</td>
        <td>${getStageLabel(update.stage)}</td>
        <td>${update.update_date}</td>
        <td>${update.media_type === 'image' ? 'صورة' : 'فيديو'}</td>
        <td>
          <span class="status-badge ${update.status === 'published' ? 'status-available' : 'status-pending'}">
            ${update.status === 'published' ? 'منشور' : 'مسودة'}
          </span>
        </td>
        <td>${update.display_order}</td>
        <td>
          <button class="btn secondary" onclick="showUpdateForm('${update.id}')">تعديل</button>
          ${update.status === 'published' ? 
            `<button class="btn secondary" onclick="unpublishUpdate('${update.id}')">إلغاء النشر</button>` :
            `<button class="btn primary" onclick="publishUpdate('${update.id}')">نشر</button>`
          }
          <button class="btn secondary" onclick="deleteUpdate('${update.id}')">حذف</button>
        </td>
      </tr>
    `).join("");
  } catch (error) {
    console.error("Failed to load updates:", error);
  }
}

function getStageLabel(stage) {
  const stages = {
    'foundation': 'الأساسات',
    'concrete': 'أعمال الخرسانة',
    'walls': 'أعمال المباني',
    'finishing': 'التشطيبات',
    'exterior': 'الواجهة',
    'delivery': 'التسليم',
    'general': 'عام'
  };
  return stages[stage] || stage;
}

function showUpdateForm(updateId = null) {
  const modal = document.getElementById("updateFormModal");
  const title = document.getElementById("updateFormTitle");
  
  if (updateId) {
    title.textContent = "تعديل التحديث";
    loadUpdateForEdit(updateId);
  } else {
    title.textContent = "إضافة تحديث جديد";
    resetUpdateForm();
  }
  
  modal.style.display = "flex";
  editingUpdateId = updateId;
}

function hideUpdateForm() {
  document.getElementById("updateFormModal").style.display = "none";
  resetUpdateForm();
  editingUpdateId = null;
}

function resetUpdateForm() {
  document.getElementById("updateForm").reset();
  document.getElementById("imagePreview").innerHTML = "";
  document.getElementById("videoPreview").innerHTML = "";
  document.getElementById("imageField").style.display = "none";
  document.getElementById("videoField").style.display = "none";
}

function toggleMediaFields() {
  const mediaType = document.getElementById("updateMediaType").value;
  const imageField = document.getElementById("imageField");
  const videoField = document.getElementById("videoField");
  
  if (mediaType === "image") {
    imageField.style.display = "block";
    videoField.style.display = "none";
  } else if (mediaType === "video") {
    imageField.style.display = "none";
    videoField.style.display = "block";
  } else {
    imageField.style.display = "none";
    videoField.style.display = "none";
  }
}

async function loadUpdateForEdit(updateId) {
  try {
    const updates = await getAllProjectUpdates();
    const update = updates.find(u => u.id === updateId);
    
    if (update) {
      document.getElementById("updateTitle").value = update.title;
      document.getElementById("updateDate").value = update.update_date;
      document.getElementById("updateStage").value = update.stage;
      document.getElementById("updateDescription").value = update.description;
      document.getElementById("updateMediaType").value = update.media_type;
      document.getElementById("updateStatus").value = update.status;
      document.getElementById("updateOrder").value = update.display_order;
      
      toggleMediaFields();
    }
  } catch (error) {
    console.error("Failed to load update:", error);
  }
}

async function saveUpdate(event) {
  event.preventDefault();
  
  const formData = new FormData(event.target);
  const payload = {
    title: formData.get("title"),
    update_date: formData.get("update_date"),
    stage: formData.get("stage"),
    description: formData.get("description"),
    media_type: formData.get("media_type"),
    status: formData.get("status"),
    display_order: parseInt(formData.get("display_order")) || 0
  };

  // Handle file upload
  const imageFile = document.getElementById("updateImage").files[0];
  const videoFile = document.getElementById("updateVideo").files[0];
  
  if (imageFile || videoFile) {
    try {
      const uploadFormData = new FormData();
      uploadFormData.append("file", imageFile || videoFile);
      
      const uploadResponse = await uploadProjectUpdateMedia(uploadFormData);
      
      if (uploadResponse.url) {
        payload.media_url = uploadResponse.url;
      }
    } catch (error) {
      console.error("Upload failed:", error);
      showToast("فشل رفع الملف", "error");
      return;
    }
  }

  try {
    if (editingUpdateId) {
      await updateProjectUpdate(editingUpdateId, payload);
      showToast("تم تعديل التحديث بنجاح", "success");
    } else {
      await createProjectUpdate(payload);
      showToast("تم إضافة التحديث بنجاح", "success");
    }
    
    hideUpdateForm();
    loadUpdatesTable();
  } catch (error) {
    console.error("Save failed:", error);
    showToast("فشل حفظ التحديث", "error");
  }
}

async function publishUpdate(updateId) {
  if (!confirm("هل أنت متأكد من نشر هذا التحديث؟")) return;
  
  try {
    await publishProjectUpdate(updateId);
    showToast("تم نشر التحديث بنجاح", "success");
    loadUpdatesTable();
  } catch (error) {
    console.error("Publish failed:", error);
    showToast("فشل نشر التحديث", "error");
  }
}

async function unpublishUpdate(updateId) {
  if (!confirm("هل أنت متأكد من إلغاء نشر هذا التحديث؟")) return;
  
  try {
    await unpublishProjectUpdate(updateId);
    showToast("تم إلغاء نشر التحديث بنجاح", "success");
    loadUpdatesTable();
  } catch (error) {
    console.error("Unpublish failed:", error);
    showToast("فشل إلغاء نشر التحديث", "error");
  }
}

async function deleteUpdate(updateId) {
  if (!confirm("هل أنت متأكد من حذف هذا التحديث؟")) return;
  
  try {
    await deleteProjectUpdate(updateId);
    showToast("تم حذف التحديث بنجاح", "success");
    loadUpdatesTable();
  } catch (error) {
    console.error("Delete failed:", error);
    showToast("فشل حذف التحديث", "error");
  }
}

// Handle image/video preview
document.getElementById("updateImage")?.addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById("imagePreview").innerHTML = 
        `<img src="${e.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 4px;">`;
    };
    reader.readAsDataURL(file);
  }
});

document.getElementById("updateVideo")?.addEventListener("change", function(e) {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = function(e) {
      document.getElementById("videoPreview").innerHTML = 
        `<video src="${e.target.result}" style="max-width: 200px; max-height: 150px; border-radius: 4px;" controls></video>`;
    };
    reader.readAsDataURL(file);
  }
});

// Initialize updates admin functionality
document.addEventListener("DOMContentLoaded", () => {
  const updatesAdminTab = document.getElementById("updatesAdminTab");
  if (updatesAdminTab) {
    updatesAdminTab.addEventListener("click", () => {
      loadUpdatesTable();
    });
  }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    loadUpdatesTable,
    showUpdateForm,
    hideUpdateForm,
    resetUpdateForm,
    toggleMediaFields,
    loadUpdateForEdit,
    saveUpdate,
    publishUpdate,
    unpublishUpdate,
    deleteUpdate
  };
}
