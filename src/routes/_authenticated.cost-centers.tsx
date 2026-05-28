import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCostCenters, upsertCostCenter, deleteCostCenter } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
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

export const Route = createFileRoute("/_authenticated/cost-centers")({
  component: () => <CostCentersPage />,
});

type FormState = {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  parent_id: string | null;
  is_group: boolean;
  is_active: boolean;
};

const empty: FormState = {
  code: "",
  name_ar: "",
  name_en: "",
  parent_id: null,
  is_group: false,
  is_active: true,
};

export function CostCentersPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listCostCenters);
  const upsert = useServerFn(upsertCostCenter);
  const remove = useServerFn(deleteCostCenter);

  const { data: rows = [] } = useQuery({
    queryKey: ["cost_centers", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const groups = (rows as any[]).filter((r) => r.is_group);

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
      parent_id: r.parent_id ?? null,
      is_group: !!r.is_group,
      is_active: !!r.is_active,
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () => upsert({
      data: {
        id: form.id,
        company_id: companyId!,
        code: form.code.trim(),
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim(),
        parent_id: form.parent_id,
        is_group: form.is_group,
        is_active: form.is_active,
      },
    }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["cost_centers"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["cost_centers"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.code && form.name_ar && form.name_en && !!companyId;
  const parentName = (id: string | null) => {
    if (!id) return "—";
    const p = (rows as any[]).find((r) => r.id === id);
    return p ? `${p.code} — ${localized(p, "name")}` : "—";
  };

  return (
    <div className={embedded ? "space-y-4" : "p-6 space-y-4"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/accounts"><ArrowLeft className="h-4 w-4 me-1" />{t("accounts.title")}</Link>
            </Button>
            <h1 className="text-2xl font-bold">{t("nav.cost-centers")}</h1>
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
              <th className="text-start p-3 font-medium">{t("common.parent") || "Parent"}</th>
              <th className="text-center p-3 font-medium">{t("common.type") || "Type"}</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
              <th className="text-end p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {(rows as any[]).map((r) => (
              <tr key={r.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{r.code}</td>
                <td className="p-3 font-medium">{localized(r, "name")}</td>
                <td className="p-3 text-muted-foreground">{parentName(r.parent_id)}</td>
                <td className="p-3 text-center">{r.is_group ? (t("common.group") || "Group") : (t("common.leaf") || "Leaf")}</td>
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
              <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? t("common.edit") : t("common.new")} — {t("nav.cost-centers")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.code")} *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={50} />
            </div>
            <div>
              <Label>{t("common.parent") || "Parent"}</Label>
              <Select value={form.parent_id ?? "__none"} onValueChange={(v) =>
                setForm({ ...form, parent_id: v === "__none" ? null : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">—</SelectItem>
                  {groups.filter((g) => g.id !== form.id).map((g) => (
                    <SelectItem key={g.id} value={g.id}>{g.code} — {localized(g, "name")}</SelectItem>
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
              <Switch checked={form.is_group} onCheckedChange={(v) => setForm({ ...form, is_group: v })} />
              <Label>{t("common.group") || "Group"}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label>{t("common.active")}</Label>
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
