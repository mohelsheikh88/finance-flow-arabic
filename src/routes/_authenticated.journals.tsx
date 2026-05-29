import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listJournalsAdmin,
  upsertJournal,
  deleteJournal,
  listAccounts,
} from "@/lib/api/accounting.functions";
import { listCurrencies } from "@/lib/api/currencies.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, FilterX, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/journals")({
  component: JournalsPage,
});

const JOURNAL_TYPES = ["sales", "purchase", "bank", "cash", "misc"] as const;
type JournalType = (typeof JOURNAL_TYPES)[number];

const typeColors: Record<JournalType, string> = {
  sales: "bg-success/10 text-success border-success/30",
  purchase: "bg-warning/10 text-warning border-warning/30",
  bank: "bg-info/10 text-info border-info/30",
  cash: "bg-primary/10 text-primary border-primary/30",
  misc: "bg-muted text-muted-foreground border-border",
};

const typeLabels: Record<JournalType, { en: string; ar: string }> = {
  sales: { en: "Sales", ar: "مبيعات" },
  purchase: { en: "Purchase", ar: "مشتريات" },
  bank: { en: "Bank", ar: "بنوك" },
  cash: { en: "Cash", ar: "نقدية" },
  misc: { en: "Miscellaneous", ar: "متنوعة" },
};

type FormState = {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  journal_type: JournalType;
  sequence_prefix: string;
  sequence_next: number;
  currency_code: string;
  default_debit_account_id: string;
  default_credit_account_id: string;
  is_active: boolean;
};

const empty: FormState = {
  code: "",
  name_ar: "",
  name_en: "",
  journal_type: "misc",
  sequence_prefix: "",
  sequence_next: 1,
  currency_code: "",
  default_debit_account_id: "",
  default_credit_account_id: "",
  is_active: true,
};

const NONE = "__none__";

