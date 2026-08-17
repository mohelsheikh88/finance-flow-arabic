import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";

const StatusEnum = z.enum(["open", "closed", "locked"]);

export const listFiscalPeriods = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => i)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("fiscal_periods")
      .select("*")
      .eq("company_id", data.companyId)
      .order("date_from", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

const UpsertSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  name: z.string().trim().min(1).max(100),
  date_from: z.string(),
  date_to: z.string(),
  status: StatusEnum.default("open"),
});

export const upsertFiscalPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpsertSchema.parse(i))
  .handler(async ({ data, context }) => {
    if (new Date(data.date_from) > new Date(data.date_to)) {
      throw new Error("تاريخ البداية يجب أن يسبق تاريخ النهاية | Start date must be before end date");
    }
    // Overlap check
    const { data: overlap } = await context.supabase
      .from("fiscal_periods")
      .select("id, name, date_from, date_to")
      .eq("company_id", data.company_id)
      .lte("date_from", data.date_to)
      .gte("date_to", data.date_from);
    const conflict = (overlap ?? []).find((p: any) => p.id !== data.id);
    if (conflict) {
      throw new Error(
        `الفترة تتداخل مع "${conflict.name}" (${conflict.date_from} → ${conflict.date_to})`,
      );
    }

    const payload = {
      company_id: data.company_id,
      name: data.name,
      date_from: data.date_from,
      date_to: data.date_to,
      status: data.status,
    };

    if (data.id) {
      const { data: row, error } = await context.supabase
        .from("fiscal_periods")
        .update(payload)
        .eq("id", data.id)
        .select()
        .single();
      if (error) throw new Error(error.message);
      return row;
    }
    const { data: row, error } = await context.supabase
      .from("fiscal_periods")
      .insert(payload)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const setFiscalPeriodStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: "open" | "closed" | "locked" }) =>
    z.object({ id: z.string().uuid(), status: StatusEnum }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase
      .from("fiscal_periods")
      .update({ status: data.status })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteFiscalPeriod = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    // Prevent delete if entries exist in this period
    const { count } = await context.supabase
      .from("journal_entries")
      .select("id", { count: "exact", head: true })
      .eq("period_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error(`لا يمكن الحذف — يوجد ${count} قيد مرتبط بالفترة`);
    }
    const { error } = await context.supabase.from("fiscal_periods").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

const GenerateSchema = z.object({
  company_id: z.string().uuid(),
  year: z.number().int().min(2000).max(2100),
  start_month: z.number().int().min(1).max(12).default(1),
  frequency: z.enum(["monthly", "quarterly", "yearly"]),
  prefix: z.string().trim().max(20).optional().default("FY"),
});

function pad(n: number) {
  return String(n).padStart(2, "0");
}
function lastDayOfMonth(year: number, month1to12: number) {
  return new Date(year, month1to12, 0).getDate();
}
function addMonths(year: number, month1to12: number, add: number) {
  const idx = (month1to12 - 1) + add;
  return { year: year + Math.floor(idx / 12), month: (idx % 12) + 1 };
}

export const generateFiscalYearPeriods = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => GenerateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const segments =
      data.frequency === "monthly" ? 12 : data.frequency === "quarterly" ? 4 : 1;
    const stepMonths = 12 / segments;

    const rows: any[] = [];
    for (let i = 0; i < segments; i++) {
      const from = addMonths(data.year, data.start_month, i * stepMonths);
      const toRel = addMonths(data.year, data.start_month, (i + 1) * stepMonths - 1);
      const lastDay = lastDayOfMonth(toRel.year, toRel.month);
      const dateFrom = `${from.year}-${pad(from.month)}-01`;
      const dateTo = `${toRel.year}-${pad(toRel.month)}-${pad(lastDay)}`;

      let name = `${data.prefix} ${data.year}`;
      if (data.frequency === "monthly") {
        name = `${data.prefix} ${from.year}-${pad(from.month)}`;
      } else if (data.frequency === "quarterly") {
        name = `${data.prefix} ${data.year} Q${i + 1}`;
      }
      rows.push({
        company_id: data.company_id,
        name,
        date_from: dateFrom,
        date_to: dateTo,
        status: "open",
      });
    }

    // Check for any overlap with existing periods
    const minFrom = rows[0].date_from;
    const maxTo = rows[rows.length - 1].date_to;
    const { data: existing } = await context.supabase
      .from("fiscal_periods")
      .select("name, date_from, date_to")
      .eq("company_id", data.company_id)
      .lte("date_from", maxTo)
      .gte("date_to", minFrom);
    if ((existing ?? []).length) {
      const sample = existing!.slice(0, 3).map((p: any) => p.name).join("، ");
      throw new Error(`يوجد فترات تتداخل مع المدى المطلوب: ${sample}`);
    }

    const { data: inserted, error } = await context.supabase
      .from("fiscal_periods")
      .insert(rows)
      .select();
    if (error) throw new Error(error.message);
    return { created: inserted?.length ?? 0 };
  });
