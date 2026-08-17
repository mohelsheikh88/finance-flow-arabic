import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";
import { supabaseAdmin } from "@/integrations/supabase/admin.self.server";

const CreateCompanySchema = z.object({
  code: z.string().min(1).max(50),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  vat_number: z.string().max(50).optional().nullable(),
  cr_number: z.string().max(50).optional().nullable(),
  address_ar: z.string().max(500).optional().nullable(),
  address_en: z.string().max(500).optional().nullable(),
  phone: z.string().max(50).optional().nullable(),
  email: z.string().email().max(255).optional().nullable(),
  default_currency: z.string().length(3).default("SAR"),
  branch_name_ar: z.string().min(1).max(255),
  branch_name_en: z.string().min(1).max(255),
  branch_code: z.string().min(1).max(50),
  seedDefaults: z.boolean().default(true),
});

// Default chart of accounts seed (Saudi-friendly)
const DEFAULT_ACCOUNTS = [
  { code: "1", name_ar: "الأصول", name_en: "Assets", type: "asset", is_group: true, parent: null },
  { code: "11", name_ar: "الأصول المتداولة", name_en: "Current Assets", type: "asset", is_group: true, parent: "1" },
  { code: "1101", name_ar: "النقدية في الصندوق", name_en: "Cash on Hand", type: "asset", is_group: false, parent: "11" },
  { code: "1102", name_ar: "النقدية في البنوك", name_en: "Cash at Banks", type: "asset", is_group: false, parent: "11" },
  { code: "1103", name_ar: "العملاء (الذمم المدينة)", name_en: "Accounts Receivable", type: "asset", is_group: false, parent: "11", reconcilable: true },
  { code: "1104", name_ar: "ضريبة القيمة المضافة المسددة", name_en: "VAT Receivable", type: "asset", is_group: false, parent: "11" },
  { code: "12", name_ar: "الأصول الثابتة", name_en: "Fixed Assets", type: "asset", is_group: true, parent: "1" },
  { code: "1201", name_ar: "الأصول الثابتة - تكلفة", name_en: "Fixed Assets - Cost", type: "asset", is_group: false, parent: "12" },
  { code: "1202", name_ar: "مجمع إهلاك الأصول الثابتة", name_en: "Accumulated Depreciation", type: "asset", is_group: false, parent: "12" },
  { code: "2", name_ar: "الخصوم", name_en: "Liabilities", type: "liability", is_group: true, parent: null },
  { code: "21", name_ar: "الخصوم المتداولة", name_en: "Current Liabilities", type: "liability", is_group: true, parent: "2" },
  { code: "2101", name_ar: "الموردين (الذمم الدائنة)", name_en: "Accounts Payable", type: "liability", is_group: false, parent: "21", reconcilable: true },
  { code: "2102", name_ar: "ضريبة القيمة المضافة المستحقة", name_en: "VAT Payable", type: "liability", is_group: false, parent: "21" },
  { code: "22", name_ar: "القروض طويلة الأجل", name_en: "Long-term Loans", type: "liability", is_group: true, parent: "2" },
  { code: "2201", name_ar: "قروض البنوك", name_en: "Bank Loans", type: "liability", is_group: false, parent: "22" },
  { code: "3", name_ar: "حقوق الملكية", name_en: "Equity", type: "equity", is_group: true, parent: null },
  { code: "3101", name_ar: "رأس المال", name_en: "Capital", type: "equity", is_group: false, parent: "3" },
  { code: "3102", name_ar: "الأرباح المحتجزة", name_en: "Retained Earnings", type: "equity", is_group: false, parent: "3" },
  { code: "4", name_ar: "الإيرادات", name_en: "Income", type: "income", is_group: true, parent: null },
  { code: "4101", name_ar: "إيرادات المبيعات", name_en: "Sales Revenue", type: "income", is_group: false, parent: "4" },
  { code: "4102", name_ar: "إيرادات الخدمات", name_en: "Service Revenue", type: "income", is_group: false, parent: "4" },
  { code: "5", name_ar: "المصروفات", name_en: "Expenses", type: "expense", is_group: true, parent: null },
  { code: "51", name_ar: "تكلفة المبيعات", name_en: "Cost of Sales", type: "expense", is_group: true, parent: "5" },
  { code: "5101", name_ar: "تكلفة البضاعة المباعة", name_en: "Cost of Goods Sold", type: "expense", is_group: false, parent: "51" },
  { code: "52", name_ar: "المصروفات التشغيلية", name_en: "Operating Expenses", type: "expense", is_group: true, parent: "5" },
  { code: "5201", name_ar: "رواتب وأجور", name_en: "Salaries & Wages", type: "expense", is_group: false, parent: "52" },
  { code: "5202", name_ar: "إيجارات", name_en: "Rent", type: "expense", is_group: false, parent: "52" },
  { code: "5203", name_ar: "مصروف إهلاك", name_en: "Depreciation Expense", type: "expense", is_group: false, parent: "52" },
  { code: "5204", name_ar: "فوائد قروض", name_en: "Interest Expense", type: "expense", is_group: false, parent: "52" },
] as const;

