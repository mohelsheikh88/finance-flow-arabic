import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getRecordHistory } from "@/lib/api/history.functions";
import { userDisplayLabel } from "@/lib/user-display";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  History,
  Plus,
  Pencil,
  Trash2,
  User,
  ChevronDown,
  ChevronUp,
  ArrowRight,
} from "lucide-react";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

// Fields that are noise in audit display
const HIDDEN_FIELDS = new Set([
  "id",
  "created_at",
  "updated_at",
  "created_by",
  "updated_by",
  "company_id",
  "branch_id",
  "entry_id",
  "invoice_id",
  "payment_id",
  "asset_id",
  "tenant_id",
  "audit_user_id",
  "audit_user_email",
  "source_id",
  "source_type",
]);

// Key business fields summarized for INSERT events (subset of all fields)
const KEY_FIELDS_BY_TABLE: Record<string, string[]> = {
  journal_entries: ["reference", "entry_date", "description", "status", "total_debit"],
  journal_entry_lines: ["line_number", "account_id", "partner_id", "debit", "credit", "description"],
  invoices: ["invoice_number", "invoice_date", "partner_id", "total_amount", "status"],
  invoice_lines: ["line_number", "account_id", "description", "quantity", "unit_price", "amount"],
  payments: ["payment_number", "payment_date", "partner_id", "amount", "status"],
  payment_allocations: ["invoice_id", "amount"],
  fixed_assets: ["asset_code", "name_ar", "name_en", "purchase_date", "cost", "status"],
  asset_disposals: ["disposal_date", "disposal_value", "reason"],
};

const LINE_TABLES = new Set([
  "journal_entry_lines",
  "invoice_lines",
  "payment_allocations",
  "asset_disposals",
]);

// Humanized field labels (AR/EN). Unknown fields fall back to snake → Title Case.
const FIELD_LABELS: Record<string, { ar: string; en: string }> = {
  entry_date: { ar: "تاريخ القيد", en: "Entry date" },
  invoice_date: { ar: "تاريخ الفاتورة", en: "Invoice date" },
  payment_date: { ar: "تاريخ السداد", en: "Payment date" },
  purchase_date: { ar: "تاريخ الشراء", en: "Purchase date" },
  disposal_date: { ar: "تاريخ الاستبعاد", en: "Disposal date" },
  reference: { ar: "المرجع", en: "Reference" },
  invoice_number: { ar: "رقم الفاتورة", en: "Invoice no." },
  payment_number: { ar: "رقم السند", en: "Payment no." },
  asset_code: { ar: "كود الأصل", en: "Asset code" },
  description: { ar: "البيان", en: "Description" },
  status: { ar: "الحالة", en: "Status" },
  account_id: { ar: "الحساب", en: "Account" },
  partner_id: { ar: "البارتنر", en: "Partner" },
  journal_id: { ar: "الدفتر", en: "Journal" },
  debit: { ar: "مدين", en: "Debit" },
  credit: { ar: "دائن", en: "Credit" },
  amount: { ar: "المبلغ", en: "Amount" },
  total_amount: { ar: "الإجمالي", en: "Total" },
  total_debit: { ar: "إجمالي المدين", en: "Total debit" },
  total_credit: { ar: "إجمالي الدائن", en: "Total credit" },
  quantity: { ar: "الكمية", en: "Quantity" },
  unit_price: { ar: "السعر", en: "Unit price" },
  line_number: { ar: "رقم السطر", en: "Line #" },
  name_ar: { ar: "الاسم (ع)", en: "Name (AR)" },
  name_en: { ar: "الاسم (E)", en: "Name (EN)" },
  cost: { ar: "التكلفة", en: "Cost" },
  disposal_value: { ar: "قيمة الاستبعاد", en: "Disposal value" },
  reason: { ar: "السبب", en: "Reason" },
  notes: { ar: "ملاحظات", en: "Notes" },
};

