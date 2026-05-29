import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type Bucket = "asset" | "liability" | "equity" | "income" | "expense";
type Statement = "balance_sheet" | "income_statement";
type NormalBalance = "debit" | "credit";

type AcctRow = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  account_type: Bucket; // legacy enum (kept for back-compat)
  classification_id: string | null;
  classification_code: string | null;
  classification_name_ar: string | null;
  classification_name_en: string | null;
  statement: Statement;
  normal_balance: NormalBalance;
  bucket: Bucket;
  balance: number;
};

/**
 * Build a map of account_id -> classification metadata (statement, normal_balance, bucket).
 * Resolves directly via accounts.classification_id, falling back to the legacy account_type
 * bucket text when an older account has no classification linkage yet.
 */
async function buildAccountClassificationMap(supabase: any, companyId: string) {
  const [{ data: classifications }, { data: accounts }] = await Promise.all([
    supabase
      .from("classifications")
      .select("id, code, name_ar, name_en, statement, normal_balance, bucket, sort_order, is_active")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
    supabase
      .from("accounts")
      .select("id, classification_id, account_type")
      .eq("company_id", companyId),
  ]);

  const clsList = (classifications ?? []) as any[];
  const clsById = new Map<string, any>();
  clsList.forEach((c: any) => clsById.set(c.id, c));

  // Fallback: pick a default classification per bucket (first one matching) for legacy accounts.
  const clsByBucket = new Map<Bucket, any>();
  clsList.forEach((c: any) => {
    if (!clsByBucket.has(c.bucket)) clsByBucket.set(c.bucket, c);
  });

  const accountInfo = new Map<string, any>();
  for (const a of accounts ?? []) {
    let cls: any = null;
    if (a.classification_id) cls = clsById.get(a.classification_id) ?? null;
    if (!cls) cls = clsByBucket.get(a.account_type as Bucket) ?? null;

    const bucket: Bucket = (cls?.bucket ?? a.account_type) as Bucket;
    const statement: Statement = (cls?.statement ??
      (bucket === "asset" || bucket === "liability" || bucket === "equity" ? "balance_sheet" : "income_statement")) as Statement;
    const normal_balance: NormalBalance = (cls?.normal_balance ??
      (bucket === "asset" || bucket === "expense" ? "debit" : "credit")) as NormalBalance;

    accountInfo.set(a.id, {
      classification_id: cls?.id ?? null,
      classification_code: cls?.code ?? null,
      classification_name_ar: cls?.name_ar ?? null,
      classification_name_en: cls?.name_en ?? null,
      statement,
      normal_balance,
      bucket,
    });
  }
  return { accountInfo, classifications: clsList };
}



async function getAccountBalances(
  supabase: any,
  companyId: string,
  dateFrom: string | null,
  dateTo: string,
): Promise<{ rows: AcctRow[]; classifications: any[] }> {
  const { accountInfo, classifications } = await buildAccountClassificationMap(supabase, companyId);

  let q = supabase
    .from("journal_entry_lines")
    .select(
      "debit, credit, accounts!inner(id, code, name_ar, name_en, account_type, company_id, is_group), journal_entries!inner(entry_date, status, company_id)",
    )
    .eq("journal_entries.status", "posted")
    .eq("journal_entries.company_id", companyId)
    .eq("accounts.is_group", false)
    .lte("journal_entries.entry_date", dateTo);
  if (dateFrom) q = q.gte("journal_entries.entry_date", dateFrom);
  const { data: rows, error } = await q;
  if (error) throw new Error(error.message);

  const map = new Map<string, AcctRow>();
  for (const r of rows ?? []) {
    const a = (r as any).accounts;
    const info = accountInfo.get(a.id) ?? {
      classification_id: null,
      classification_code: null,
      classification_name_ar: null,
      classification_name_en: null,
      statement: a.account_type === "asset" || a.account_type === "liability" || a.account_type === "equity"
        ? "balance_sheet" : "income_statement",
      normal_balance: a.account_type === "asset" || a.account_type === "expense" ? "debit" : "credit",
      bucket: a.account_type,
    };
    const cur = map.get(a.id) ?? {
      id: a.id,
      code: a.code,
      name_ar: a.name_ar,
      name_en: a.name_en,
      account_type: a.account_type,
      ...info,
      balance: 0,
    };
    const delta = Number(r.debit) - Number(r.credit);
    cur.balance += info.normal_balance === "debit" ? delta : -delta;
    map.set(a.id, cur);
  }
  return {
    rows: Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code)),
    classifications,
  };
}

type Group = {
  classification_id: string | null;
  code: string | null;
  name_ar: string | null;
  name_en: string | null;
  bucket: Bucket;
  sort_order: number;
  accounts: AcctRow[];
  total: number;
};

