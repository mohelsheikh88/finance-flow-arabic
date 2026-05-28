import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

type AcctRow = {
  id: string; code: string; name_ar: string; name_en: string;
  account_type: "asset" | "liability" | "equity" | "income" | "expense";
  balance: number;
};

async function getAccountBalances(supabase: any, companyId: string, dateFrom: string | null, dateTo: string): Promise<AcctRow[]> {
  let q = supabase
    .from("journal_entry_lines")
    .select("debit, credit, accounts!inner(id, code, name_ar, name_en, account_type, company_id, is_group), journal_entries!inner(entry_date, status, company_id)")
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
    const cur = map.get(a.id) ?? { id: a.id, code: a.code, name_ar: a.name_ar, name_en: a.name_en, account_type: a.account_type, balance: 0 };
    const delta = Number(r.debit) - Number(r.credit);
    // For asset/expense, balance is debit positive. For liability/equity/income, credit positive (so flip).
    cur.balance += (a.account_type === "asset" || a.account_type === "expense") ? delta : -delta;
    map.set(a.id, cur);
  }
  return Array.from(map.values()).sort((a, b) => a.code.localeCompare(b.code));
}

export const getBalanceSheet = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; asOfDate: string }) => i)
  .handler(async ({ data, context }) => {
    const rows = await getAccountBalances(context.supabase, data.companyId, null, data.asOfDate);

    const assets = rows.filter((r) => r.account_type === "asset");
    const liabilities = rows.filter((r) => r.account_type === "liability");
    const equity = rows.filter((r) => r.account_type === "equity");
    const income = rows.filter((r) => r.account_type === "income");
    const expenses = rows.filter((r) => r.account_type === "expense");

    const totalAssets = assets.reduce((s, r) => s + r.balance, 0);
    const totalLiabilities = liabilities.reduce((s, r) => s + r.balance, 0);
    const totalEquity = equity.reduce((s, r) => s + r.balance, 0);
    const totalIncome = income.reduce((s, r) => s + r.balance, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.balance, 0);
    const retainedEarnings = totalIncome - totalExpenses; // current period profit

    return {
      asOf: data.asOfDate,
      assets,
      liabilities,
      equity,
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
    const rows = await getAccountBalances(context.supabase, data.companyId, data.dateFrom, data.dateTo);

    const income = rows.filter((r) => r.account_type === "income");
    const expenses = rows.filter((r) => r.account_type === "expense");

    const totalIncome = income.reduce((s, r) => s + r.balance, 0);
    const totalExpenses = expenses.reduce((s, r) => s + r.balance, 0);

    return {
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      income,
      expenses,
      totals: {
        income: totalIncome,
        expenses: totalExpenses,
        netIncome: totalIncome - totalExpenses,
      },
    };
  });
