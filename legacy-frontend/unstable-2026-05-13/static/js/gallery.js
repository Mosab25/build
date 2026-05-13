// Gallery Module
function renderGallery() {
  const grid = document.getElementById("galleryGrid");
  grid.innerHTML = galleryItems
    .map(
      (item, index) => {
        const isPlan = item.category === "apartment-plan";
        const isVideo = !!item.video;
        let extraClass = item.featured ? "featured" : "";
        if (isPlan) extraClass += " plan-card";
        if (isVideo) extraClass += " video-card";

        let media;
        if (isVideo) {
          media = `<img src="${item.poster || 'media/facade.jpg'}" alt="${item.title}" loading="lazy" />
            <div class="video-play-overlay">
              <svg width="28" height="28" fill="white" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
            </div>`;
        } else {
          media = `<img src="${item.image}" alt="${item.title}" loading="lazy" />`;
        }

        return `
    <article class="gallery-card ${extraClass} reveal" data-category="${item.category}" ${isVideo ? `data-video-src="${item.video}"` : ''} style="--delay:${index * 70}ms">
      ${media}
      <div class="gallery-caption">
        <span class="gallery-label">${item.label}</span>
        <h3>${item.title}</h3>
        <p>${item.description}</p>
      </div>
    </article>
      `;
      }
    )
    .join("");
}

function enableGalleryFilters() {
  const buttons = document.querySelectorAll(".filter-btn");
  const cards = document.querySelectorAll(".gallery-card");

  buttons.forEach((button) => {
    button.addEventListener("click", () => {
      const filter = button.dataset.filter;

      buttons.forEach((item) => item.classList.remove("active"));
      button.classList.add("active");

      cards.forEach((card) => {
        const shouldShow =
          filter === "all" || card.dataset.category === filter;
        card.hidden = !shouldShow;
      });
    });
  });
}

function openVideoModal(videoSrc) {
  const overlay = document.getElementById("videoModal");
  const video = document.getElementById("modalVideo");
  video.src = videoSrc;
  overlay.classList.add("show");
  video.play().catch(() => {});
}

function closeVideoModal() {
  const overlay = document.getElementById("videoModal");
  const video = document.getElementById("modalVideo");
  video.pause();
  video.src = "";
  overlay.classList.remove("show");
}

function openImageModal(imageSrc) {
  const overlay = document.createElement("div");
  overlay.className = "image-modal-overlay show";
  overlay.innerHTML = `
    <div class="image-modal-content">
      <button class="image-modal-close" onclick="this.parentElement.parentElement.remove()">&times;</button>
      <img src="${imageSrc}" style="max-width: 90vw; max-height: 90vh; object-fit: contain;" alt="صورة التحديث">
    </div>
  `;
  overlay.onclick = function(e) {
    if (e.target === overlay) overlay.remove();
  };
  document.body.appendChild(overlay);
}

// Initialize gallery functionality
document.addEventListener("DOMContentLoaded", () => {
  // Video card click handler
  document.getElementById("galleryGrid")?.addEventListener("click", (event) => {
    const videoCard = event.target.closest(".video-card[data-video-src]");
    if (!videoCard) return;
    openVideoModal(videoCard.dataset.videoSrc);
  });
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    renderGallery,
    enableGalleryFilters,
    openVideoModal,
    closeVideoModal,
    openImageModal
  };
}
