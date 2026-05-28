
# خطة بناء ERP — المرحلة الأولى (Foundation + Accounting & Finance)

## ملاحظة مهمة عن النطاق
Odoo Enterprise = آلاف الساعات لفِرق محترفة. هنبني نسخة Production-grade لنفس الـ Functionality المطلوبة، لكن على مراحل قابلة للاختبار. الخطة دي بتغطي **المرحلة الأولى فقط** (المشتريات/المخازن/HR هتتعمل في خطط لاحقة).

---

## 1) الـ Foundation (الأساس متعدد الكيانات)

### إعدادات الشركة والفروع
- **Companies** (كيان أساسي) → **Branches** (فروع متعددة تحت نفس الكيان)
- بيانات السجل التجاري، الرقم الضريبي، العنوان، الشعار، العملة الافتراضية، التقويم (هجري/ميلادي)
- كل عملية مالية مربوطة بفرع، والتقارير تتعمل على مستوى الفرع أو مجمّعة

### المستخدمين والصلاحيات (شاشة منفصلة)
- **Users**: الأدمن الافتراضي `mohamed.elsheikh@alhayat.sa` بصلاحيات كاملة
- **Roles الجاهزة**: محاسب / رئيس حسابات / مدير حسابات / مدير مالي / مراجع داخلي / Admin
- **Permissions تفصيلية** على مستوى: الموديول → الكيان (Invoice, Payment, JE...) → العملية (View/Create/Edit/Post/Approve/Delete)
- **Branch-level access**: المستخدم يشوف فروع محددة فقط
- **Approval Workflow هرمي**:
  - تعريف Approval Rules حسب: نوع المستند + المبلغ + الفرع
  - سلسلة اعتماد متعددة المستويات (محاسب يقيد → رئيس حسابات يراجع → مدير مالي يعتمد)
  - Reject / Return-for-revision / Audit trail كامل لكل خطوة
  - إشعارات للمستخدم التالي في السلسلة

### اللغة والاتجاه
- AR/EN switcher + RTL/LTR كامل (i18n عبر `i18next`)
- كل المسميات والتقارير ثنائية اللغة

---

## 2) موديول الحسابات والمالية (Accounting & Finance)

### Partners (موحّد عملاء/موردين)
- شاشة Partner واحدة بـ tabs: General / Customer Account / Vendor Account / Contacts / Bank Accounts
- نفس الـ Partner ممكن يكون عميل ومورد في نفس الوقت (زي Odoo)
- شروط دفع، حدود ائتمان، حسابات GL افتراضية، Tax defaults

### دورة العملاء
- **فواتير المبيعات** (Customer Invoices) — Draft → Posted → Paid
- **إشعارات الإضافة** (Credit Notes)
- **التحصيلات** (Customer Payments) — Full/Partial، Multi-invoice allocation
- كل عملية → JE تلقائي للـ GL

### دورة الموردين
- **فواتير المشتريات** (Vendor Bills)
- **إشعارات الخصم** (Debit Notes)
- **السدادات** (Vendor Payments)

### البنوك
- Multiple Bank Accounts لكل شركة/فرع
- **وسائل دفع/تحصيل** متعددة (Cash, Bank Transfer, Check, Card...)
- **التسويات البنكية** (Bank Reconciliation): استيراد كشف البنك، Auto-match، Manual match
- المصادقات البنكية

### الأصول الثابتة (Fixed Assets)
- تسجيل الأصل، فئات الأصول، طرق الإهلاك (قسط ثابت/متناقص)
- جدول الإهلاك التلقائي + JE شهري للإهلاك
- التخلص/البيع/إعادة التقييم

### القروض والتمويلات (Loans)
- تسجيل القرض، جدول السداد (Amortization schedule)
- توليد قيود السداد التلقائية (أصل + فوائد)
- متابعة الأرصدة المتبقية

### دفتر الأستاذ والقيود (General Ledger)
- **شجرة حسابات هرمية** بلا حدود مستويات + أنواع حسابات (Asset/Liability/Equity/Income/Expense)
- **Manual Journal Entries** بـ multi-line debit/credit مع validation (D=C)
- **Journals** متعددة (Sales/Purchase/Bank/Cash/Misc)
- **مراكز التكلفة** (Cost Centers) هرمية بلا حدود مستويات، تُربط بكل سطر قيد
- **Multi-currency** مع قيود فروقات العملة
- **الفترات المالية** + قفل الفترات (Period close/lock)
- كل معاملة مالية في النظام → JE تلقائي يصل لميزان المراجعة (نمط Odoo/SAP)

