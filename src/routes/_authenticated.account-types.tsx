import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccountTypes, upsertAccountType, deleteAccountType, listClassifications } from "@/lib/api/accounting.functions";

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
import { Plus, Pencil, Trash2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account-types")({
  component: () => <AccountTypesPage />,
});

const CLASSIFICATIONS = ["asset", "liability", "equity", "income", "expense"] as const;
type Cls = (typeof CLASSIFICATIONS)[number];
type FormState = {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  classification: Cls;
  classification_id: string | null;
  is_active: boolean;
  notes: string;
};

const empty: FormState = {
  code: "",
  name_ar: "",
  name_en: "",
  classification: "asset",
  classification_id: null,
  is_active: true,
  notes: "",
};



const clsColors: Record<string, string> = {
  asset: "bg-info/10 text-info border-info/30",
  liability: "bg-warning/10 text-warning border-warning/30",
  equity: "bg-primary/10 text-primary border-primary/30",
  income: "bg-success/10 text-success border-success/30",
  expense: "bg-destructive/10 text-destructive border-destructive/30",
};

function useStatementLabel() {
  const { t } = useI18n();
  return (classification: Cls) => {
    switch (classification) {
      case "asset":
      case "liability":
      case "equity":
        return t("accounts.balanceSheet");
      case "income":
      case "expense":
        return t("accounts.incomeStatement");
      default:
        return "";
    }
  };
}


export function AccountTypesPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const localized = useLocalized();
  const statementLabel = useStatementLabel();
  const { companyId } = useBranch();
  const qc = useQueryClient();


  const list = useServerFn(listAccountTypes);
  const upsert = useServerFn(upsertAccountType);
  const remove = useServerFn(deleteAccountType);
  const listCls = useServerFn(listClassifications);

  const { data: types = [] } = useQuery({
    queryKey: ["account_types", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const { data: classifications = [] } = useQuery({
    queryKey: ["classifications", companyId],
    queryFn: () => listCls({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const activeClassifications = (classifications as any[]).filter((c) => c.is_active);

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (r: any) => {
    setForm({
      id: r.id,
      code: r.code ?? "",
      name_ar: r.name_ar ?? "",
      name_en: r.name_en ?? "",
      classification: r.classification,
      classification_id: r.classification_id ?? null,
      is_active: !!r.is_active,
      notes: r.notes ?? "",
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () => {
      const selected = (classifications as any[]).find((c) => c.id === form.classification_id);
      const cls = (selected?.bucket as Cls) ?? form.classification;
      return upsert({
        data: {
          id: form.id,
          company_id: companyId!,
          code: form.code.trim(),
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim(),
          classification: cls,
          classification_id: form.classification_id,
          is_active: form.is_active,
          notes: form.notes.trim() || null,
        },
      });
    },

    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["account_types"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["account_types"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.code && form.name_ar && form.name_en && form.classification_id && !!companyId;


  return (
    <div className={embedded ? "space-y-4" : "p-6 space-y-4"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/accounts"><ArrowLeft className="h-4 w-4 me-1" />{t("accounts.title")}</Link>
            </Button>
            <h1 className="text-2xl font-bold">{t("accounts.accountTypesTitle")}</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" asChild>
              <Link to="/classifications">{t("accounts.manageClassifications")}</Link>
            </Button>
            <Button onClick={openNew} disabled={!companyId}>
              <Plus className="h-4 w-4 me-1" />{t("common.new")}
            </Button>
          </div>
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
              <th className="text-start p-3 font-medium">Core Classification</th>
              <th className="text-start p-3 font-medium">{t("accounts.classification")}</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
              <th className="text-end p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>

          <tbody>
            {(types as any[]).map((r) => {
              const cls = (classifications as any[]).find((c) => c.id === r.classification_id);
              return (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{r.code}</td>
                <td className="p-3 font-medium">{localized(r, "name")}</td>
                <td className="p-3 text-muted-foreground">{statementLabel(r.classification)}</td>
                <td className="p-3">
                  {cls ? (
                    <span className="inline-flex items-center gap-1">
                      <span className="font-mono text-muted-foreground">{cls.code}</span>
                      <span>—</span>
                      <span>{localized(cls, "name")}</span>
                    </span>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </td>
                <td className="p-3">
                  <Badge variant="outline" className={clsColors[r.classification]}>
                    {t(`accounts.${r.classification}`)}
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
              );
            })}
            {types.length === 0 && (
              <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            )}
          </tbody>
        </table>
      </Card>


      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? t("common.edit") : t("common.new")} — {t("accounts.accountTypeSingular")}</DialogTitle>

          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.code")} *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={50} />
            </div>
            <div>
              <Label>{t("accounts.classification")} *</Label>
              <Select value={form.classification_id ?? ""} onValueChange={(v) => {
                const sel = activeClassifications.find((c: any) => c.id === v);
                setForm({ ...form, classification_id: v, classification: (sel?.bucket as Cls) ?? form.classification });
              }}>
                <SelectTrigger><SelectValue placeholder={t("common.select") || "—"} /></SelectTrigger>
                <SelectContent>
                  {activeClassifications.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.code} — {localized(c, "name")}
                    </SelectItem>
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
