import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

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
  document_type: z.enum(["journal_entry", "invoice", "payment", "asset_disposal"]),
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
        document_type: data.document_type,
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
      return { success: true, status: "approved" };
    }

    await supabase.from("approval_requests").update({
      current_step: req.current_step + 1,
    }).eq("id", data.requestId);
    return { success: true, status: "pending", nextStep: req.current_step + 1 };
  });
