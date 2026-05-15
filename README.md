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

## Render + Neon (First Run)

1. ارفع ملفات الوسائط الأساسية داخل `media/` إلى GitHub، وهي:
   - `media/facade.jpg`
   - `media/apartment-1.jpg`
   - `media/apartment-2.jpg`
   - `media/apartment-3.jpg`
   - `media/project-video.mp4`
2. اترك `uploads/` و`generated/` خارج GitHub لأنها ملفات تشغيلية تنشأ أثناء العمل فقط.
3. في Render اضبط متغيرات البيئة:

```text
APP_ENV=production
SECRET_KEY=<strong-random-secret>
DATABASE_URL=<your-neon-connection-string>
```

4. استخدم Build Command:

```text
python -m pip install -r requirements.txt
```

5. استخدم Start Command الآمن التالي:

```text
python scripts/prepare_production.py && gunicorn -c gunicorn.conf.py server:app
```

6. في أول تشغيل سيتم:
   - إنشاء كل الجداول تلقائيًا
   - إنشاء حساب المالك الافتراضي إذا لم يكن موجودًا
   - إنشاء 21 شقة إذا كانت القاعدة فارغة
   - إنشاء الإعدادات الافتراضية

7. بيانات الدخول الافتراضية لأول تشغيل:
   - البريد الإلكتروني: `admin@example.com`
   - كلمة المرور: `Admin@12345`

> غيّر بيانات الدخول الافتراضية مباشرة بعد أول تسجيل دخول على بيئة الإنتاج.

## Render - إعداد خطة مجانية باستخدام متغيرات البيئة

إذا كنت تستخدم خطة Render مجانية بدون Shell access، استخدم bootstrap environment variables لإنشاء حساب المالك تلقائيًا:

### الخطوات:

1. في Render أضف متغيرات البيئة التالية بالإضافة إلى المتغيرات أعلاه:

```text
BOOTSTRAP_OWNER=true
OWNER_EMAIL=mosabhassan025@gmail.com
OWNER_PASSWORD=<strong-password-from-render-env>
OWNER_NAME=مصعب حسن
```

2. استخدم **Start Command** المرة واحدة فقط:

```text
python scripts/prepare_production.py && gunicorn -c gunicorn.conf.py server:app
```

3. عند التشغيل الأول:
   - النظام سيقرأ `BOOTSTRAP_OWNER=true`
   - سيتحقق من `OWNER_EMAIL` و `OWNER_PASSWORD`
   - سينشئ أو يحدّث حساب المالك برقم `OWNER_EMAIL`
   - إذا كان الحساب موجودًا، سيحدّث كلمة المرور والبيانات
   - لن يطبع كلمة المرور أو أي بيانات حساسة في السجلات

### بعد أول تسجيل دخول ناجح:

4. **أزل أو عطّل Bootstrap** بتعديل متغيرات البيئة في Render:
   - أزل `BOOTSTRAP_OWNER` أو اضبطه إلى `false`
   - هذا يضمن عدم استبدال حساب المالك في المرات القادمة

5. غيّر كلمة المرور من داخل الواجهة (POST `/api/admin/change-password`)

### ملاحظات أمان:

- ✅ كلمة المرور لا تُطبع في السجلات
- ✅ يتم تجزئتها بـ PBKDF2-SHA256 مع salt عشوائي
- ✅ لا توجد نقاط نهاية عامة لـ bootstrap
- ✅ بيانات الدخول الافتراضية آمنة بعد إزالة `BOOTSTRAP_OWNER`
- ❌ تأكد من عدم حفظ `OWNER_PASSWORD` أو أي كلمات مرور في كود المشروع

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

> ملاحظة: لا تضف `media/` إلى `.gitignore` لأن الصفحة العامة تعتمد على هذه الملفات مباشرة.

## ملاحظات تشغيلية

- يتم بذر 21 شقة تلقائيًا إذا لم تكن موجودة.
- يتم استدعاء `init_db()` تلقائيًا عند إقلاع التطبيق، بما في ذلك التشغيل عبر `gunicorn` على Render.
- ملفات PDF وExcel تنشأ عند الطلب داخل `generated/`.
- مجلد `uploads/` ينشأ تلقائيًا وقت التشغيل ولا يلزم وجوده مسبقًا داخل GitHub.
- صور وفيديوهات المشروع الفعلية يجب أن تكون داخل `media/` بالمسارات:
  - `media/facade.jpg`
  - `media/apartment-1.jpg`
  - `media/apartment-2.jpg`
  - `media/apartment-3.jpg`
  - `media/project-video.mp4`
