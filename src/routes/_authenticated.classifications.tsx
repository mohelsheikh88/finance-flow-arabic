import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listClassifications,
  upsertClassification,
  deleteClassification,
} from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, ArrowLeft, Search, FilterX } from "lucide-react";
import { toast } from "sonner";


export const Route = createFileRoute("/_authenticated/classifications")({
  component: () => <ClassificationsPage />,
});

const BUCKETS = ["asset", "liability", "equity", "income", "expense"] as const;
type Bucket = (typeof BUCKETS)[number];
type Statement = "balance_sheet" | "income_statement";
type NormalBalance = "debit" | "credit";

type FormState = {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  statement: Statement;
  normal_balance: NormalBalance;
  bucket: Bucket;
  is_active: boolean;
  notes: string;
};

const empty: FormState = {
  code: "",
  name_ar: "",
  name_en: "",
  statement: "balance_sheet",
  normal_balance: "debit",
  bucket: "asset",
  is_active: true,
  notes: "",
};

const bucketColors: Record<string, string> = {
  asset: "bg-info/10 text-info border-info/30",
  liability: "bg-warning/10 text-warning border-warning/30",
  equity: "bg-primary/10 text-primary border-primary/30",
  income: "bg-success/10 text-success border-success/30",
  expense: "bg-destructive/10 text-destructive border-destructive/30",
};

function useLabels() {
  const { t } = useI18n();
  return {
    statement: (s: Statement) => s === "balance_sheet" ? t("accounts.balanceSheet") : t("accounts.incomeStatement"),
    normalBalance: (n: NormalBalance) => n === "debit" ? t("accounts.debit") : t("accounts.credit"),
  };
}


export function ClassificationsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const localized = useLocalized();
  const { statement: statementLabel, normalBalance: normalBalanceLabel } = useLabels();
  const { companyId } = useBranch();
  const qc = useQueryClient();


  const list = useServerFn(listClassifications);
  const upsert = useServerFn(upsertClassification);
  const remove = useServerFn(deleteClassification);

  const { data: rows = [] } = useQuery({
    queryKey: ["classifications", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const [search, setSearch] = useState("");
  const [filterStatement, setFilterStatement] = useState<Statement | "all">("all");
  const [filterNormalBalance, setFilterNormalBalance] = useState<NormalBalance | "all">("all");
  const [filterBucket, setFilterBucket] = useState<Bucket | "all">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "active" | "inactive">("all");

  const filteredRows = useMemo(() => {
    return (rows as any[]).filter((r) => {
      const matchesSearch =
        search.trim() === "" ||
        (r.code && r.code.toLowerCase().includes(search.toLowerCase())) ||
        (r.name_ar && r.name_ar.toLowerCase().includes(search.toLowerCase())) ||
        (r.name_en && r.name_en.toLowerCase().includes(search.toLowerCase()));
      const matchesStatement = filterStatement === "all" || r.statement === filterStatement;
      const matchesNormalBalance = filterNormalBalance === "all" || r.normal_balance === filterNormalBalance;
      const matchesBucket = filterBucket === "all" || r.bucket === filterBucket;
      const matchesStatus = filterStatus === "all" || (filterStatus === "active" ? r.is_active : !r.is_active);
      return matchesSearch && matchesStatement && matchesNormalBalance && matchesBucket && matchesStatus;
    });
  }, [rows, search, filterStatement, filterNormalBalance, filterBucket, filterStatus]);


  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      code: r.code ?? "",
      name_ar: r.name_ar ?? "",
      name_en: r.name_en ?? "",
      statement: r.statement,
      normal_balance: r.normal_balance,
      bucket: r.bucket,
      is_active: !!r.is_active,
      notes: r.notes ?? "",
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
          statement: form.statement,
          normal_balance: form.normal_balance,
          bucket: form.bucket,
          is_active: form.is_active,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["classifications"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["classifications"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.code && form.name_ar && form.name_en && !!companyId;

  return (
    <div className={embedded ? "space-y-4" : "p-6 space-y-4"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/account-types"><ArrowLeft className="h-4 w-4 me-1" />{t("accounts.backToAccountTypes")}</Link>
            </Button>
            <h1 className="text-2xl font-bold">{t("accounts.classificationsTitle")}</h1>
          </div>
          <Button onClick={openNew} disabled={!companyId}>
            <Plus className="h-4 w-4 me-1" />{t("common.new")}
          </Button>
        </div>
      )}

      {embedded && (
        <div className="flex items-center justify-end">
          <Button onClick={openNew} disabled={!companyId}>
            <Plus className="h-4 w-4 me-1" />{t("common.new")}
          </Button>
        </div>
      )}

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium">{t("accounts.statement")}</th>
              <th className="text-start p-3 font-medium">{t("accounts.normalBalance")}</th>
              <th className="text-start p-3 font-medium">{t("accounts.accountingBucket")}</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
              <th className="text-end p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>

          <tbody>
            {(rows as any[]).map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{r.code}</td>
                <td className="p-3 font-medium">{localized(r, "name")}</td>
                <td className="p-3 text-muted-foreground">{statementLabel(r.statement)}</td>
                <td className="p-3 text-muted-foreground">{normalBalanceLabel(r.normal_balance)}</td>
                <td className="p-3">
                  <Badge variant="outline" className={bucketColors[r.bucket]}>
                    {t(`accounts.${r.bucket}`)}
                  </Badge>
                </td>
                <td className="p-3 text-center">{r.is_active ? t("common.active") : t("common.inactive")}</td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-end">
                    <Button size="sm" variant="ghost" onClick={() => openEdit(r)} aria-label={t("common.edit")}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setToDelete(r)}
                      aria-label={t("common.delete")}
                      className="text-destructive hover:text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? t("common.edit") : t("common.new")} — {t("accounts.classificationSingular")}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.code")} *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={50} />
            </div>
            <div>
              <Label>{t("accounts.accountingBucket")} *</Label>

              <Select value={form.bucket} onValueChange={(v) => setForm({ ...form, bucket: v as Bucket })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BUCKETS.map((c) => (
                    <SelectItem key={c} value={c}>{t(`accounts.${c}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("common.nameAr")} *</Label>
              <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} maxLength={255} />
            </div>
            <div>
              <Label>{t("common.nameEn")} *</Label>
              <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} maxLength={255} />
            </div>
            <div>
              <Label>{t("accounts.statement")} *</Label>
              <Select value={form.statement} onValueChange={(v) => setForm({ ...form, statement: v as Statement })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance_sheet">{t("accounts.balanceSheet")}</SelectItem>
                  <SelectItem value="income_statement">{t("accounts.incomeStatement")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("accounts.normalBalance")} *</Label>
              <Select value={form.normal_balance} onValueChange={(v) => setForm({ ...form, normal_balance: v as NormalBalance })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">{t("accounts.debit")}</SelectItem>
                  <SelectItem value="credit">{t("accounts.credit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>{t("common.active")}</Label>
            </div>
            <div className="col-span-2">
              <Label>{t("common.notes")}</Label>
              <Input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} maxLength={2000} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")} — {toDelete?.code}</AlertDialogTitle>
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
