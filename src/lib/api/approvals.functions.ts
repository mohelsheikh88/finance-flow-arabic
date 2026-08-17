import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware.self";
import { z } from "zod";

const JOURNAL_TYPES = ["sales", "purchase", "bank", "cash", "misc"] as const;
type JournalType = (typeof JOURNAL_TYPES)[number];

const ListInput = z.object({
  companyId: z.string().uuid(),
  branchId: z.string().uuid().nullable(),
  status: z.enum(["pending", "approved", "rejected", "all"]).default("pending"),
});

export const listApprovalRequests = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ListInput.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    let q = supabase
      .from("approval_requests")
      .select("*")
      .eq("company_id", data.companyId)
      .order("created_at", { ascending: false });
    if (data.branchId) q = q.eq("branch_id", data.branchId);
    if (data.status !== "all") q = q.eq("status", data.status);
    const { data: rows, error } = await q;
    if (error) throw new Error(error.message);
    return { requests: rows || [] };
  });

const GetForDoc = z.object({
  documentType: z.enum(["journal_entry", "invoice", "payment", "asset_disposal"]),
  documentId: z.string().uuid(),
});

export const getApprovalForDocument = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => GetForDoc.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: rows } = await supabase
      .from("approval_requests")
      .select("*, approval_workflows(*, approval_steps_def(*)), approval_actions(*)")
      .eq("document_type", data.documentType)
      .eq("document_id", data.documentId)
      .order("created_at", { ascending: false })
      .limit(1);
    return { request: rows?.[0] ?? null };
  });

const ListWorkflows = z.object({ companyId: z.string().uuid() });

export const listWorkflows = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => ListWorkflows.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: wfs, error } = await supabase
      .from("approval_workflows")
      .select("*, approval_steps_def(*)")
      .eq("company_id", data.companyId)
      .order("min_amount");
    if (error) throw new Error(error.message);
    return { workflows: wfs || [] };
  });

const CreateWf = z.object({
  companyId: z.string().uuid(),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  journal_type: z.enum(JOURNAL_TYPES),
  min_amount: z.number().min(0),
  max_amount: z.number().nullable(),
  steps: z.array(z.object({
    step_order: z.number().int().min(1),
    required_role: z.string(),
    step_name_ar: z.string(),
    step_name_en: z.string(),
  })).min(1),
});

export const createWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => CreateWf.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { data: wf, error } = await supabase
      .from("approval_workflows")
      .insert({
        company_id: data.companyId,
        name_ar: data.name_ar,
        name_en: data.name_en,
        journal_type: data.journal_type,
        min_amount: data.min_amount,
        max_amount: data.max_amount,
      })
      .select()
      .single();
    if (error) throw new Error(error.message);
    const { error: se } = await supabase
      .from("approval_steps_def")
      .insert(data.steps.map((s) => ({ ...s, workflow_id: wf.id, required_role: s.required_role as any })));
    if (se) throw new Error(se.message);
    return { workflow: wf };
  });

const UpdateWf = z.object({
  id: z.string().uuid(),
  name_ar: z.string().min(1),
  name_en: z.string().min(1),
  journal_type: z.enum(JOURNAL_TYPES),
  min_amount: z.number().min(0),
  max_amount: z.number().nullable(),
  is_active: z.boolean().optional(),
  steps: z.array(z.object({
    step_order: z.number().int().min(1),
    required_role: z.string(),
    step_name_ar: z.string(),
    step_name_en: z.string(),
  })).min(1),
});

export const updateWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => UpdateWf.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error: ue } = await supabase
      .from("approval_workflows")
      .update({
        name_ar: data.name_ar,
        name_en: data.name_en,
        journal_type: data.journal_type,
        min_amount: data.min_amount,
        max_amount: data.max_amount,
        ...(data.is_active !== undefined ? { is_active: data.is_active } : {}),
      })
      .eq("id", data.id);
    if (ue) throw new Error(ue.message);

    const { error: de } = await supabase
      .from("approval_steps_def")
      .delete()
      .eq("workflow_id", data.id);
    if (de) throw new Error(de.message);

    const { error: ie } = await supabase
      .from("approval_steps_def")
      .insert(data.steps.map((s) => ({ ...s, workflow_id: data.id, required_role: s.required_role as any })));
    if (ie) throw new Error(ie.message);
    return { ok: true };
  });

export const setWorkflowActive = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string; is_active: boolean }) =>
    z.object({ id: z.string().uuid(), is_active: z.boolean() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { error } = await supabase
      .from("approval_workflows")
      .update({ is_active: data.is_active })
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const deleteWorkflow = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { supabase } = context;
    const { count } = await supabase
      .from("approval_requests")
      .select("id", { count: "exact", head: true })
      .eq("workflow_id", data.id);
    if ((count ?? 0) > 0) {
      throw new Error("HAS_REQUESTS");
    }
    await supabase.from("approval_steps_def").delete().eq("workflow_id", data.id);
    const { error } = await supabase.from("approval_workflows").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });



