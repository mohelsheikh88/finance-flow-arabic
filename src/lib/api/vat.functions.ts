import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listTaxes = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("taxes")
      .select("*")
      .eq("company_id", data.companyId)
      .order("code");
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

/**
 * Saudi VAT report (ZATCA aligned).
 * Computes Output VAT (sales) and Input VAT (purchases) by inspecting
 * journal_entry_lines where tax_id is set, grouped by tax_type.
 * Returns base amounts (net) and VAT amounts.
 */
export const getVatReport = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string; dateFrom: string; dateTo: string }) => i)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // Pull all posted entry lines in range with tax info
    const { data: rows, error } = await supabase
      .from("journal_entry_lines")
      .select(
        `debit, credit,
         taxes!inner(id, code, name_ar, name_en, rate, tax_type),
         journal_entries!inner(entry_date, status, company_id)`,
      )
      .eq("journal_entries.status", "posted")
      .eq("journal_entries.company_id", data.companyId)
      .gte("journal_entries.entry_date", data.dateFrom)
      .lte("journal_entries.entry_date", data.dateTo);

    if (error) throw new Error(error.message);

    const output = { base: 0, vat: 0 }; // sales (output VAT)
    const input = { base: 0, vat: 0 };  // purchases (input VAT)
    const breakdown: Array<{
      tax_id: string; code: string; name_ar: string; name_en: string;
      rate: number; type: string; vat: number; base: number;
    }> = [];
    const map = new Map<string, (typeof breakdown)[number]>();

    for (const r of rows ?? []) {
      const tax = (r as any).taxes;
      const debit = Number(r.debit);
      const credit = Number(r.credit);
      // The tax line itself sits on the VAT control account.
      // For sales (output VAT) the tax is on the CREDIT side.
      // For purchases (input VAT) the tax is on the DEBIT side.
      const vatAmount = tax.tax_type === "sale" ? credit - debit : debit - credit;
      if (vatAmount <= 0) continue;
      const rate = Number(tax.rate) || 0;
      const baseAmount = rate > 0 ? (vatAmount * 100) / rate : 0;

      const cur = map.get(tax.id) ?? {
        tax_id: tax.id, code: tax.code, name_ar: tax.name_ar, name_en: tax.name_en,
        rate, type: tax.tax_type, vat: 0, base: 0,
      };
      cur.vat += vatAmount;
      cur.base += baseAmount;
      map.set(tax.id, cur);

      if (tax.tax_type === "sale") {
        output.vat += vatAmount;
        output.base += baseAmount;
      } else {
        input.vat += vatAmount;
        input.base += baseAmount;
      }
    }

    return {
      dateFrom: data.dateFrom,
      dateTo: data.dateTo,
      output,
      input,
      net: { vat: output.vat - input.vat },
      breakdown: Array.from(map.values()),
    };
  });