function JournalsPage() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listJournalsAdmin);
  const upsert = useServerFn(upsertJournal);
  const remove = useServerFn(deleteJournal);
  const accountsFn = useServerFn(listAccounts);
  const currenciesFn = useServerFn(listCurrencies);

  const { data: rows = [] } = useQuery({
    queryKey: ["journals_admin", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => accountsFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const { data: currencies = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: () => currenciesFn(),
  });

  const leafAccounts = useMemo(
    () => (accounts as any[]).filter((a) => !a.is_group && a.is_active),
    [accounts],
  );

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<JournalType | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const filtered = useMemo(() => {
    return (rows as any[]).filter((r) => {
      const s = search.trim().toLowerCase();
      const matchSearch =
        !s ||
        r.code?.toLowerCase().includes(s) ||
        r.name_ar?.toLowerCase().includes(s) ||
        r.name_en?.toLowerCase().includes(s) ||
        r.sequence_prefix?.toLowerCase().includes(s);
      const matchType = filterType === "all" || r.journal_type === filterType;
      const matchStatus =
        filterStatus === "all" ||
        (filterStatus === "active" ? r.is_active : !r.is_active);
      return matchSearch && matchType && matchStatus;
    });
  }, [rows, search, filterType, filterStatus]);

  const openNew = () => {
    setForm(empty);
    setOpen(true);
  };

  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      code: r.code ?? "",
      name_ar: r.name_ar ?? "",
      name_en: r.name_en ?? "",
      journal_type: r.journal_type,
      sequence_prefix: r.sequence_prefix ?? "",
      sequence_next: r.sequence_next ?? 1,
      currency_code: r.currency_code ?? "",
      default_debit_account_id: r.default_debit_account_id ?? "",
      default_credit_account_id: r.default_credit_account_id ?? "",
      is_active: !!r.is_active,
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: form.id,
          company_id: companyId!,
          code: form.code.trim(),
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim(),
          journal_type: form.journal_type,
          sequence_prefix: form.sequence_prefix.trim() || null,
          sequence_next: Number(form.sequence_next) || 1,
          currency_code: form.currency_code || null,
          default_debit_account_id: form.default_debit_account_id || null,
          default_credit_account_id: form.default_credit_account_id || null,
          is_active: form.is_active,
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["journals_admin"] });
      qc.invalidateQueries({ queryKey: ["journals"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["journals_admin"] });
      qc.invalidateQueries({ queryKey: ["journals"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave =
    !!companyId && form.code.trim() && form.name_ar.trim() && form.name_en.trim();

  const handleExport = () => {
    const data = (filtered as any[]).map((r) => ({
      code: r.code,
      name_ar: r.name_ar,
      name_en: r.name_en,
      journal_type: r.journal_type,
      sequence_prefix: r.sequence_prefix ?? "",
      sequence_next: r.sequence_next ?? 1,
      currency_code: r.currency_code ?? "",
      default_debit_account: r.default_debit_account?.code ?? "",
      default_credit_account: r.default_credit_account?.code ?? "",
      is_active: r.is_active ? 1 : 0,
    }));
    const ws = XLSX.utils.json_to_sheet(
      data.length
        ? data
        : [
            {
              code: "",
              name_ar: "",
              name_en: "",
              journal_type: "",
              sequence_prefix: "",
              sequence_next: 1,
              currency_code: "",
              default_debit_account: "",
              default_credit_account: "",
              is_active: 1,
            },
          ],
    );
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "journals");
    XLSX.writeFile(wb, `journals_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const typeLabel = (tp: JournalType) => typeLabels[tp][lang === "ar" ? "ar" : "en"];

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="page-title">{t("nav.journalTypes")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleExport} disabled={!companyId}>
            <FileDown className="h-4 w-4 me-1" />
            Export
          </Button>
          <Button onClick={openNew} disabled={!companyId}>
            <Plus className="h-4 w-4 me-1" />
            {t("common.new")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("common.search")}</Label>
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder={t("common.search")}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="ps-9"
            />
          </div>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("common.type")}</Label>
          <Select value={filterType} onValueChange={(v) => setFilterType(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {JOURNAL_TYPES.map((tp) => (
                <SelectItem key={tp} value={tp}>
                  {typeLabel(tp)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">{t("common.status")}</Label>
          <Select value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="active">{t("common.active")}</SelectItem>
              <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button
            variant="ghost"
            size="sm"
            className="text-muted-foreground w-full"
            onClick={() => {
              setSearch("");
              setFilterType("all");
              setFilterStatus("all");
            }}
          >
            <FilterX className="h-4 w-4 me-1" />
            {t("common.clear")}
          </Button>
        </div>
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">Name (EN)</th>
              <th className="text-start p-3 font-medium">Name (AR)</th>
              <th className="text-start p-3 font-medium">{t("common.type")}</th>
              <th className="text-start p-3 font-medium">Prefix</th>
              <th className="text-center p-3 font-medium">Next #</th>
              <th className="text-start p-3 font-medium">{t("common.currency")}</th>
              <th className="text-start p-3 font-medium">Default Debit</th>
              <th className="text-start p-3 font-medium">Default Credit</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
              <th className="text-end p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r: any) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{r.code}</td>
                <td className="p-3 font-medium">{r.name_en}</td>
                <td className="p-3 font-medium" dir="rtl">{r.name_ar}</td>
                <td className="p-3">
                  <Badge variant="outline" className={typeColors[r.journal_type as JournalType]}>
                    {typeLabel(r.journal_type)}
                  </Badge>
                </td>
                <td className="p-3 font-mono text-muted-foreground">{r.sequence_prefix ?? "—"}</td>
                <td className="p-3 text-center font-mono">{r.sequence_next ?? 1}</td>
                <td className="p-3 font-mono">{r.currency_code ?? "—"}</td>
                <td className="p-3 text-muted-foreground">
                  {r.default_debit_account
                    ? `${r.default_debit_account.code} — ${localized(r.default_debit_account, "name")}`
                    : "—"}
                </td>
                <td className="p-3 text-muted-foreground">
                  {r.default_credit_account
                    ? `${r.default_credit_account.code} — ${localized(r.default_credit_account, "name")}`
                    : "—"}
                </td>
                <td className="p-3 text-center">
                  {r.is_active ? t("common.active") : t("common.inactive")}
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(r)}
                      aria-label={t("common.edit")}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setToDelete(r)}
                      aria-label={t("common.delete")}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={11} className="p-8 text-center text-muted-foreground">
                  {t("common.noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setForm(empty);
        }}
      >
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {form.id ? t("common.edit") : t("common.new")} — Journal
            </DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.code")} *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                maxLength={20}
              />
            </div>
            <div>
              <Label>{t("common.type")} *</Label>
              <Select
                value={form.journal_type}
                onValueChange={(v) => setForm({ ...form, journal_type: v as JournalType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {JOURNAL_TYPES.map((tp) => (
                    <SelectItem key={tp} value={tp}>
                      {typeLabel(tp)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label>{t("common.nameEn")} *</Label>
              <Input
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                maxLength={255}
              />
            </div>
            <div>
              <Label>{t("common.nameAr")} *</Label>
              <Input
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                maxLength={255}
                dir="rtl"
              />
            </div>

            <div>
              <Label>Sequence Prefix</Label>
              <Input
                value={form.sequence_prefix}
                onChange={(e) => setForm({ ...form, sequence_prefix: e.target.value })}
                maxLength={20}
                placeholder="e.g. INV / JV / PAY"
              />
            </div>
            <div>
              <Label>Next Sequence #</Label>
              <Input
                type="number"
                min={1}
                value={form.sequence_next}
                onChange={(e) =>
                  setForm({ ...form, sequence_next: Number(e.target.value) || 1 })
                }
              />
            </div>

            <div>
              <Label>{t("common.currency")}</Label>
              <Select
                value={form.currency_code || NONE}
                onValueChange={(v) =>
                  setForm({ ...form, currency_code: v === NONE ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("common.none")}</SelectItem>
                  {(currencies as any[]).map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} — {localized(c, "name")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>{t("common.active")}</Label>
            </div>

            <div className="col-span-2">
              <Label>Default Debit Account</Label>
              <Select
                value={form.default_debit_account_id || NONE}
                onValueChange={(v) =>
                  setForm({ ...form, default_debit_account_id: v === NONE ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("common.none")}</SelectItem>
                  {leafAccounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {localized(a, "name")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="col-span-2">
              <Label>Default Credit Account</Label>
              <Select
                value={form.default_credit_account_id || NONE}
                onValueChange={(v) =>
                  setForm({ ...form, default_credit_account_id: v === NONE ? "" : v })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("common.select")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>{t("common.none")}</SelectItem>
                  {leafAccounts.map((a: any) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {localized(a, "name")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button
              onClick={() => saveMut.mutate()}
              disabled={!canSave || saveMut.isPending}
            >
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common.delete")} — {toDelete?.code}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {toDelete ? localized(toDelete, "name") : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMut.mutate(toDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
