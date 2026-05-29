import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRecordHistory } from "@/lib/api/history.functions";
import { Badge } from "@/components/ui/badge";
import { History, Plus, Pencil, Trash2, User } from "lucide-react";
import { useI18n } from "@/i18n";

const IGNORED_FIELDS = new Set([
  "updated_at",
  "created_at",
  "id",
]);

const LINE_TABLES = new Set([
  "journal_entry_lines",
  "invoice_lines",
  "payment_allocations",
  "asset_disposals",
]);

function diffSummary(oldData: any, newData: any): string[] {
  if (!oldData && newData) {
    return ["تم إنشاء السجل"];
  }
  if (oldData && !newData) {
    return ["تم حذف السجل"];
  }
  if (!oldData || !newData) return [];
  const changes: string[] = [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  for (const k of keys) {
    if (IGNORED_FIELDS.has(k)) continue;
    const a = oldData[k];
    const b = newData[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      const fa = a === null || a === undefined || a === "" ? "—" : String(a);
      const fb = b === null || b === undefined || b === "" ? "—" : String(b);
      changes.push(`${k}: ${fa} → ${fb}`);
    }
  }
  return changes;
}

export function HistoryLog({
  table,
  recordId,
}: {
  table: "journal_entries" | "invoices" | "payments" | "fixed_assets";
  recordId: string;
}) {
  const { t, locale } = useI18n();
  const fn = useServerFn(getRecordHistory);
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["record-history", table, recordId],
    queryFn: () => fn({ data: { table, recordId } }),
    enabled: !!recordId,
  });

  return (
    <div className="border rounded-md">
      <div className="flex items-center gap-2 px-3 py-2 bg-muted/50 border-b">
        <History className="h-4 w-4 text-muted-foreground" />
        <span className="text-sm font-semibold">{t("history.title")}</span>
        <span className="text-xs text-muted-foreground ms-auto">
          {rows.length} {t("history.entries")}
        </span>
      </div>

      <div className="max-h-72 overflow-y-auto">
        {isLoading && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {t("common.loading")}
          </div>
        )}
        {error && (
          <div className="p-4 text-center text-xs text-destructive">
            {(error as Error).message}
          </div>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <div className="p-4 text-center text-xs text-muted-foreground">
            {t("history.empty")}
          </div>
        )}
        {rows.map((r: any) => {
          const isLine = LINE_TABLES.has(r.table_name);
          const userName =
            r.user
              ? (locale === "ar"
                  ? r.user.display_name_ar || r.user.display_name_en || r.user.email
                  : r.user.display_name_en || r.user.display_name_ar || r.user.email)
              : t("history.system");
          const when = new Date(r.changed_at);
          const Icon =
            r.action === "INSERT" ? Plus : r.action === "DELETE" ? Trash2 : Pencil;
          const actionLabel =
            r.action === "INSERT"
              ? t("history.created")
              : r.action === "DELETE"
              ? t("history.deleted")
              : t("history.updated");
          const variant =
            r.action === "INSERT"
              ? "bg-success/15 text-success border-success/30"
              : r.action === "DELETE"
              ? "bg-destructive/15 text-destructive border-destructive/30"
              : "bg-primary/15 text-primary border-primary/30";
          const changes = diffSummary(r.old_data, r.new_data);
          return (
            <div key={r.id} className="px-3 py-2 border-b last:border-b-0 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline" className={variant}>
                  <Icon className="h-3 w-3 me-1" />
                  {actionLabel}
                </Badge>
                {isLine && (
                  <Badge variant="outline" className="text-[10px]">
                    {t("history.line")}
                  </Badge>
                )}
                <span className="inline-flex items-center gap-1 text-muted-foreground">
                  <User className="h-3 w-3" />
                  {userName}
                </span>
                <span className="text-muted-foreground ms-auto font-mono">
                  {when.toLocaleString(locale === "ar" ? "ar-EG" : "en-GB")}
                </span>
              </div>
              {changes.length > 0 && (
                <ul className="mt-1 ps-4 list-disc text-muted-foreground space-y-0.5">
                  {changes.slice(0, 8).map((c, i) => (
                    <li key={i} className="break-all font-mono text-[11px]">{c}</li>
                  ))}
                  {changes.length > 8 && (
                    <li className="text-[10px] italic">
                      +{changes.length - 8} {t("history.more")}
                    </li>
                  )}
                </ul>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