export const createCompanyWithSetup = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) => CreateCompanySchema.parse(input))
  .handler(async ({ data, context }) => {
    const { userId } = context;
    // Only admin can create companies
    const { data: roles } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const isAdmin = roles?.some((r) => r.role === "admin");
    if (!isAdmin) throw new Error("Only administrators can create companies.");

    // 1. Create company
    const { data: company, error: cErr } = await supabaseAdmin
      .from("companies")
      .insert({
        code: data.code,
        name_ar: data.name_ar,
        name_en: data.name_en,
        vat_number: data.vat_number,
        cr_number: data.cr_number,
        address_ar: data.address_ar,
        address_en: data.address_en,
        phone: data.phone,
        email: data.email,
        default_currency: data.default_currency,
      })
      .select()
      .single();
    if (cErr || !company) throw new Error(cErr?.message ?? "Failed to create company");

    // 2. Create main branch
    const { data: branch, error: bErr } = await supabaseAdmin
      .from("branches")
      .insert({
        company_id: company.id,
        code: data.branch_code,
        name_ar: data.branch_name_ar,
        name_en: data.branch_name_en,
        is_main: true,
      })
      .select()
      .single();
    if (bErr || !branch) throw new Error(bErr?.message ?? "Failed to create branch");

    // 3. Grant admin branch access
    await supabaseAdmin.from("user_branch_access").insert({ user_id: userId, branch_id: branch.id });

    // 4. Update profile default
    await supabaseAdmin
      .from("profiles")
      .update({ default_company_id: company.id, default_branch_id: branch.id })
      .eq("id", userId);

    if (!data.seedDefaults) {
      return { company, branch };
    }

    // 5. Seed chart of accounts
    const accountIdsByCode = new Map<string, string>();
    for (const a of DEFAULT_ACCOUNTS) {
      const parentId = a.parent ? accountIdsByCode.get(a.parent) ?? null : null;
      const { data: row, error } = await supabaseAdmin
        .from("accounts")
        .insert({
          company_id: company.id,
          code: a.code,
          name_ar: a.name_ar,
          name_en: a.name_en,
          account_type: a.type,
          is_group: a.is_group,
          parent_id: parentId,
          is_reconcilable: "reconcilable" in a ? (a as any).reconcilable : false,
          currency_code: data.default_currency,
        })
        .select("id")
        .single();
      if (error) throw new Error(`COA seed: ${error.message}`);
      accountIdsByCode.set(a.code, row!.id);
    }

    // 6. Seed VAT tax (15% Saudi)
    const vatPayableId = accountIdsByCode.get("2102");
    await supabaseAdmin.from("taxes").insert([
      { company_id: company.id, code: "VAT15-SALE", name_ar: "ضريبة القيمة المضافة 15% - مبيعات", name_en: "VAT 15% - Sales", rate: 0.15, tax_type: "sale", account_id: vatPayableId ?? null },
      { company_id: company.id, code: "VAT15-PURCHASE", name_ar: "ضريبة القيمة المضافة 15% - مشتريات", name_en: "VAT 15% - Purchase", rate: 0.15, tax_type: "purchase", account_id: accountIdsByCode.get("1104") ?? null },
      { company_id: company.id, code: "VAT0", name_ar: "ضريبة صفرية", name_en: "Zero-rated", rate: 0, tax_type: "sale", account_id: null },
    ]);

    // 7. Seed journals
    await supabaseAdmin.from("journals").insert([
      { company_id: company.id, code: "SALE", name_ar: "دفتر المبيعات", name_en: "Sales Journal", journal_type: "sales", sequence_prefix: "INV", currency_code: data.default_currency },
      { company_id: company.id, code: "PUR", name_ar: "دفتر المشتريات", name_en: "Purchase Journal", journal_type: "purchase", sequence_prefix: "BILL", currency_code: data.default_currency },
      { company_id: company.id, code: "BANK", name_ar: "دفتر البنك", name_en: "Bank Journal", journal_type: "bank", sequence_prefix: "BNK", currency_code: data.default_currency, default_debit_account_id: accountIdsByCode.get("1102") ?? null, default_credit_account_id: accountIdsByCode.get("1102") ?? null },
      { company_id: company.id, code: "CASH", name_ar: "دفتر الصندوق", name_en: "Cash Journal", journal_type: "cash", sequence_prefix: "CSH", currency_code: data.default_currency, default_debit_account_id: accountIdsByCode.get("1101") ?? null, default_credit_account_id: accountIdsByCode.get("1101") ?? null },
      { company_id: company.id, code: "MISC", name_ar: "قيود متنوعة", name_en: "Miscellaneous", journal_type: "misc", sequence_prefix: "JV", currency_code: data.default_currency },
    ]);

    // 8. Seed payment terms
    await supabaseAdmin.from("payment_terms").insert([
      { company_id: company.id, name_ar: "نقدي", name_en: "Immediate Payment", days: 0 },
      { company_id: company.id, name_ar: "صافي 15 يوم", name_en: "Net 15", days: 15 },
      { company_id: company.id, name_ar: "صافي 30 يوم", name_en: "Net 30", days: 30 },
      { company_id: company.id, name_ar: "صافي 60 يوم", name_en: "Net 60", days: 60 },
    ]);

    // 9. Seed current fiscal year period
    const now = new Date();
    const yr = now.getFullYear();
    await supabaseAdmin.from("fiscal_periods").insert({
      company_id: company.id,
      name: `FY ${yr}`,
      date_from: `${yr}-01-01`,
      date_to: `${yr}-12-31`,
      status: "open",
    });

    return { company, branch };
  });

export const listMyCompanies = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase } = context;
    const { data, error } = await supabase
      .from("companies")
      .select("id, code, name_ar, name_en, default_currency, is_active")
      .eq("is_active", true)
      .order("name_en");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listMyBranches = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { companyId?: string }) => input)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("branches")
      .select("id, company_id, code, name_ar, name_en, is_main, is_active")
      .eq("is_active", true);
    if (data.companyId) q = q.eq("company_id", data.companyId);
    const { data: rows, error } = await q.order("is_main", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role, company_id").eq("user_id", userId),
    ]);
    return { profile, roles: roles ?? [], userId };
  });
