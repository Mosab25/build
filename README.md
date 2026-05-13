# منصة إدارة حجوزات أرض عبدالجليل

نظام عقاري عربي RTL لإدارة الوحدات، العملاء، الدفعات، الأقساط، الديلات، العقود، الإيصالات، التحديثات المنشورة، وسجل نشاط الإدارة.

## حالة قاعدة البيانات الحالية

النسخة الحالية تعمل الآن على **PostgreSQL فقط** عبر المتغير:

```text
DATABASE_URL
```

تم إيقاف الاعتماد على SQLite داخل `server.py`. ملف `reservation_system.sqlite3` تم نقله إلى الأرشيف كنسخة قديمة فقط، ولا يتم استخدامه في التشغيل الحالي.

> مهم: لن يعمل السيرفر إذا لم يتم ضبط `DATABASE_URL` في ملف `.env` أو في متغيرات بيئة النظام.

## التشغيل المحلي مع PostgreSQL

1. ثبّت الاعتمادات:

```powershell
python -m pip install -r requirements.txt
```

2. أنشئ قاعدة PostgreSQL محلية، مثال:

```sql
CREATE DATABASE real_estate;
```

أو شغّل PostgreSQL عبر Docker بعد فتح Docker Desktop:

```powershell
docker compose up -d postgres
```

3. أنشئ ملف `.env` في جذر المشروع وضع فيه:

```text
DATABASE_URL=postgresql://postgres:postgres@localhost:5433/real_estate
```

4. شغّل السيرفر. سيقوم `server.py` بإنشاء الجداول وبذر 21 شقة وحساب المالك تلقائيًا عند التشغيل الأول:

```powershell
python server.py
```

يمكن تشغيل تهيئة PostgreSQL والبذر بشكل مستقل عند الحاجة:

```powershell
python schema.py
python scripts/seed_postgresql.py
```

ثم افتح:

```text
http://127.0.0.1:8000
```

## إعادة ضبط حساب المالك محليًا

لو بيانات الدخول لا تعمل على PostgreSQL أو أردت إعادة ضبط حساب المالك، استخدم:

```powershell
python reset_owner_password.py
```

بيانات الدخول المحلية بعد إعادة الضبط:

- البريد الإلكتروني: `admin@example.com`
- كلمة المرور: `Admin@12345`
- الدور: `owner`

> غيّر بيانات الدخول الافتراضية قبل أي تشغيل فعلي أو نشر عام.

## بنية الواجهة

- `index.html`: واجهة تشغيل نظيفة بدون CSS أو JavaScript مدمج.
- `static/css/`: نظام التصميم وتقسيمات العام، العميل، الإدارة، المساعد، المعرض، وRTL.
- `static/js/api.js`: طبقة API مركزية لكل طلبات النظام.
- `static/js/`: وحدات الواجهة حسب المجال مثل العميل، الإدارة، المساعد، الديلات، العقود، الإعدادات، وسجل النشاط.
- `legacy-frontend/unstable-2026-05-13/`: نسخة الواجهة السابقة محفوظة للرجوع فقط.

## الأدوار

- `owner`: الموافقات، العقود النهائية، الإعدادات، سجل النشاط، التقارير، الإدارة الكاملة.
- `admin`: تشغيل العملاء، الشقق، المدفوعات، العقود، التحديثات، والتقارير حسب الصلاحيات.
- `assistant`: إنشاء ديلات، إرسالها للموافقة، إصدار عقد مسودة، وعرض ديلاته فقط.
- `client`: الدخول بكود الحجز وعرض بياناته فقط.

## Workflow الشقق والديلات

حالات الشقة الأساسية:

```text
available → pending_approval → reserved → sold
```

حالات إضافية:

```text
pending_payment
frozen
```

- عند إرسال المساعد للديل: تتحول الشقة إلى `pending_approval`.
- عند موافقة المالك: تتحول إلى `reserved`.
- عند إصدار العقد النهائي/الإنهاء: تتحول إلى `sold`.
- عند الرفض: تعود إلى `available` إذا لم يوجد عميل أو ديل نشط آخر.

## أهم المسارات

- `POST /api/client/verify-code`
- `GET /api/public/overview`
- `GET /api/project-updates/published`
- `POST /api/admin/login`
- `GET /api/admin/bootstrap`
- `POST /api/admin/deals`
- `POST /api/admin/deals/<id>/submit`
- `POST /api/admin/deals/<id>/approve`
- `GET /api/admin/contracts`
- `POST /api/admin/contracts/generate`
- `GET /api/admin/export/<kind>`
- `POST /api/admin/uploads/project-update-media`

## الملفات التي لا يفضل رفعها للإنتاج

أضفها إلى `.gitignore` في بيئة النشر:

```text
.env
generated/
uploads/
__pycache__/
*.pyc
*.sqlite3
```

## ملاحظات تشغيلية

- يتم بذر 21 شقة تلقائيًا إذا لم تكن موجودة.
- ملفات PDF وExcel تنشأ عند الطلب داخل `generated/`.
- صور وفيديوهات المشروع الفعلية يجب أن تكون داخل `media/` بالمسارات:
  - `media/facade.jpg`
  - `media/apartment-1.jpg`
  - `media/apartment-2.jpg`
  - `media/apartment-3.jpg`
  - `media/project-video.mp4`