/**
 * Build groups driven by the Core Classifications list itself.
 * - Every active classification matching the requested buckets appears as a group,
 *   even when it has no accounts yet (total = 0, accounts = []).
 * - Groups are ordered by classifications.sort_order then code.
 * - Accounts that fall back to a bucket without a classification get a synthetic group.
 */
function groupByClassification(
  rows: AcctRow[],
  buckets: Bucket[],
  classifications: any[],
): Group[] {
  const byKey = new Map<string, Group>();

  // 1) Seed groups from active classifications matching the requested buckets.
  const seedCls = classifications
    .filter((c) => c.is_active !== false && buckets.includes(c.bucket as Bucket));
  for (const c of seedCls) {
    byKey.set(c.id, {
      classification_id: c.id,
      code: c.code,
      name_ar: c.name_ar,
      name_en: c.name_en,
      bucket: c.bucket as Bucket,
      sort_order: typeof c.sort_order === "number" ? c.sort_order : 0,
      accounts: [],
      total: 0,
    });
  }

  // 2) Place account rows into their group; create fallback groups for accounts
  //    whose classification was inactive/missing.
  const filtered = rows.filter((r) => buckets.includes(r.bucket));
  for (const r of filtered) {
    const key = r.classification_id ?? `__bucket:${r.bucket}`;
    let g = byKey.get(key);
    if (!g) {
      g = {
        classification_id: r.classification_id,
        code: r.classification_code,
        name_ar: r.classification_name_ar,
        name_en: r.classification_name_en,
        bucket: r.bucket,
        sort_order: Number.MAX_SAFE_INTEGER,
        accounts: [],
        total: 0,
      };
      byKey.set(key, g);
    }
    g.accounts.push(r);
    g.total += r.balance;
  }

  return Array.from(byKey.values()).sort((a, b) => {
    if (a.sort_order !== b.sort_order) return a.sort_order - b.sort_order;
    return (a.code ?? "").localeCompare(b.code ?? "");
  });
}


export const getBalanceSheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; asOfDate: string }) => i)
  .handler(async ({ data, context }) => {
    const { rows, classifications } = await getAccountBalances(context.supabase, data.companyId, null, data.asOfDate);

    const bsRows = rows.filter((r) => r.statement === "balance_sheet");
    const isRows = rows.filter((r) => r.statement === "income_statement");

    const assets = bsRows.filter((r) => r.bucket === "asset");
    const liabilities = bsRows.filter((r) => r.bucket === "liability");
    const equity = bsRows.filter((r) => r.bucket === "equity");
    const income = isRows.filter((r) => r.bucket === "income");
    const expenses = isRows.filter((r) => r.bucket === "expense");

    const sum = (rs: AcctRow[]) => rs.reduce((s, r) => s + r.balance, 0);
    const totalAssets = sum(assets);
    const totalLiabilities = sum(liabilities);
    const totalEquity = sum(equity);
    const retainedEarnings = sum(income) - sum(expenses);

    return {
      asOf: data.asOfDate,
      assets,
      liabilities,
      equity,
      assetGroups: groupByClassification(bsRows, ["asset"], classifications),
      liabilityGroups: groupByClassification(bsRows, ["liability"], classifications),
      equityGroups: groupByClassification(bsRows, ["equity"], classifications),
      totals: {
        assets: totalAssets,
        liabilities: totalLiabilities,
        equity: totalEquity,
        retainedEarnings,
        equityAndLiabilities: totalLiabilities + totalEquity + retainedEarnings,
      },
    };
  });


export const getIncomeStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; dateFrom: string; dateTo: string }) => i)
  .handler(async ({ data, context }) => {
    const { rows, classifications } = await getAccountBalances(context.supabase, data.companyId, data.dateFrom, data.dateTo);

    const isRows = rows.filter((r) => r.statement === "income_statement");
    const income = isRows.filter((r) => r.bucket === "income");
    const expenses = isRows.filter((r) => r.bucket === "expense");

    const totalIncome = income.reduce((s, r) => s + r.balance, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.balance, 0);

    return {
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      income,
      expenses,
      incomeGroups: groupByClassification(isRows, ["income"], classifications),
      expenseGroups: groupByClassification(isRows, ["expense"], classifications),
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        netIncome: totalIncome - totalExpenses,
      },
    };
  });


// =====================================================
// Cash Flow Statement (Direct method, cash-account based)
// =====================================================

type CashFlowSection = "operating" | "investing" | "financing";

const SOURCE_TYPE_SECTION: Record<string, CashFlowSection> = {
  invoice: "operating",
  payment: "operating",
  journal_entry: "operating",
  manual: "operating",
  asset_disposal: "investing",
  asset_acquisition: "investing",
  fixed_asset: "investing",
  depreciation: "operating", // non-cash, but if posted to cash treat as op
  loan: "financing",
  loan_payment: "financing",
  loan_disbursement: "financing",
  capital: "financing",
  dividend: "financing",
};

function classifySource(src: string | null | undefined): CashFlowSection {
  if (!src) return "operating";
  return SOURCE_TYPE_SECTION[src] ?? "operating";
}

