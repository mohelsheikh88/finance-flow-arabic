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
 * Build a map of account_id -> classification metadata (statement, normal_balance, bucket)
 * by resolving accounts -> account_types -> classifications. Falls back to the legacy
 * account_type enum when an account has no classification linkage yet.
 */
async function buildAccountClassificationMap(supabase: any, companyId: string) {
  const [{ data: classifications }, { data: accountTypes }, { data: accounts }] = await Promise.all([
    supabase
      .from("classifications")
      .select("id, code, name_ar, name_en, statement, normal_balance, bucket, sort_order, is_active")
      .eq("company_id", companyId)
      .order("sort_order", { ascending: true })
      .order("code", { ascending: true }),
    supabase
      .from("account_types")
      .select("id, classification_id, classification")
      .eq("company_id", companyId),
    supabase
      .from("accounts")
      .select("id, account_type_id, account_type")
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

  const typeById = new Map<string, any>();
  (accountTypes ?? []).forEach((t: any) => typeById.set(t.id, t));

  const accountInfo = new Map<string, any>();
  for (const a of accounts ?? []) {
    let cls: any = null;
    if (a.account_type_id) {
      const at = typeById.get(a.account_type_id);
      if (at?.classification_id) cls = clsById.get(at.classification_id) ?? null;
      if (!cls && at?.classification) cls = clsByBucket.get(at.classification as Bucket) ?? null;
    }
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