### التقارير المالية
- ميزان المراجعة (Trial Balance) — على مستوى فرع/شركة/مجمّع
- الميزانية العمومية (Balance Sheet)
- قائمة الدخل (P&L) — على مستوى مراكز التكلفة
- كشف حساب Partner (Statement of Account)
- Aging Report (عملاء وموردين، فترات 30/60/90/120+)
- **تقرير ضريبة القيمة المضافة 15%** الشهري متوافق مع متطلبات ZATCA

### الإعدادات (Settings داخل الموديول)
- شجرة الحسابات + أنواع الحسابات
- مراكز التكلفة الهرمية
- شروط الدفع/التحصيل
- الحسابات البنكية
- الضرائب (VAT 15% + ضرائب أخرى قابلة للتعريف)
- العملات + أسعار الصرف
- الفترات المالية
- أنواع الدفاتر (Journals)

---

## 3) Dashboards
- **Dashboard عام**: KPIs مجمّعة (إيرادات، مصروفات، Cash position، المستحقات، أعلى عملاء/موردين)
- **Dashboard موديول الحسابات**: فواتير لم تُسدد، Aging، Bank balances، آخر القيود، الموافقات المعلّقة للمستخدم

---

## Technical Section (التفاصيل التقنية)

### Stack
- TanStack Start v1 (الموجود) + Tailwind v4 + shadcn
- **Lovable Cloud** (Supabase) للـ DB + Auth + RLS
- TanStack Query للـ data fetching، `createServerFn` لكل الـ business logic
- `i18next` + `react-i18next` للترجمة، `dir="rtl/ltr"` ديناميكي
- `@fontsource/ibm-plex-sans-arabic` + `@fontsource/inter` للخطوط
- `recharts` للـ dashboards، `@tanstack/react-table` للقوائم

### Database Schema (Highlights)
```text
companies → branches → (everything is branch-scoped)
user_roles (separate table, app_role enum)
permissions (module, entity, action) + role_permissions
approval_rules + approval_steps + approval_requests

partners (is_customer, is_vendor flags)
accounts (chart of accounts, parent_id for hierarchy)
cost_centers (parent_id for hierarchy)
journals, journal_entries, journal_entry_lines
  → كل JE line: account_id, cost_center_id, debit, credit, currency, fx_rate
fiscal_periods (status: open/closed/locked)
taxes, payment_terms, currencies, exchange_rates

invoices (type: customer/vendor, sales/credit_note/debit_note)
invoice_lines, payments, payment_allocations
bank_accounts, bank_statements, bank_reconciliations
fixed_assets, depreciation_schedules
loans, loan_repayment_schedules
```

### Security
- RLS على كل جدول؛ صلاحيات عبر `has_permission(user_id, module, entity, action)` security-definer function
- Branch isolation عبر `user_branch_access` table
- جميع الـ business logic في `createServerFn` مع `requireSupabaseAuth`
- Approval state machine محمي server-side

### Design Direction
هعمل **3 design directions** للـ ERP shell (Sidebar + Topbar + List/Form views) بالبنفسجي STC، تختار واحدة وأبني عليها.

### ترتيب التنفيذ داخل المرحلة 1
1. تفعيل Lovable Cloud + schema الأساسي (companies, branches, users, roles, permissions)
2. Auth + شاشة تسجيل دخول + إنشاء حساب الأدمن + شاشات الإعدادات العامة
3. شاشات Users & Roles & Permissions + Approval Workflow engine
4. 3 Design Directions → اختيار → بناء الـ Shell (Sidebar/Topbar/i18n/RTL)
5. Accounting Settings (CoA, Cost Centers, Journals, Taxes, Currencies, Periods, Payment Terms, Bank Accounts)
6. Partners + Customer cycle (Invoices, Credit Notes, Payments) + JE auto-posting
7. Vendor cycle (Bills, Debit Notes, Payments)
8. Bank module + Reconciliation
9. Fixed Assets + Depreciation
10. Loans
11. Manual JE + Trial Balance + GL inquiry
12. Financial Reports (TB, BS, P&L, Partner Statement, Aging, VAT)
13. Dashboards (general + accounting)

### اللي مش داخل في المرحلة 1 (هتتعمل لاحقاً)
- موديولات المشتريات/المخازن/HR
- ZATCA Phase 2 e-Invoicing (XML/QR) — يحتاج مرحلة منفصلة
- تطبيق Mobile
- استيراد بيانات من أنظمة سابقة (migration tools)

---

## السؤال التالي بعد الموافقة
هبدأ بتفعيل Lovable Cloud وأعمل الـ 3 design directions، وبعدها نكمل بالترتيب أعلاه.
