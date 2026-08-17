import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const listRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("roles_registry")
      .select("*")
      .order("sort_order", { ascending: true })
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

const CreateSchema = z.object({
  code: z.string().min(1).max(50).regex(/^[a-z][a-z0-9_]*$/, "code must be lowercase letters/digits/underscore"),
  name_ar: z.string().min(1).max(255),
  name_en: z.string().min(1).max(255),
  description_ar: z.string().max(500).optional().nullable(),
  description_en: z.string().max(500).optional().nullable(),
  is_active: z.boolean().default(true),
  sort_order: z.number().int().default(0),
});

export const createRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => CreateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { data: row, error } = await context.supabase
      .from("roles_registry")
      .insert({ ...data, is_system: false })
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

const UpdateSchema = z.object({
  id: z.string().uuid(),
  name_ar: z.string().min(1).max(255).optional(),
  name_en: z.string().min(1).max(255).optional(),
  description_ar: z.string().max(500).optional().nullable(),
  description_en: z.string().max(500).optional().nullable(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const updateRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) => UpdateSchema.parse(i))
  .handler(async ({ data, context }) => {
    const { id, ...patch } = data;
    const { data: row, error } = await context.supabase
      .from("roles_registry")
      .update(patch)
      .eq("id", id)
      .select()
      .single();
    if (error) throw new Error(error.message);
    return row;
  });

export const deleteRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i: { id: string }) => z.object({ id: z.string().uuid() }).parse(i))
  .handler(async ({ data, context }) => {
    const { error } = await context.supabase.from("roles_registry").delete().eq("id", data.id);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const reorderRoles = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((i) =>
    z.object({ ids: z.array(z.string().uuid()).min(1) }).parse(i),
  )
  .handler(async ({ data, context }) => {
    for (let i = 0; i < data.ids.length; i++) {
      const { error } = await context.supabase
        .from("roles_registry")
        .update({ sort_order: (i + 1) * 10 })
        .eq("id", data.ids[i]);
      if (error) throw new Error(error.message);
    }
    return { ok: true };
  });

