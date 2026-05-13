const MEDIA_ASSETS = {
  facade: {
    key: "facade",
    type: "image",
    title: "واجهة المشروع",
    label: "واجهة المشروع",
    src: "media/facade.jpg",
    alt: "واجهة مشروع أرض عبدالجليل",
  },
  apartment1: {
    key: "apartment1",
    type: "image",
    title: "شقة رقم 1",
    label: "شقة رقم 1 — 137م",
    area: 137,
    direction: "بحري قبلي",
    apartmentType: "A",
    src: "media/apartment-1.jpg",
    alt: "شقة رقم 1 بمساحة 137 متر بحري قبلي",
  },
  apartment2: {
    key: "apartment2",
    type: "image",
    title: "شقة رقم 2",
    label: "شقة رقم 2 — 125م",
    area: 125,
    direction: "بحري",
    apartmentType: "B",
    src: "media/apartment-2.jpg",
    alt: "شقة رقم 2 بمساحة 125 متر بحري",
  },
  apartment3: {
    key: "apartment3",
    type: "image",
    title: "شقة رقم 3",
    label: "شقة رقم 3 — 120م",
    area: 120,
    direction: "قبلي",
    apartmentType: "C",
    src: "media/apartment-3.jpg",
    alt: "شقة رقم 3 بمساحة 120 متر قبلي",
  },
  projectVideo: {
    key: "projectVideo",
    type: "video",
    title: "فيديو متابعة الإنشاء",
    label: "فيديو متابعة الإنشاء",
    src: "media/project-video.mp4",
    poster: "media/facade.jpg",
  },
};

const GALLERY_ORDER = [
  MEDIA_ASSETS.facade,
  MEDIA_ASSETS.apartment1,
  MEDIA_ASSETS.apartment2,
  MEDIA_ASSETS.apartment3,
  MEDIA_ASSETS.projectVideo,
];

const APARTMENT_MODELS = [
  MEDIA_ASSETS.apartment1,
  MEDIA_ASSETS.apartment2,
  MEDIA_ASSETS.apartment3,
];
