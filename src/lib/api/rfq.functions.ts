import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";

// ================= RFQ: List / Get =================

export const listRFQs = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { companyId: string }) => z.object({ companyId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rows, error } = await sb
      .from("rfqs")
      .select("*")
      .eq("company_id", data.companyId)
      .order("request_date", { ascending: false });
    if (error) throw new Error(error.message);

    const rfqIds = (rows ?? []).map((r: any) => r.id);
    if (!rfqIds.length) return [];

    const [{ data: vendors }, { data: lines }] = await Promise.all([
      sb.from("rfq_vendors").select("rfq_id, status").in("rfq_id", rfqIds),
      sb.from("rfq_lines").select("rfq_id").in("rfq_id", rfqIds),
    ]);
    const vendorCount = new Map<string, number>();
    const quotedCount = new Map<string, number>();
    (vendors ?? []).forEach((v: any) => {
      vendorCount.set(v.rfq_id, (vendorCount.get(v.rfq_id) ?? 0) + 1);
      if (v.status === "quoted") quotedCount.set(v.rfq_id, (quotedCount.get(v.rfq_id) ?? 0) + 1);
    });
    const lineCount = new Map<string, number>();
    (lines ?? []).forEach((l: any) => lineCount.set(l.rfq_id, (lineCount.get(l.rfq_id) ?? 0) + 1));

    return (rows ?? []).map((r: any) => ({
      ...r,
      vendor_count: vendorCount.get(r.id) ?? 0,
      quoted_count: quotedCount.get(r.id) ?? 0,
      line_count: lineCount.get(r.id) ?? 0,
    }));
  });

export const getRFQ = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rfq, error } = await sb.from("rfqs").select("*").eq("id", data.id).single();
    if (error) throw new Error(error.message);

    const [{ data: lines }, { data: vendors }] = await Promise.all([
      sb.from("rfq_lines").select("*").eq("rfq_id", data.id).order("sort_order", { ascending: true }),
      sb.from("rfq_vendors").select("*").eq("rfq_id", data.id).order("created_at", { ascending: true }),
    ]);

    const vendorIds = (vendors ?? []).map((v: any) => v.id);
    const { data: quoteLines } = vendorIds.length
      ? await sb.from("rfq_vendor_quote_lines").select("*").in("rfq_vendor_id", vendorIds)
      : { data: [] as any[] };

    return { rfq, lines: lines ?? [], vendors: vendors ?? [], quoteLines: quoteLines ?? [] };
  });

// ================= RFQ: Header =================

const RFQHeaderSchema = z.object({
  id: z.string().uuid().optional(),
  company_id: z.string().uuid(),
  title: z.string().min(1).max(255),
  request_date: z.string(),
  needed_by_date: z.string().nullable().optional(),
  warehouse_id: z.string().uuid().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
});

