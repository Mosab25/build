// Utility Functions
function formatCurrency(amount) {
  return new Intl.NumberFormat('ar-EG', {
    style: 'currency',
    currency: 'EGP'
  }).format(amount);
}

function formatDate(dateString) {
  const options = {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  return new Date(dateString).toLocaleDateString('ar-EG', options);
}

function formatPercent(value) {
  return `${Math.round(value)}%`;
}

function toArabicNumber(num) {
  const arabicNumbers = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).split('').map(digit => arabicNumbers[parseInt(digit)] || digit).join('');
}

function statusTitle(value) {
  const mapping = {
    "available": "Available",
    "reserved": "Reserved",
    "sold": "Sold",
    "pending_payment": "Pending Payment",
    "pending": "Pending",
    "confirmed": "Confirmed",
    "cancelled": "Cancelled",
    "partially_paid": "Partially Paid",
    "fully_paid": "Fully Paid",
    "overdue": "Overdue",
    "cash": "Cash",
    "bank_transfer": "Bank Transfer",
    "installment": "Installment",
    "office_payment": "Office Payment",
    "other": "Other",
    "rejected": "Rejected",
    "upcoming": "Upcoming",
    "due": "Due",
    "paid": "Paid",
    "partially_paid_installment": "Partially Paid",
  };
  return mapping.get(value || "", value || "");
}

function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  toast.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: ${type === 'success' ? 'var(--gold)' : 'var(--wine)'};
    color: var(--paper);
    padding: 12px 20px;
    border-radius: 6px;
    font-weight: 700;
    z-index: 10000;
    animation: slideIn 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  `;
  
  document.body.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) {
    modal.style.display = 'none';
    document.body.style.overflow = '';
  }
}

function escapeHTML(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function validateEmail(email) {
  const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return re.test(email);
}

function validatePhone(phone) {
  const re = /^[\d\s\-\(\)]+$/;
  return re.test(phone) && phone.replace(/\D/g, '').length >= 10;
}

function validateRequired(value, fieldName) {
  if (!value || value.trim().length === 0) {
    return `${fieldName} مطلوب`;
  }
  return null;
}

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }
  
  @keyframes slideOut {
    from {
      transform: translateX(0);
      opacity: 1;
    }
    to {
      transform: translateX(100%);
      opacity: 0;
    }
  }
  
  .toast {
    font-family: "Cairo", sans-serif;
  font-size: 0.9rem;
    border-radius: 4px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
  }
`;
document.head.appendChild(style);

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    formatCurrency,
    formatDate,
    formatPercent,
    toArabicNumber,
    statusTitle,
    showToast,
    openModal,
    closeModal,
    escapeHTML,
    validateEmail,
    validatePhone,
    validateRequired
  };
}
