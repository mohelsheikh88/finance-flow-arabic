import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth/AuthProvider";
import { useBranch } from "@/lib/branch-context";

/**
 * The current user's CRUD capability for the branch they're CURRENTLY
 * working in (Read/Write/Edit/Delete are set per branch, from the Users
 * page). Fails open (true) while loading, so adopting this in a page
 * never flashes disabled buttons before we actually know.
 *
 * Usage in any page:
 *   const { canWrite, canEdit, canDelete } = usePermissions();
 *   {canWrite && <Button>{t("common.new")}</Button>}
 *   {canEdit && <Button onClick={...}><Pencil /></Button>}
 *   {canDelete && <Button onClick={...}><Trash2 /></Button>}
 */
export function usePermissions() {
  const { user } = useAuth();
  const { branchId } = useBranch();

  const { data, isPending } = useQuery({
    queryKey: ["my_branch_permissions", user?.id, branchId],
    enabled: !!user && !!branchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_branch_access")
        .select("can_read, can_write, can_edit, can_delete")
        .eq("user_id", user!.id)
        .eq("branch_id", branchId!)
        .maybeSingle();
      if (error) throw error;
      return data; // null = no explicit row = no access to this branch's data
    },
  });

  const loading = isPending || !branchId;
  return {
    hasAccess: loading ? true : !!data,
    canRead: loading ? true : !!data?.can_read,
    canWrite: loading ? true : !!data?.can_write,
    canEdit: loading ? true : !!data?.can_edit,
    canDelete: loading ? true : !!data?.can_delete,
    loading,
  };
}