export const upsertRFQHeader = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => RFQHeaderSchema.parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { id, ...header } = data;
    if (id) {
      const { data: row, error } = await sb.from("rfqs").update(header).eq("id", id).select().single();
      if (error) throw new Error(error.message);
      return row;
    }
    // Sequential per-company/year numbering: RFQ-2026-00001
    const yr = new Date(header.request_date).getFullYear();
    const { count } = await sb
      .from("rfqs")
      .select("id", { count: "exact", head: true })
      .eq("company_id", header.company_id)
      .gte("request_date", `${yr}-01-01`)
      .lte("request_date", `${yr}-12-31`);
    const rfq_number = `RFQ-${yr}-${String((count ?? 0) + 1).padStart(5, "0")}`;

    const { data: row, error } = await sb
      .from("rfqs")
      .insert({ ...header, rfq_number, status: "draft" })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const updateRFQStatus = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; status: string }) =>
    z.object({
      id: z.string().uuid(),
      status: z.enum(["draft", "sent", "quotes_received", "awarded", "converted", "cancelled"]),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rfqs").update({ status: data.status }).eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteRFQ = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rfqs").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ================= RFQ: Lines (what we need) =================

const RFQLineSchema = z.object({
  id: z.string().uuid().optional(),
  product_id: z.string().uuid().nullable().optional(),
  description: z.string().max(500).nullable().optional(),
  quantity: z.number().positive(),
  uom_id: z.string().uuid().nullable().optional(),
  target_price: z.number().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const saveRFQLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ rfqId: z.string().uuid(), lines: z.array(RFQLineSchema).max(500) }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    // Simplest, most robust approach: replace the whole line set. Any
    // vendor quote lines referencing removed RFQ lines cascade-delete.
    await sb.from("rfq_lines").delete().eq("rfq_id", data.rfqId);
    if (data.lines.length) {
      const { error } = await sb.from("rfq_lines").insert(
        data.lines.map((l, i) => ({
          rfq_id: data.rfqId,
          product_id: l.product_id ?? null,
          description: l.description ?? null,
          quantity: l.quantity,
          uom_id: l.uom_id ?? null,
          target_price: l.target_price ?? null,
          notes: l.notes ?? null,
          sort_order: i,
        })),
      );
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ================= RFQ: Invited vendors =================

export const inviteVendors = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => z.object({ rfqId: z.string().uuid(), vendorIds: z.array(z.string().uuid()) }).parse(i))
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: existing } = await sb.from("rfq_vendors").select("id, vendor_id").eq("rfq_id", data.rfqId);
    const existingIds = new Set((existing ?? []).map((v: any) => v.vendor_id));
    const toAdd = data.vendorIds.filter((id) => !existingIds.has(id));
    const toRemove = (existing ?? []).filter((v: any) => !data.vendorIds.includes(v.vendor_id));

    if (toAdd.length) {
      const { error } = await sb.from("rfq_vendors").insert(
        toAdd.map((vendor_id) => ({ rfq_id: data.rfqId, vendor_id, status: "invited" })),
      );
      if (error) throw new Error(error.message);
    }
    if (toRemove.length) {
      const { error } = await sb.from("rfq_vendors").delete().in("id", toRemove.map((v: any) => v.id));
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

// ================= RFQ: Recording a vendor's quote =================

const QuoteLineSchema = z.object({
  rfq_line_id: z.string().uuid(),
  unit_price: z.number().min(0).nullable().optional(),
  delivery_days: z.number().int().min(0).nullable().optional(),
  available_qty: z.number().min(0).nullable().optional(),
  notes: z.string().max(500).nullable().optional(),
});

export const saveVendorQuote = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      rfqVendorId: z.string().uuid(),
      quote_date: z.string().nullable().optional(),
      validity_date: z.string().nullable().optional(),
      payment_term_id: z.string().uuid().nullable().optional(),
      currency_code: z.string().max(10).default("SAR"),
      notes: z.string().max(2000).nullable().optional(),
      lines: z.array(QuoteLineSchema),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { rfqVendorId, lines, ...header } = data;

    const hasAnyPrice = lines.some((l) => l.unit_price != null);
    const { error: hErr } = await sb
      .from("rfq_vendors")
      .update({ ...header, status: hasAnyPrice ? "quoted" : "invited" })
      .eq("id", rfqVendorId);
    if (hErr) throw new Error(hErr.message);

    for (const l of lines) {
      const { error } = await sb
        .from("rfq_vendor_quote_lines")
        .upsert(
          {
            rfq_vendor_id: rfqVendorId,
            rfq_line_id: l.rfq_line_id,
            unit_price: l.unit_price ?? null,
            delivery_days: l.delivery_days ?? null,
            available_qty: l.available_qty ?? null,
            notes: l.notes ?? null,
          },
          { onConflict: "rfq_vendor_id,rfq_line_id" },
        );
      if (error) throw new Error(error.message);
    }

    // Bump the parent RFQ into "quotes_received" once at least one quote exists.
    const { data: rv } = await sb.from("rfq_vendors").select("rfq_id").eq("id", rfqVendorId).single();
    if (rv) {
      const { data: parent } = await sb.from("rfqs").select("status").eq("id", rv.rfq_id).single();
      if (parent && (parent.status === "draft" || parent.status === "sent")) {
        await sb.from("rfqs").update({ status: "quotes_received" }).eq("id", rv.rfq_id);
      }
    }
    return { ok: true };
  });

