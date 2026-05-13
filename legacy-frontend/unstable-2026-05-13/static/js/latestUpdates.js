// Latest Updates Module
async function renderUpdates() {
  const grid = document.getElementById("updatesGrid");
  
  try {
    const response = await getPublishedUpdates();
    const updates = response || [];
    
    if (updates.length === 0) {
      // Show empty state
      grid.innerHTML = `
        <div class="empty-state" style="text-align: center; padding: 60px 20px; color: var(--gold-2);">
          <svg width="64" height="64" fill="rgba(156, 111, 56, 0.3)" viewBox="0 0 24 24" style="margin-bottom: 16px;">
            <path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11zM7 10h5v5H7z"/>
          </svg>
          <h3 style="margin: 0 0 8px; font-size: 1.3rem; color: var(--ink);">لا توجد تحديثات منشورة حاليًا.</h3>
          <p style="margin: 0; color: rgba(248, 243, 232, 0.68); font-size: 0.95rem;">سيتم عرض تحديثات المشروع هنا فور نشرها من الإدارة.</p>
        </div>
      `;
      return;
    }
    
    grid.innerHTML = updates
      .map(
        (item, index) => `
        <article class="update-card reveal" style="--delay:${index * 70}ms">
          ${item.media_type === 'video' ? 
            `<div style="position: relative; width: 100%; height: 200px; border-radius: 8px; overflow: hidden; cursor: pointer;" onclick="openVideoModal('${item.media_url}')">
              <img src="${item.thumbnail_url || projectMedia.facade.src}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;">
              <div style="position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 48px; height: 48px; background: rgba(0,0,0,0.7); border: 2px solid rgba(217, 181, 101, 0.5); border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                  <path d="M8 5v14l11-7z"/>
                </svg>
              </div>
              <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                فيديو
              </div>
            </div>` :
            `<div style="position: relative; width: 100%; height: 200px; border-radius: 8px; overflow: hidden; cursor: pointer;" onclick="openImageModal('${item.media_url}')">
              <img src="${item.media_url}" alt="${item.title}" style="width: 100%; height: 100%; object-fit: cover;">
              <div style="position: absolute; top: 10px; right: 10px; background: rgba(0,0,0,0.8); color: white; padding: 4px 8px; border-radius: 4px; font-size: 11px; font-weight: bold;">
                صورة
              </div>
            </div>`
          }
          <div class="update-content">
            <time datetime="${item.update_date}">${formatDate(item.update_date)}</time>
            <h3>${item.title}</h3>
            <p>${item.description}</p>
            <div style="margin-top: 12px;">
              <span style="display: inline-block; background: rgba(217, 181, 101, 0.15); color: var(--ink); padding: 4px 8px; border-radius: 4px; font-size: 0.8rem; font-weight: 800;">
                ${getStageLabel(item.stage)}
              </span>
            </div>
          </div>
        </article>
      `,
      )
      .join("");
  } catch (error) {
    console.error("Failed to load updates:", error);
    grid.innerHTML = `
      <div style="text-align: center; padding: 60px 20px; color: var(--gold-2);">
        <h3>فشل تحميل التحديثات</h3>
        <p>يرجى المحاولة مرة أخرى.</p>
      </div>
    `;
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

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderUpdates,
    getStageLabel
  };
}