function humanize(field: string, locale: "ar" | "en"): string {
  const lbl = FIELD_LABELS[field];
  if (lbl) return locale === "ar" ? lbl.ar : lbl.en;
  return field
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

function isUuid(s: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
}

function formatValue(field: string, v: any, locale: "ar" | "en", t: (k: string) => string): string {
  if (v === null || v === undefined || v === "") return t("history.empty_value");
  if (typeof v === "boolean") return locale === "ar" ? (v ? "نعم" : "لا") : v ? "Yes" : "No";
  if (typeof v === "number") {
    if (["debit", "credit", "amount", "total_amount", "total_debit", "total_credit", "cost", "unit_price", "disposal_value"].includes(field)) {
      return new Intl.NumberFormat(locale === "ar" ? "ar-EG" : "en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v);
    }
    return String(v);
  }
  if (typeof v === "string") {
    // ISO date detection
    if (/^\d{4}-\d{2}-\d{2}(T|$)/.test(v)) {
      try {
        return new Date(v).toLocaleDateString(locale === "ar" ? "ar-EG" : "en-GB");
      } catch {
        return v;
      }
    }
    if (isUuid(v)) return v.slice(0, 8) + "…";
    return v;
  }
  try { return JSON.stringify(v); } catch { return String(v); }
}

type Change = { field: string; before: any; after: any };

function computeChanges(oldData: any, newData: any): Change[] {
  if (!oldData || !newData) return [];
  const keys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
  const out: Change[] = [];
  for (const k of keys) {
    if (HIDDEN_FIELDS.has(k)) continue;
    const a = oldData[k];
    const b = newData[k];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      out.push({ field: k, before: a, after: b });
    }
  }
  return out;
}

function summarizeInsert(table: string, newData: any, locale: "ar" | "en", t: (k: string) => string): Change[] {
  if (!newData) return [];
  const keys = KEY_FIELDS_BY_TABLE[table] ?? Object.keys(newData).filter((k) => !HIDDEN_FIELDS.has(k)).slice(0, 4);
  return keys
    .filter((k) => newData[k] !== null && newData[k] !== undefined && newData[k] !== "")
    .map((k) => ({ field: k, before: undefined, after: newData[k] }));
}

function userInitials(name: string): string {
  const parts = name.trim().split(/[\s.@]+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

const ACTION_STYLES = {
  INSERT: {
    bg: "bg-success/10",
    text: "text-success",
    border: "border-success/30",
    ring: "ring-success/20",
  },
  UPDATE: {
    bg: "bg-primary/10",
    text: "text-primary",
    border: "border-primary/30",
    ring: "ring-primary/20",
  },
  DELETE: {
    bg: "bg-destructive/10",
    text: "text-destructive",
    border: "border-destructive/30",
    ring: "ring-destructive/20",
  },
} as const;

function EventRow({ r, isLast }: { r: any; isLast: boolean }) {
  const { t, locale } = useI18n();
  const [expanded, setExpanded] = useState(false);
  const isLine = LINE_TABLES.has(r.table_name);

  const userName = r.user ? userDisplayLabel(r.user, locale) : t("history.system");
  const when = new Date(r.changed_at);

  const action = (r.action as "INSERT" | "UPDATE" | "DELETE") ?? "UPDATE";
  const Icon = action === "INSERT" ? Plus : action === "DELETE" ? Trash2 : Pencil;
  const actionLabel =
    action === "INSERT" ? t("history.created")
      : action === "DELETE" ? t("history.deleted")
      : t("history.updated");
  const styles = ACTION_STYLES[action];

  const lineNum = isLine ? (r.new_data?.line_number ?? r.old_data?.line_number ?? null) : null;
  const scopeLabel = isLine
    ? (lineNum ? t("history.lineNum").replace("{n}", String(lineNum)) : t("history.line"))
    : t("history.header");

  const changes: Change[] =
    action === "UPDATE"
      ? computeChanges(r.old_data, r.new_data)
      : action === "INSERT"
        ? summarizeInsert(r.table_name, r.new_data, locale as any, t)
        : summarizeInsert(r.table_name, r.old_data, locale as any, t);

  // Compact "field: a → b" preview (max 2)
  const preview = changes.slice(0, 2).map((c) => {
    const fname = humanize(c.field, locale as any);
    const after = formatValue(c.field, c.after, locale as any, t);
    if (action === "UPDATE") {
      const before = formatValue(c.field, c.before, locale as any, t);
      return { fname, before, after };
    }
    return { fname, before: null, after };
  });

  return (
    <div className="relative ps-10 pe-3 py-3 group">
      {/* Timeline line + dot */}
      {!isLast && <span className="absolute start-[19px] top-9 bottom-0 w-px bg-border" aria-hidden />}
      <span
        className={cn(
          "absolute start-2 top-3 inline-flex h-7 w-7 items-center justify-center rounded-full border ring-4",
          styles.bg, styles.text, styles.border, styles.ring,
        )}
      >
        <Icon className="h-3.5 w-3.5" />
      </span>

      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap min-w-0">
          <span className={cn("text-xs font-semibold", styles.text)}>{actionLabel}</span>
          <Badge variant="outline" className="text-[10px] py-0 h-5">{scopeLabel}</Badge>
          {action === "UPDATE" && (
            <Badge variant="secondary" className="text-[10px] py-0 h-5">
              {changes.length === 0
                ? t("history.noChanges")
                : t("history.changesCount").replace("{n}", String(changes.length))}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground shrink-0">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[9px] font-bold text-foreground">
              {userInitials(userName)}
            </span>
            <span className="font-medium text-foreground/80">{userName}</span>
          </span>
          <span aria-hidden>•</span>
          <span className="font-mono tabular-nums">
            {when.toLocaleString(locale === "ar" ? "ar-EG" : "en-GB", {
              year: "numeric", month: "2-digit", day: "2-digit",
              hour: "2-digit", minute: "2-digit",
            })}
          </span>
        </div>
      </div>

      {preview.length > 0 && (
        <div className="mt-2 space-y-1">
          {preview.map((p, i) => (
            <div key={i} className="text-[11px] flex items-center gap-2 flex-wrap">
              <span className="text-muted-foreground">{p.fname}:</span>
              {p.before !== null && (
                <>
                  <span className="px-1.5 py-0.5 rounded bg-destructive/10 text-destructive font-mono line-through decoration-destructive/40">
                    {p.before}
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground" />
                </>
              )}
              <span className="px-1.5 py-0.5 rounded bg-success/10 text-success font-mono">
                {p.after}
              </span>
            </div>
          ))}
          {changes.length > 2 && !expanded && (
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px] -ms-2"
              onClick={() => setExpanded(true)}
            >
              <ChevronDown className="h-3 w-3 me-1" />
              +{changes.length - 2} {t("history.more")} — {t("history.showDetails")}
            </Button>
          )}
        </div>
      )}

      {expanded && changes.length > 2 && (
        <div className="mt-2 rounded-md border bg-muted/30 overflow-hidden">
          <table className="w-full text-[11px]">
            <thead className="bg-muted/60 text-muted-foreground">
              <tr>
                <th className="text-start px-2 py-1.5 font-medium">{locale === "ar" ? "الحقل" : "Field"}</th>
                {action === "UPDATE" && <th className="text-start px-2 py-1.5 font-medium">{t("history.before")}</th>}
                <th className="text-start px-2 py-1.5 font-medium">{t("history.after")}</th>
              </tr>
            </thead>
            <tbody>
              {changes.slice(2).map((c, i) => (
                <tr key={i} className="border-t">
                  <td className="px-2 py-1.5 text-muted-foreground">{humanize(c.field, locale as any)}</td>
                  {action === "UPDATE" && (
                    <td className="px-2 py-1.5 font-mono text-destructive line-through decoration-destructive/40">
                      {formatValue(c.field, c.before, locale as any, t)}
                    </td>
                  )}
                  <td className="px-2 py-1.5 font-mono text-success">
                    {formatValue(c.field, c.after, locale as any, t)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-2 py-1 border-t">
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-[11px]"
              onClick={() => setExpanded(false)}
            >
              <ChevronUp className="h-3 w-3 me-1" />
              {t("history.hideDetails")}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

export function HistoryLog({
  table,
  recordId,
}: {
  table: "journal_entries" | "invoices" | "payments" | "fixed_assets";
  recordId: string;
}) {
  const { t } = useI18n();
  const fn = useServerFn(getRecordHistory);
  const { data: rows = [], isLoading, error } = useQuery({
    queryKey: ["record-history", table, recordId],
    queryFn: () => fn({ data: { table, recordId } }),
    enabled: !!recordId,
  });

  const counts = useMemo(() => {
    const c = { INSERT: 0, UPDATE: 0, DELETE: 0 } as Record<string, number>;
    for (const r of rows as any[]) c[r.action] = (c[r.action] ?? 0) + 1;
    return c;
  }, [rows]);

  return (
    <div className="border rounded-lg overflow-hidden bg-card">
      <div className="flex items-center gap-2 px-4 py-3 bg-muted/40 border-b">
        <div className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-primary/10 text-primary">
          <History className="h-4 w-4" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold leading-tight">{t("history.title")}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">
            {rows.length} {t("history.entries")}
          </div>
        </div>
        {rows.length > 0 && (
          <div className="flex items-center gap-1.5 text-[10px]">
            {counts.INSERT > 0 && (
              <Badge variant="outline" className="bg-success/10 text-success border-success/30 h-5">
                <Plus className="h-2.5 w-2.5 me-0.5" />{counts.INSERT}
              </Badge>
            )}
            {counts.UPDATE > 0 && (
              <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30 h-5">
                <Pencil className="h-2.5 w-2.5 me-0.5" />{counts.UPDATE}
              </Badge>
            )}
            {counts.DELETE > 0 && (
              <Badge variant="outline" className="bg-destructive/10 text-destructive border-destructive/30 h-5">
                <Trash2 className="h-2.5 w-2.5 me-0.5" />{counts.DELETE}
              </Badge>
            )}
          </div>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto divide-y">
        {isLoading && (
          <div className="p-6 text-center text-xs text-muted-foreground">
            {t("common.loading")}
          </div>
        )}
        {error && (
          <div className="p-6 text-center text-xs text-destructive">
            {(error as Error).message}
          </div>
        )}
        {!isLoading && !error && rows.length === 0 && (
          <div className="p-8 text-center">
            <User className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
            <div className="text-xs text-muted-foreground">{t("history.empty")}</div>
          </div>
        )}
        {(rows as any[]).map((r: any, i: number) => (
          <EventRow key={r.id} r={r} isLast={i === rows.length - 1} />
        ))}
      </div>
    </div>
  );
}
