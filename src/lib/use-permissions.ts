import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";

/**
 * The current user's base CRUD capability (Read/Write/Edit/Delete),
 * set from the Users page. Fails open (true) while loading, so adopting
 * this in a page never flashes disabled buttons before we actually know.
 *
 * Usage in any page:
 *   const { canWrite, canEdit, canDelete } = usePermissions();
 *   {canWrite && <Button>{t("common.new")}</Button>}
 *   {canEdit && <Button onClick={...}><Pencil /></Button>}
 *   {canDelete && <Button onClick={...}><Trash2 /></Button>}
 */
export function usePermissions() {
  const { user } = useAuth();
  const { data, isPending } = useQuery({
    queryKey: ["my_crud_permissions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("can_read, can_write, can_edit, can_delete")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const loading = isPending || !data;
  return {
    canRead: loading ? true : data.can_read,
    canWrite: loading ? true : data.can_write,
    canEdit: loading ? true : data.can_edit,
    canDelete: loading ? true : data.can_delete,
    loading,
  };
}
