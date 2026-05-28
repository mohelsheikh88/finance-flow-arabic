import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAccounts, upsertAccount, deleteAccount } from "@/lib/api/accounting.functions";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
});

const TYPES = ["asset", "liability", "equity", "income", "expense"] as const;
type AccType = (typeof TYPES)[number];

type FormState = {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  account_type: AccType;
  parent_id: string;
  currency_code: string;
  is_group: boolean;
  is_active: boolean;
  is_reconcilable: boolean;
  notes: string;
};

const empty: FormState = {
  code: "",
  name_ar: "",
  name_en: "",
  account_type: "asset",
  parent_id: "",
  currency_code: "",
  is_group: false,
  is_active: true,
  is_reconcilable: false,
  notes: "",
};

function AccountsPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listAccounts);
  const upsert = useServerFn(upsertAccount);
  const remove = useServerFn(deleteAccount);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const parents = useMemo(
    () => (accounts as any[]).filter((a) => a.is_group && a.id !== form.id),
    [accounts, form.id],
  );

  const openNew = () => { setForm(empty); setOpen(true); };
  const openEdit = (a: any) => {
    setForm({
      id: a.id,
      code: a.code ?? "",
      name_ar: a.name_ar ?? "",
      name_en: a.name_en ?? "",
      account_type: a.account_type,
      parent_id: a.parent_id ?? "",
      currency_code: a.currency_code ?? "",
      is_group: !!a.is_group,
      is_active: !!a.is_active,
      is_reconcilable: !!a.is_reconcilable,
      notes: a.notes ?? "",
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
          account_type: form.account_type,
          parent_id: form.parent_id || null,
          currency_code: form.currency_code.trim() || null,
          is_group: form.is_group,
          is_active: form.is_active,
          is_reconcilable: form.is_reconcilable,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const typeColors: Record<string, string> = {
    asset: "bg-info/10 text-info border-info/30",
    liability: "bg-warning/10 text-warning border-warning/30",
    equity: "bg-primary/10 text-primary border-primary/30",
    income: "bg-success/10 text-success border-success/30",
    expense: "bg-destructive/10 text-destructive border-destructive/30",
  };

  const canSave = form.code && form.name_ar && form.name_en && !!companyId;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">{t("accounts.title")}</h1>
        <Button onClick={openNew} disabled={!companyId}>
          <Plus className="h-4 w-4 me-1" />{t("common.new")}
        </Button>
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium">{t("accounts.type")}</th>
              <th className="text-center p-3 font-medium">{t("accounts.isGroup")}</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
              <th className="text-end p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {(accounts as any[]).map((a) => {
              const depth = (a.code.match(/^\d+/)?.[0]?.length ?? 1) - 1;
              return (
                <tr key={a.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono" style={{ paddingInlineStart: `${12 + depth * 16}px` }}>{a.code}</td>
                  <td className="p-3 font-medium">{localized(a, "name")}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={typeColors[a.account_type]}>
                      {t(`accounts.${a.account_type}`)}
                    </Badge>
                  </td>
                  <td className="p-3 text-center">{a.is_group ? "✓" : ""}</td>
                  <td className="p-3 text-center">{a.is_active ? t("common.active") : t("common.inactive")}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 justify-end">
                      <Button size="sm" variant="ghost" onClick={() => openEdit(a)} aria-label={t("common.edit")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(a)} aria-label={t("common.delete")}
                        className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {accounts.length === 0 && (
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? t("common.edit") : t("common.new")} — {t("accounts.title")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.code")} *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={50} />
            </div>
            <div>
              <Label>{t("accounts.type")} *</Label>
              <Select value={form.account_type} onValueChange={(v) => setForm({ ...form, account_type: v as AccType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {TYPES.map((typ) => <SelectItem key={typ} value={typ}>{t(`accounts.${typ}`)}</SelectItem>)}
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
            <div className="col-span-2">
              <Label>{t("accounts.parent")}</Label>
              <Select value={form.parent_id || "__none"} onValueChange={(v) => setForm({ ...form, parent_id: v === "__none" ? "" : v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {parents.map((p: any) => (
                    <SelectItem key={p.id} value={p.id}>{p.code} — {localized(p, "name")}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("common.currency")}</Label>
              <Input value={form.currency_code} onChange={(e) => setForm({ ...form, currency_code: e.target.value.toUpperCase() })} maxLength={10} placeholder="SAR" />
            </div>
            <div className="flex items-end gap-4">
              <div className="flex items-center gap-2">
                <Switch checked={form.is_group} onCheckedChange={(v) => setForm({ ...form, is_group: v })} />
                <Label>{t("accounts.isGroup")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>{t("common.active")}</Label>
              </div>
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
