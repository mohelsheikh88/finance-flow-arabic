import { toast } from "sonner";
import { useTrackEditing } from "./conflict-tracker";

/**
 * Shows a toast when another user updates the same record being edited.
 * Use inside any edit form: pass the record's table name, id, and updated_at.
 *
 * Example:
 *   useConflictToast({ table: "invoices", id: invoice.id, updatedAt: invoice.updated_at });
 */
export function useConflictToast(opts: {
  table: string;
  id: string | null | undefined;
  updatedAt: string | null | undefined;
  enabled?: boolean;
  onReload?: () => void;
}) {
  useTrackEditing({
    table: opts.table,
    id: opts.id,
    updatedAt: opts.updatedAt,
    enabled: opts.enabled ?? true,
    onConflict: () => {
      toast.warning("تم تحديث هذا السجل من مستخدم آخر", {
        description: "البيانات التي تعدّلها لم تعد الأحدث. يُرجى إعادة تحميل السجل قبل الحفظ لتفادي الكتابة فوق تغييرات الآخرين.",
        duration: 10000,
        action: opts.onReload
          ? { label: "إعادة تحميل", onClick: opts.onReload }
          : undefined,
      });
    },
  });
}
