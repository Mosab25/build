// Contracts Module
async function renderContractForm(dealId) {
  const formContainer = document.getElementById("contractFormContainer");
  if (!formContainer) return;

  formContainer.innerHTML = `
    <div class="premium-card">
      <h4>إنشاء عقد</h4>
      <form id="contractForm">
        <div class="form-grid">
          <div class="form-field">
            <label for="contractType">نوع العقد</label>
            <select id="contractType" required>
              <option value="draft">عقد مبدئي</option>
              <option value="final">عقد نهائي</option>
            </select>
          </div>
          <div class="form-field">
            <label for="contractDate">تاريخ العقد</label>
            <input type="date" id="contractDate" required>
          </div>
          <div class="form-field">
            <label for="contractTerms">شروط العقد</label>
            <textarea id="contractTerms" rows="6" required></textarea>
          </div>
        </div>
        <div class="form-actions">
          <button type="submit" class="btn primary">إنشاء العقد</button>
          <button type="button" class="btn secondary" onclick="closeContractForm()">إلغاء</button>
        </div>
      </form>
    </div>
  `;

  // Set default date
  document.getElementById("contractDate").value = new Date().toISOString().slice(0, 10);
  
  // Initialize form event listener
  initializeContractForm(dealId);
}

function initializeContractForm(dealId) {
  const contractForm = document.getElementById("contractForm");
  if (!contractForm) return;

  contractForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    
    const formData = new FormData(contractForm);
    const contractData = {
      dealId: dealId,
      type: formData.get('contractType'),
      date: formData.get('contractDate'),
      terms: formData.get('contractTerms'),
      status: 'draft'
    };

    try {
      await apiFetch('/api/assistant/contracts', {
        method: 'POST',
        body: JSON.stringify(contractData)
      });

      showToast('تم إنشاء العقد بنجاح', 'success');
      closeContractForm();
    } catch (error) {
      showToast('فشل إنشاء العقد', 'error');
      console.error('Contract error:', error);
    }
  });
}

function closeContractForm() {
  const formContainer = document.getElementById("contractFormContainer");
  if (formContainer) {
    formContainer.innerHTML = '';
  }
}

function renderDraftContractButton(dealId, userRole) {
  // Only assistants can create draft contracts
  if (userRole !== 'assistant') return '';

  return `
    <button class="draft-contract-btn" onclick="renderContractForm('${dealId}')">
      إنشاء عقد مبدئي
    </button>
  `;
}

function renderFinalContractButton(dealId, userRole) {
  // Only owners can create final contracts
  if (userRole !== 'owner') return '';

  return `
    <button class="final-contract-btn" onclick="downloadFinalContract('${dealId}')">
      تحميل العقد النهائي
    </button>
  `;
}

async function downloadFinalContract(dealId) {
  try {
    const response = await apiFetch(`/api/owner/contracts/${dealId}/final`);
    
    // Create download link
    const blob = new Blob([response], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `عقد-نهائي-${dealId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('تم تحميل العقد النهائي بنجاح', 'success');
  } catch (error) {
    showToast('فشل تحميل العقد النهائي', 'error');
    console.error('Contract download error:', error);
  }
}

async function downloadDraftContract(dealId) {
  try {
    const response = await apiFetch(`/api/assistant/contracts/${dealId}/draft`);
    
    // Create download link
    const blob = new Blob([response], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `عقد-مبدئي-${dealId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
    
    showToast('تم تحميل العقد المبدئي بنجاح', 'success');
  } catch (error) {
    showToast('فشل تحميل العقد المبدئي', 'error');
    console.error('Contract download error:', error);
  }
}

function renderContractActions(dealId, userRole, dealStatus) {
  let actions = '';

  if (userRole === 'assistant' && dealStatus === 'approved') {
    actions = renderDraftContractButton(dealId, userRole);
  } else if (userRole === 'owner' && dealStatus === 'approved') {
    actions = renderFinalContractButton(dealId, userRole);
  }

  return actions;
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderContractForm,
    closeContractForm,
    renderDraftContractButton,
    renderFinalContractButton,
    downloadFinalContract,
    downloadDraftContract,
    renderContractActions
  };
}