/**
 * Internal helper – finds an active workflow matching journal_type + amount.
 */
export async function findMatchingWorkflow(
  supabase: any,
  companyId: string,
  journalType: JournalType,
  amount: number,
): Promise<string | null> {
  const { data: wfs } = await supabase
    .from("approval_workflows")
    .select("id, min_amount, max_amount")
    .eq("company_id", companyId)
    .eq("journal_type", journalType)
    .eq("is_active", true);
  if (!wfs || wfs.length === 0) return null;
  const match = wfs.find((w: any) =>
    Number(amount) >= Number(w.min_amount) &&
    (w.max_amount == null || Number(amount) <= Number(w.max_amount))
  );
  return match?.id ?? null;
}

/**
 * Internal helper – creates an approval_request row for a document, resolved
 * by the document's journal_type.
 */
export async function maybeRequestApproval(
  supabase: any,
  userId: string,
  args: {
    companyId: string;
    branchId: string;
    journalId: string | null;
    documentType: "journal_entry" | "invoice" | "payment" | "asset_disposal";
    documentId: string;
    documentReference: string;
    amount: number;
    currencyCode?: string;
  },
): Promise<{ created: boolean; requestId?: string }> {
  // Avoid double-submitting if an approval is already in flight or approved
  const { data: existing } = await supabase
    .from("approval_requests")
    .select("id, status")
    .eq("document_type", args.documentType)
    .eq("document_id", args.documentId)
    .in("status", ["pending", "approved"])
    .maybeSingle();
  if (existing) {
    return existing.status === "approved" ? { created: false } : { created: true, requestId: existing.id };
  }

  if (!args.journalId) return { created: false };

  const { data: journal } = await supabase
    .from("journals")
    .select("journal_type")
    .eq("id", args.journalId)
    .maybeSingle();
  if (!journal?.journal_type) return { created: false };

  const workflowId = await findMatchingWorkflow(
    supabase,
    args.companyId,
    journal.journal_type as JournalType,
    args.amount,
  );
  if (!workflowId) return { created: false };

  const { data: req, error } = await supabase
    .from("approval_requests")
    .insert({
      company_id: args.companyId,
      branch_id: args.branchId,
      workflow_id: workflowId,
      document_type: args.documentType,
      document_id: args.documentId,
      document_reference: args.documentReference,
      amount: args.amount,
      currency_code: args.currencyCode ?? "SAR",
      requested_by: userId,
      status: "pending",
      current_step: 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { created: true, requestId: req.id };
}

const Action = z.object({
  requestId: z.string().uuid(),
  action: z.enum(["approved", "rejected"]),
  comments: z.string().optional(),
});

export const actOnRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d) => Action.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: req, error: re } = await supabase
      .from("approval_requests")
      .select("*, approval_workflows(*, approval_steps_def(*))")
      .eq("id", data.requestId)
      .single();
    if (re || !req) throw new Error(re?.message || "Request not found");
    if (req.status !== "pending") throw new Error("Request already closed");

    const wf = (req as any).approval_workflows;
    const steps = (wf?.approval_steps_def || []).sort((a: any, b: any) => a.step_order - b.step_order);
    const totalSteps = steps.length;

    await supabase.from("approval_actions").insert({
      request_id: data.requestId,
      step_order: req.current_step,
      action: data.action,
      acted_by: userId,
      comments: data.comments || null,
    });

    if (data.action === "rejected") {
      await supabase.from("approval_requests").update({
        status: "rejected",
        completed_at: new Date().toISOString(),
      }).eq("id", data.requestId);
      return { success: true, status: "rejected" };
    }

    if (req.current_step >= totalSteps) {
      await supabase.from("approval_requests").update({
        status: "approved",
        completed_at: new Date().toISOString(),
      }).eq("id", data.requestId);

      try {
        if (req.document_type === "invoice") {
          const { postInvoiceCore } = await import("./invoices.functions");
          await postInvoiceCore(supabase, userId!, req.document_id, { bypassApproval: true });
        } else if (req.document_type === "payment") {
          const { postPaymentCore } = await import("./payments.functions");
          await postPaymentCore(supabase, userId!, req.document_id, { bypassApproval: true });
        }
      } catch (e: any) {
        return { success: true, status: "approved", postError: e.message };
      }
      return { success: true, status: "approved" };
    }

    await supabase.from("approval_requests").update({
      current_step: req.current_step + 1,
    }).eq("id", data.requestId);
    return { success: true, status: "pending", nextStep: req.current_step + 1 };
  });
