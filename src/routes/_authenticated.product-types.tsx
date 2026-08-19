import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n, useLocalized } from "@/i18n";
import { useBranch } from "@/lib/branch-context";
import { listProductTypes, upsertProductType, deleteProductType } from "@/lib/api/purchase.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Tags, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/product-types")({
  component: Page,
});

type FormState = {
  id?: string; code: string; name_ar: string; name_en: string; notes: string;
  tracks_inventory: boolean; is_active: boolean; sort_order: number;
};
const emptyForm: FormState = { code: "", name_ar: "", name_en: "", notes: "", tracks_inventory: true, is_active: true, sort_order: 0 };

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const listFn = useServerFn(listProductTypes);
  const upsertFn = useServerFn(upsertProductType);
  const deleteFn = useServerFn(deleteProductType);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["product_types", companyId],
    queryFn: () => listFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const openNew = () => { setForm(emptyForm); setOpen(true); };
  const openEdit = (r: any) => {
    setForm({
      id: r.id, code: r.code, name_ar: r.name_ar, name_en: r.name_en, notes: r.notes ?? "",
      tracks_inventory: r.tracks_inventory, is_active: r.is_active, sort_order: r.sort_order ?? 0,
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: () => upsertFn({ data: { ...form, company_id: companyId!, notes: form.notes || null } }),
    onSuccess: () => { toast.success(t("common.saved")); setOpen(false); qc.invalidateQueries({ queryKey: ["product_types"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => { toast.success(t("common.deleted")); setDeleteId(null); qc.invalidateQueries({ queryKey: ["product_types"] }); },
    onError: (e: Error) => { toast.error(e.message); setDeleteId(null); },
  });

  const canSave = form.code.trim() && form.name_ar.trim() && form.name_en.trim();

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/apps"><ArrowLeft className="h-4 w-4 me-1" />{t("nav.purchaseProcurement")}</Link>
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Tags className="h-5 w-5 text-muted-foreground" />
          <h1 className="page-title">{t("purchase.productTypesTitle")}</h1>
        </div>
        <Button size="sm" onClick={openNew} disabled={!companyId}><Plus className="h-4 w-4 me-1" />{t("purchase.newProductType")}</Button>
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{t("purchase.productTypesHint")}</p>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr>
              <th className="p-2.5 text-start">{t("common.code")}</th>
              <th className="p-2.5 text-start">{t("common.name")}</th>
              <th className="p-2.5 text-start">{t("purchase.tracksInventory")}</th>
              <th className="p-2.5 text-center">{t("common.status")}</th>
              <th className="p-2.5 text-center">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
            ) : (rows as any[]).length === 0 ? (
              <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            ) : (
              (rows as any[]).map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/20">
                  <td className="p-2.5 font-mono text-xs">{r.code}</td>
                  <td className="p-2.5">{localized(r, "name")}</td>
                  <td className="p-2.5">
                    <Badge variant="outline" className="text-[10.5px]">
                      {r.tracks_inventory ? t("purchase.tracksInventoryYes") : t("purchase.tracksInventoryNo")}
                    </Badge>
                  </td>
                  <td className="p-2.5 text-center"><Badge variant={r.is_active ? "default" : "secondary"} className="text-[10px]">{r.is_active ? t("common.active") : t("users.disabled")}</Badge></td>
                  <td className="p-2.5">
                    <div className="flex items-center justify-center gap-1">
                      <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(r)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(r.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{form.id ? t("common.edit") : t("purchase.newProductType")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.code")}</Label><Input value={form.code} onChange={(e) => setForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} dir="ltr" /></div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>{t("common.active")}</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.name")} (AR)</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" /></div>
              <div><Label>{t("common.name")} (EN)</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} dir="ltr" /></div>
            </div>
            <label className="flex items-center gap-2 rounded-md border p-2.5 text-sm cursor-pointer hover:bg-accent/40">
              <Switch checked={form.tracks_inventory} onCheckedChange={(v) => setForm({ ...form, tracks_inventory: v })} />
              <span>
                {t("purchase.tracksInventory")}
                <span className="block text-xs text-muted-foreground font-normal">{t("purchase.tracksInventoryHint")}</span>
              </span>
            </label>
            <div><Label>{t("common.notes")}</Label><Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} rows={2} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMut.mutate(deleteId)}>{t("common.delete")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