const SOURCE_LABELS: Record<string, { ar: string; en: string }> = {
  invoice: { ar: "الفواتير", en: "Invoices" },
  payment: { ar: "المدفوعات والتحصيلات", en: "Payments & Receipts" },
  journal_entry: { ar: "قيود يومية", en: "Journal Entries" },
  manual: { ar: "قيود يدوية", en: "Manual Entries" },
  asset_disposal: { ar: "بيع أصول ثابتة", en: "Asset Disposals" },
  asset_acquisition: { ar: "شراء أصول ثابتة", en: "Asset Acquisitions" },
  fixed_asset: { ar: "أصول ثابتة", en: "Fixed Assets" },
  depreciation: { ar: "إهلاك", en: "Depreciation" },
  loan: { ar: "القروض", en: "Loans" },
  loan_payment: { ar: "سداد قروض", en: "Loan Repayments" },
  loan_disbursement: { ar: "صرف قروض", en: "Loan Disbursements" },
  capital: { ar: "رأس المال", en: "Capital" },
  dividend: { ar: "توزيعات أرباح", en: "Dividends" },
  other: { ar: "أخرى", en: "Other" },
};

export const getCashFlowStatement = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; dateFrom: string; dateTo: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { companyId, dateFrom, dateTo } = data;

    // 1) Identify cash & bank GL accounts for the company
    const { data: bankRows } = await supabase
      .from("bank_accounts")
      .select("gl_account_id, name_ar, name_en, code, currency_code")
      .eq("company_id", companyId)
      .eq("is_active", true);

    const cashAccountIds = (bankRows ?? [])
      .map((b: any) => b.gl_account_id)
      .filter(Boolean) as string[];

    if (cashAccountIds.length === 0) {
      return {
        dateFrom, dateTo,
        cashAccounts: [],
        openingCash: 0, closingCash: 0,
        sections: { operating: [], investing: [], financing: [] },
        totals: { operating: 0, investing: 0, financing: 0, netChange: 0 },
      };
    }

    // 2) Period cash movements grouped by source_type
    const { data: periodLines, error: e1 } = await supabase
      .from("journal_entry_lines")
      .select("debit, credit, account_id, journal_entries!inner(entry_date, status, source_type, company_id)")
      .in("account_id", cashAccountIds)
      .eq("journal_entries.status", "posted")
      .eq("journal_entries.company_id", companyId)
      .gte("journal_entries.entry_date", dateFrom)
      .lte("journal_entries.entry_date", dateTo);
    if (e1) throw new Error(e1.message);

    // 3) Opening cash = sum debit-credit BEFORE dateFrom
    const { data: openingLines, error: e2 } = await supabase
      .from("journal_entry_lines")
      .select("debit, credit, journal_entries!inner(entry_date, status, company_id)")
      .in("account_id", cashAccountIds)
      .eq("journal_entries.status", "posted")
      .eq("journal_entries.company_id", companyId)
      .lt("journal_entries.entry_date", dateFrom);
    if (e2) throw new Error(e2.message);

    const openingCash = (openingLines ?? []).reduce(
      (s: number, r: any) => s + Number(r.debit || 0) - Number(r.credit || 0),
      0,
    );

    // Group period lines by section + source_type
    type LineGroup = { key: string; section: CashFlowSection; inflow: number; outflow: number; net: number };
    const groups = new Map<string, LineGroup>();

    for (const r of periodLines ?? []) {
      const je = (r as any).journal_entries;
      const src = (je?.source_type ?? "other") as string;
      const section = classifySource(src);
      const debit = Number(r.debit || 0);
      const credit = Number(r.credit || 0);
      const key = `${section}::${src || "other"}`;
      const g = groups.get(key) ?? { key: src || "other", section, inflow: 0, outflow: 0, net: 0 };
      g.inflow += debit;
      g.outflow += credit;
      g.net += debit - credit;
      groups.set(key, g);
    }

    const sections = { operating: [] as LineGroup[], investing: [] as LineGroup[], financing: [] as LineGroup[] };
    const totals = { operating: 0, investing: 0, financing: 0, netChange: 0 };

    for (const g of groups.values()) {
      const label = SOURCE_LABELS[g.key] ?? SOURCE_LABELS.other;
      const entry: any = { ...g, name_ar: label.ar, name_en: label.en };
      sections[g.section].push(entry);
      totals[g.section] += g.net;
    }
    // Sort each section by absolute net desc
    (Object.keys(sections) as CashFlowSection[]).forEach((k) =>
      sections[k].sort((a, b) => Math.abs(b.net) - Math.abs(a.net)),
    );
    totals.netChange = totals.operating + totals.investing + totals.financing;

    return {
      dateFrom,
      dateTo,
      cashAccounts: bankRows ?? [],
      openingCash,
      closingCash: openingCash + totals.netChange,
      sections,
      totals,
    };
  });

