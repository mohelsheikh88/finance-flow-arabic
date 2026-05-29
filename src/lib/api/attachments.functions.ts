import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const TxnType = z.enum(["invoice", "payment", "journal_entry", "asset", "asset_disposal"]);

export const listAttachments = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { transactionType: string; transactionId: string }) =>
    z.object({ transactionType: TxnType, transactionId: z.string().uuid() }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("transaction_attachments")
      .select("*")
      .eq("transaction_type", data.transactionType)
      .eq("transaction_id", data.transactionId)
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: {
    company_id: string;
    branch_id: string;
    transaction_type: string;
    transaction_id: string;
    file_path: string;
    file_name: string;
    mime_type?: string | null;
    file_size?: number | null;
    description?: string | null;
  }) =>
    z.object({
      company_id: z.string().uuid(),
      branch_id: z.string().uuid(),
      transaction_type: TxnType,
      transaction_id: z.string().uuid(),
      file_path: z.string().min(1).max(500),
      file_name: z.string().min(1).max(255),
      mime_type: z.string().max(120).optional().nullable(),
      file_size: z.number().int().min(0).optional().nullable(),
      description: z.string().max(500).optional().nullable(),
    }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("transaction_attachments")
      .insert({ ...data, uploaded_by: context.userId })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteAttachment = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { data: row } = await context.supabase
      .from("transaction_attachments")
      .select("file_path")
      .eq("id", data.id)
      .single();
    if (row?.file_path) {
      await context.supabase.storage.from("transaction-attachments").remove([row.file_path]);
    }
    const { error } = await context.supabase
      .from("transaction_attachments")
      .delete()
      .eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getAttachmentUrl = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { file_path: string }) =>
    z.object({ file_path: z.string().min(1).max(500) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    const { data: signed, error } = await context.supabase
      .storage
      .from("transaction-attachments")
      .createSignedUrl(data.file_path, 300);
    if (error) throw new Error(error.message);
    return { url: signed.signedUrl };
  });
