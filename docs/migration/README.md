# تشغيل النظام على حسابك الخاص (Self-hosting / Own Supabase)

هذه الحزمة تنقل مشروع **Al Hayat Financial ERP** من Lovable Cloud إلى بنية تحتية مملوكة لك.

## المحتويات
| الملف | الوصف |
|---|---|
| `01_schema_full.sql` | كل الـ migrations مجمّعة بالترتيب: الجداول، الـ enums، الدوال، التريجرات، الـ RLS، الـ GRANTs |
| `export_data.sh` | تصدير كل البيانات إلى ملفات CSV |
| `import_data.sh` | تحميل ملفات CSV إلى مشروعك الجديد |
| `env.example` | متغيّرات البيئة المطلوبة للتطبيق |

---

## الخطوات

### 1) خذ الكود على حسابك
من المحرر: زر **GitHub → Connect** ثم Create repository. الريبو يبقى ملكك بالكامل ويمكن استنساخه:
```bash
git clone https://github.com/<you>/<repo>.git && cd <repo> && npm install
```

### 2) أنشئ مشروع Supabase خاص بك
supabase.com → New project. سجّل:
- Project URL
- `anon` / publishable key
- `service_role` key
- Database connection string (Settings → Database)

### 3) طبّق الـ schema
```bash
psql "$TARGET_DATABASE_URL" -f docs/migration/01_schema_full.sql
```
ثم تأكد أن الجداول والـ RLS اتعملت:
```bash
psql "$TARGET_DATABASE_URL" -c "select tablename from pg_tables where schemaname='public' order by 1"
```

### 4) صدّر البيانات من النظام الحالي
اذهب في Lovable إلى **Cloud → Advanced settings → Export data** للحصول على نسخة البيانات،
أو شغّل السكربت لو عندك connection string للمصدر:
```bash
DATABASE_URL="<source-url>" bash docs/migration/export_data.sh ./export
```

### 5) حمّل البيانات في مشروعك
```bash
TARGET_DATABASE_URL="<your-url>" bash docs/migration/import_data.sh ./export
```

### 6) المستخدمون (auth.users)
جدول `profiles` و `user_roles` مربوطين بـ `auth.users`. الطريقة الموصى بها:
1. أنشئ المستخدمين في مشروعك عبر Supabase Auth Admin API بنفس الإيميلات.
2. عدّل `profiles.id` / `user_roles.user_id` لتطابق الـ UUID الجديدة، أو أنشئ المستخدمين بنفس الـ UUID القديمة عبر Admin API (`POST /auth/v1/admin/users` يقبل `id`).
> ملاحظة: كلمات المرور لا يمكن نقلها — استخدم دعوة/إعادة تعيين كلمة مرور.

### 7) التخزين (Storage)
أنشئ نفس الـ buckets (خاصة، غير عامة):
- `partner-attachments`
- `transaction-attachments`

ثم انقل الملفات عبر Supabase CLI أو سكربت بسيط يستخدم `storage.from(bucket).download/upload`.

### 8) متغيّرات البيئة
انسخ `env.example` إلى `.env` واملأ القيم من مشروعك.

### 9) التشغيل والنشر
```bash
npm run dev        # محلياً
npm run build      # إنتاج
```
التطبيق TanStack Start ويعمل على Cloudflare Workers / Vercel / Node adapter. اربط دومينك `erp.alhayat.enterprises` بالمزوّد الجديد بعد التأكد من عمل النظام.

---

## قائمة التحقق قبل التحويل النهائي
- [ ] عدد صفوف كل جدول مطابق بين المصدر والهدف
- [ ] ميزان المراجعة (Trial Balance) متوازن ونفس الأرقام
- [ ] تسجيل الدخول يعمل لكل المستخدمين
- [ ] صلاحيات الفروع والأدوار صحيحة
- [ ] المرفقات تُفتح وتُحمّل
- [ ] طباعة الفاتورة الضريبية بـ QR تعمل
