// Configuration and Constants
const API_BASE_URL = '/api';

const project = {
  name: "مشروع أرض عبدالجليل",
  location: "موقع استراتيجي حيوي",
  currentPhase: "مرحلة الأساسات",
  deliveryDate: "2026-12-31",
  floors: 10,
  totalUnits: 24,
  soldUnits: 8,
  spaces: "من 120م إلى 137م",
  whatsappNumber: "201234567890"
};

const stages = [
  {
    id: "foundation",
    title: "الأساسات",
    status: "قيد التنفيذ",
    className: "active",
    progress: 65,
    start: "2026-04-01",
    end: "2026-05-15",
    description:
      "حفر الأرض وتجهيز الأساسات الخرسانية مع أعمال التسوية.",
  },
  {
    id: "concrete",
    title: "أعمال الخرسانة",
    status: "قادم",
    className: "complete",
    progress: 100,
    start: "2026-05-16",
    end: "2026-07-31",
    description:
      "صب الخرسانة للأساسات والأعمدة مع أعمال التسليح.",
  },
  {
    id: "walls",
    title: "أعمال المباني",
    status: "قادم",
    className: "complete",
    progress: 100,
    start: "2026-08-01",
    end: "2026-10-31",
    description:
      "بناء الهيكل الخرساني للطوابق والأعمدة مع أعمال الطوب.",
  },
  {
    id: "finishing",
    title: "التشطيبات",
    status: "قادم",
    className: "complete",
    progress: 100,
    start: "2026-11-01",
    end: "2027-02-28",
    description:
      "أعمال التشطيبات الداخلية والخارجية مع التركيبات.",
  },
  {
    id: "exterior",
    title: "الواجهة",
    status: "قادم",
    className: "complete",
    progress: 100,
    start: "2027-03-01",
    end: "2027-05-31",
    description:
      "تشطيب الواجهات الخارجية مع الألوان والزجاج.",
  },
  {
    id: "delivery",
    title: "التسليم",
    status: "قادم",
    className: "complete",
    progress: 100,
    start: "2027-06-01",
    end: "2027-06-30",
    description:
      "التسليم النهائي للوحدات والاستلام من المالكين.",
  },
  {
    id: "upcoming",
    title: "المراجعات النهائية",
    status: "قادم",
    className: "upcoming",
    progress: 0,
    start: "2026-11-01",
    end: "2026-11-12",
    description:
      "المراجعات النهائية وتسليم الوحدات وفق الجدول المعتمد للمشروع.",
  },
];

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { API_BASE_URL, project, stages };
}
