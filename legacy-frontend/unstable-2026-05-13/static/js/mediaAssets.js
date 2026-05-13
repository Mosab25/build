// Centralized Media Assets Mapping
const projectMedia = {
  // Project Facade
  facade: {
    id: "facade",
    type: "image",
    category: "exterior",
    title: "واجهة المشروع",
    description: "الواجهة الرئيسية لمشروع أرض عبدالجليل",
    src: "media/facade.jpg",
    alt: "واجهة مشروع أرض عبدالجليل"
  },

  // Apartment Models
  apartment1: {
    id: "apartment1",
    type: "image",
    category: "apartment-plan",
    title: "شقة رقم 1",
    description: "نموذج شقة 137 متر - بحري قبلي",
    src: "media/apartment-1.jpg",
    alt: "شقة رقم 1 - 137م بحري قبلي"
  },

  apartment2: {
    id: "apartment2",
    type: "image",
    category: "apartment-plan",
    title: "شقة رقم 2",
    description: "نموذج شقة 125 متر - بحري",
    src: "media/apartment-2.jpg",
    alt: "شقة رقم 2 - 125م بحري"
  },

  apartment3: {
    id: "apartment3",
    type: "image",
    category: "apartment-plan",
    title: "شقة رقم 3",
    description: "نموذج شقة 120 متر - قبلي",
    src: "media/apartment-3.jpg",
    alt: "شقة رقم 3 - 120م قبلي"
  },

  // Project Video
  projectVideo: {
    id: "projectVideo",
    type: "video",
    category: "construction",
    title: "فيديو متابعة الإنشاء",
    description: "مشاهدة آخر تحديثات تنفيذ المشروع على أرض الواقع",
    src: "media/project-video.mp4",
    poster: "media/facade.jpg",
    alt: "فيديو متابعة إنشاء المشروع"
  }
};

// Legacy compatibility for existing code
const galleryItems = [
  {
    id: "facade",
    image: projectMedia.facade.src,
    title: projectMedia.facade.title,
    description: projectMedia.facade.description,
    category: "exterior",
    label: "واجهة المشروع",
    featured: true
  },
  {
    id: "apartment1",
    image: projectMedia.apartment1.src,
    title: projectMedia.apartment1.title,
    description: projectMedia.apartment1.description,
    category: "apartment-plan",
    label: "نموذج 1"
  },
  {
    id: "apartment2",
    image: projectMedia.apartment2.src,
    title: projectMedia.apartment2.title,
    description: projectMedia.apartment2.description,
    category: "apartment-plan",
    label: "نموذج 2"
  },
  {
    id: "apartment3",
    image: projectMedia.apartment3.src,
    title: projectMedia.apartment3.title,
    description: projectMedia.apartment3.description,
    category: "apartment-plan",
    label: "نموذج 3"
  },
  {
    id: "projectVideo",
    title: projectMedia.projectVideo.title,
    description: projectMedia.projectVideo.description,
    category: "video",
    label: "فيديو الإنشاء",
    video: projectMedia.projectVideo.src,
    poster: projectMedia.projectVideo.poster
  }
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { projectMedia, galleryItems };
}