export const markVendorDeclined = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { rfqVendorId: string }) => z.object({ rfqVendorId: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("rfq_vendors").update({ status: "declined" }).eq("id", data.rfqVendorId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ================= RFQ: Award =================

export const awardQuoteLines = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({
      rfqId: z.string().uuid(),
      // Map of rfq_line_id -> the winning rfq_vendor_quote_line id (or null to clear the award for that line).
      awards: z.record(z.string().uuid(), z.string().uuid().nullable()),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    for (const [rfqLineId, winningQuoteLineId] of Object.entries(data.awards)) {
      const { error: clearErr } = await sb
        .from("rfq_vendor_quote_lines")
        .update({ is_awarded: false })
        .eq("rfq_line_id", rfqLineId);
      if (clearErr) throw new Error(clearErr.message);
      if (winningQuoteLineId) {
        const { error: setErr } = await sb
          .from("rfq_vendor_quote_lines")
          .update({ is_awarded: true })
          .eq("id", winningQuoteLineId);
        if (setErr) throw new Error(setErr.message);
      }
    }
    const { error } = await sb.from("rfqs").update({ status: "awarded", awarded_at: new Date().toISOString() }).eq("id", data.rfqId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

// ================= RFQ: Convert awarded lines into Purchase Order(s) =================

export const convertRFQToPurchaseOrders = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { rfqId: string; companyId: string; billControl?: string }) =>
    z.object({
      rfqId: z.string().uuid(),
      companyId: z.string().uuid(),
      billControl: z.enum(["ordered", "received"]).default("received"),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const sb = context.supabase as any;
    const { data: rfq, error: rErr } = await sb.from("rfqs").select("*").eq("id", data.rfqId).single();
    if (rErr) throw new Error(rErr.message);

    const { data: vendors } = await sb.from("rfq_vendors").select("*").eq("rfq_id", data.rfqId);
    const { data: lines } = await sb.from("rfq_lines").select("*").eq("rfq_id", data.rfqId);
    const vendorIds = (vendors ?? []).map((v: any) => v.id);
    const { data: quoteLines } = vendorIds.length
      ? await sb.from("rfq_vendor_quote_lines").select("*").in("rfq_vendor_id", vendorIds).eq("is_awarded", true)
      : { data: [] as any[] };

    if (!quoteLines || !quoteLines.length) {
      throw new Error("No awarded quotes to convert — award at least one line first");
    }

    const vendorById = new Map<string, any>((vendors ?? []).map((v: any) => [v.id, v]));
    const lineById = new Map<string, any>((lines ?? []).map((l: any) => [l.id, l]));

    const byVendor = new Map<string, any[]>();
    for (const ql of quoteLines) {
      const rv = vendorById.get(ql.rfq_vendor_id);
      if (!rv) continue;
      const arr = byVendor.get(rv.vendor_id) ?? [];
      arr.push({ ...ql, rfqVendor: rv });
      byVendor.set(rv.vendor_id, arr);
    }

    const createdPoIds: string[] = [];
    for (const [vendorId, qls] of byVendor.entries()) {
      const rv = qls[0].rfqVendor;
      const poLines = qls.map((ql: any) => {
        const rfqLine = lineById.get(ql.rfq_line_id);
        return {
          product_id: rfqLine?.product_id ?? null,
          description: rfqLine?.description ?? null,
          quantity: ql.available_qty ?? rfqLine?.quantity ?? 1,
          uom_id: rfqLine?.uom_id ?? null,
          unit_price: ql.unit_price ?? 0,
          bonus: 0,
          discount1_pct: 0,
          discount2_pct: 0,
          tax_id: null,
          tax_rate: 0,
        };
      });
      const subtotal = poLines.reduce((s: number, l: any) => s + l.quantity * l.unit_price, 0);

      const yr = new Date().getFullYear();
      const { count } = await sb
        .from("purchase_orders")
        .select("id", { count: "exact", head: true })
        .eq("company_id", data.companyId)
        .gte("order_date", `${yr}-01-01`)
        .lte("order_date", `${yr}-12-31`);
      const poNumber = `PO-${yr}-${String((count ?? 0) + 1 + createdPoIds.length).padStart(5, "0")}`;

      const { data: po, error: poErr } = await sb
        .from("purchase_orders")
        .insert({
          company_id: data.companyId,
          vendor_id: vendorId,
          vendor_reference: rfq.rfq_number,
          warehouse_id: rfq.warehouse_id,
          bill_control: data.billControl,
          order_date: new Date().toISOString().slice(0, 10),
          currency_code: rv.currency_code || "SAR",
          payment_term_id: rv.payment_term_id ?? null,
          notes: `Generated from ${rfq.rfq_number}`,
          po_number: poNumber,
          status: "draft",
          subtotal: Math.round(subtotal * 100) / 100,
          tax_total: 0,
          total: Math.round(subtotal * 100) / 100,
          source_rfq_id: data.rfqId,
          created_by: context.userId,
        })
        .select("id")
        .single();
      if (poErr) throw new Error(poErr.message);

      const { error: linesErr } = await sb.from("purchase_order_lines").insert(
        poLines.map((l: any, i: number) => ({ ...l, purchase_order_id: po.id, line_total: l.quantity * l.unit_price, sort_order: i })),
      );
      if (linesErr) throw new Error(linesErr.message);
      createdPoIds.push(po.id);
    }

    await sb.from("rfqs").update({ status: "converted", converted_at: new Date().toISOString() }).eq("id", data.rfqId);
    return { poIds: createdPoIds, count: createdPoIds.length };
  });
