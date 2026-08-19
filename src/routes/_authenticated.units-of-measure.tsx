import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useI18n, useLocalized } from "@/i18n";
import { useBranch } from "@/lib/branch-context";
import {
  listUomCategories, upsertUomCategory, deleteUomCategory,
  listUnitsOfMeasure, upsertUnitOfMeasure, deleteUnitOfMeasure,
} from "@/lib/api/purchase.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Ruler, ArrowLeft, Star } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/units-of-measure")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const listCatFn = useServerFn(listUomCategories);
  const upsertCatFn = useServerFn(upsertUomCategory);
  const deleteCatFn = useServerFn(deleteUomCategory);
  const listUomFn = useServerFn(listUnitsOfMeasure);
  const upsertUomFn = useServerFn(upsertUnitOfMeasure);
  const deleteUomFn = useServerFn(deleteUnitOfMeasure);

  const { data: cats = [] } = useQuery({
    queryKey: ["uom_categories", companyId],
    queryFn: () => listCatFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: uoms = [], isLoading } = useQuery({
    queryKey: ["units_of_measure", companyId],
    queryFn: () => listUomFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const uomsByCat = useMemo(() => {
    const m = new Map<string, any[]>();
    for (const u of uoms as any[]) {
      (m.get(u.uom_category_id) ?? m.set(u.uom_category_id, []).get(u.uom_category_id)!).push(u);
    }
    return m;
  }, [uoms]);

  // ===== Category dialog =====
  const emptyCat = { id: undefined as string | undefined, name_ar: "", name_en: "", is_active: true };
  const [catOpen, setCatOpen] = useState(false);
  const [catForm, setCatForm] = useState(emptyCat);
  const [catDeleteId, setCatDeleteId] = useState<string | null>(null);

  const openNewCat = () => { setCatForm(emptyCat); setCatOpen(true); };
  const openEditCat = (c: any) => { setCatForm({ id: c.id, name_ar: c.name_ar, name_en: c.name_en, is_active: c.is_active }); setCatOpen(true); };

  const saveCatMut = useMutation({
    mutationFn: () => upsertCatFn({ data: { ...catForm, company_id: companyId! } }),
    onSuccess: () => { toast.success(t("common.saved")); setCatOpen(false); qc.invalidateQueries({ queryKey: ["uom_categories"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteCatMut = useMutation({
    mutationFn: (id: string) => deleteCatFn({ data: { id } }),
    onSuccess: () => { toast.success(t("common.saved")); setCatDeleteId(null); qc.invalidateQueries({ queryKey: ["uom_categories"] }); },
    onError: (e: Error) => { toast.error(e.message); setCatDeleteId(null); },
  });

  // ===== Unit dialog =====
  const emptyUom = { id: undefined as string | undefined, uom_category_id: "", code: "", name_ar: "", name_en: "", factor: 1, is_reference: false, is_active: true };
  const [uomOpen, setUomOpen] = useState(false);
  const [uomForm, setUomForm] = useState(emptyUom);
  const [uomDeleteId, setUomDeleteId] = useState<string | null>(null);

  const openNewUom = (catId: string) => { setUomForm({ ...emptyUom, uom_category_id: catId }); setUomOpen(true); };
  const openEditUom = (u: any) => { setUomForm({ id: u.id, uom_category_id: u.uom_category_id, code: u.code, name_ar: u.name_ar, name_en: u.name_en, factor: u.factor, is_reference: u.is_reference, is_active: u.is_active }); setUomOpen(true); };

  const saveUomMut = useMutation({
    mutationFn: () => upsertUomFn({ data: { ...uomForm, company_id: companyId!, factor: Number(uomForm.factor) } }),
    onSuccess: () => { toast.success(t("common.saved")); setUomOpen(false); qc.invalidateQueries({ queryKey: ["units_of_measure"] }); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteUomMut = useMutation({
    mutationFn: (id: string) => deleteUomFn({ data: { id } }),
    onSuccess: () => { toast.success(t("common.saved")); setUomDeleteId(null); qc.invalidateQueries({ queryKey: ["units_of_measure"] }); },
    onError: (e: Error) => { toast.error(e.message); setUomDeleteId(null); },
  });

  const canSaveCat = catForm.name_ar.trim() && catForm.name_en.trim();
  const canSaveUom = uomForm.code.trim() && uomForm.name_ar.trim() && uomForm.name_en.trim() && Number(uomForm.factor) > 0;
  const refUnitLabel = (catId: string) => {
    const ref = (uomsByCat.get(catId) ?? []).find((u) => u.is_reference);
    return ref ? localized(ref, "name") : "—";
  };

  return (
    <div className="p-6 space-y-4 max-w-4xl mx-auto">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/apps"><ArrowLeft className="h-4 w-4 me-1" />{t("nav.purchaseProcurement")}</Link>
        </Button>
      </div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Ruler className="h-5 w-5 text-muted-foreground" />
          <h1 className="page-title">{t("nav.unitsOfMeasure")}</h1>
        </div>
        <Button size="sm" onClick={openNewCat} disabled={!companyId}><Plus className="h-4 w-4 me-1" />{t("purchase.newUomCategory")}</Button>
      </div>
      <p className="text-xs text-muted-foreground">{t("purchase.uomHint")}</p>

      <div className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-8">{t("common.loading")}</p>
        ) : cats.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">{t("common.noData")}</Card>
        ) : (
          (cats as any[]).map((cat) => (
            <Card key={cat.id} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-sm">{localized(cat, "name")}</span>
                  <Badge variant="outline" className="text-[10px]">{t("purchase.referenceUnit")}: {refUnitLabel(cat.id)}</Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="sm" className="h-7 px-2" onClick={() => openNewUom(cat.id)}><Plus className="h-3.5 w-3.5 me-1" />{t("purchase.newUnit")}</Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEditCat(cat)}><Pencil className="h-3.5 w-3.5" /></Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setCatDeleteId(cat.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                </div>
              </div>
              <div className="space-y-1">
                {(uomsByCat.get(cat.id) ?? []).map((u) => (
                  <div key={u.id} className="flex items-center gap-2.5 rounded-md px-2.5 py-2 hover:bg-accent/30 text-sm">
                    {u.is_reference ? <Star className="h-3.5 w-3.5 text-primary shrink-0" fill="currentColor" /> : <span className="w-3.5 shrink-0" />}
                    <span className="flex-1">{localized(u, "name")}</span>
                    <span className="text-xs text-muted-foreground font-mono">{u.code}</span>
                    <span className="text-xs text-muted-foreground">
                      {u.is_reference ? t("purchase.referenceUnit") : `1 ${localized(u, "name")} = ${u.factor} ${refUnitLabel(cat.id)}`}
                    </span>
                    <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => openEditUom(u)}><Pencil className="h-3 w-3" /></Button>
                    <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => setUomDeleteId(u.id)}><Trash2 className="h-3 w-3" /></Button>
                  </div>
                ))}
                {(uomsByCat.get(cat.id) ?? []).length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-3">{t("common.noData")}</p>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Category dialog */}
      <Dialog open={catOpen} onOpenChange={setCatOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{catForm.id ? t("common.edit") : t("purchase.newUomCategory")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.name")} (AR)</Label><Input value={catForm.name_ar} onChange={(e) => setCatForm((f) => ({ ...f, name_ar: e.target.value }))} dir="rtl" /></div>
              <div><Label>{t("common.name")} (EN)</Label><Input value={catForm.name_en} onChange={(e) => setCatForm((f) => ({ ...f, name_en: e.target.value }))} dir="ltr" /></div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={catForm.is_active} onCheckedChange={(v) => setCatForm((f) => ({ ...f, is_active: v }))} />
              <Label>{t("common.active")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCatOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveCatMut.mutate()} disabled={!canSaveCat || saveCatMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unit dialog */}
      <Dialog open={uomOpen} onOpenChange={setUomOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{uomForm.id ? t("common.edit") : t("purchase.newUnit")}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.code")}</Label><Input value={uomForm.code} onChange={(e) => setUomForm((f) => ({ ...f, code: e.target.value.toUpperCase() }))} dir="ltr" /></div>
              <div className="flex items-center gap-2 pt-6">
                <Switch checked={uomForm.is_reference} onCheckedChange={(v) => setUomForm((f) => ({ ...f, is_reference: v, factor: v ? 1 : f.factor }))} />
                <Label>{t("purchase.referenceUnit")}</Label>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.name")} (AR)</Label><Input value={uomForm.name_ar} onChange={(e) => setUomForm((f) => ({ ...f, name_ar: e.target.value }))} dir="rtl" /></div>
              <div><Label>{t("common.name")} (EN)</Label><Input value={uomForm.name_en} onChange={(e) => setUomForm((f) => ({ ...f, name_en: e.target.value }))} dir="ltr" /></div>
            </div>
            <div>
              <Label>{t("purchase.conversionFactor")}</Label>
              <Input type="number" step="0.000001" value={uomForm.factor} disabled={uomForm.is_reference} onChange={(e) => setUomForm((f) => ({ ...f, factor: Number(e.target.value) }))} />
              <p className="text-[11px] text-muted-foreground mt-1">{t("purchase.conversionFactorHint")}</p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setUomOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveUomMut.mutate()} disabled={!canSaveUom || saveUomMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!catDeleteId} onOpenChange={(o) => !o && setCatDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => catDeleteId && deleteCatMut.mutate(catDeleteId)}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!uomDeleteId} onOpenChange={(o) => !o && setUomDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => uomDeleteId && deleteUomMut.mutate(uomDeleteId)}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
