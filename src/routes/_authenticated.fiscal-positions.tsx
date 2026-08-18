import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listFiscalPositions, createFiscalPosition, updateFiscalPosition, deleteFiscalPosition } from "@/lib/api/fiscal-positions.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Trash2, Scale, Pencil } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/fiscal-positions")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listFiscalPositions);
  const create = useServerFn(createFiscalPosition);
  const update = useServerFn(updateFiscalPosition);
  const remove = useServerFn(deleteFiscalPosition);

  const { data: rows = [] } = useQuery({
    queryKey: ["fiscal_positions", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const empty = {
    id: null as string | null,
    name_ar: "",
    name_en: "",
    is_saudi: true,
    vat_applicable: true,
    zakat_applicable: true,
    income_tax_applicable: false,
  };
  const [form, setForm] = useState(empty);

  const openCreate = () => { setForm(empty); setOpen(true); };
  const openEdit = (m: any) => {
    setForm({
      id: m.id,
      name_ar: m.name_ar ?? "",
      name_en: m.name_en ?? "",
      is_saudi: !!m.is_saudi,
      vat_applicable: !!m.vat_applicable,
      zakat_applicable: !!m.zakat_applicable,
      income_tax_applicable: !!m.income_tax_applicable,
    });
    setOpen(true);
  };

  const createMut = useMutation({
    mutationFn: () =>
      create({
        data: {
          company_id: companyId!,
          name_ar: form.name_ar,
          name_en: form.name_en,
          is_saudi: form.is_saudi,
          vat_applicable: form.vat_applicable,
          zakat_applicable: form.zakat_applicable,
          income_tax_applicable: form.income_tax_applicable,
          is_active: true,
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["fiscal_positions"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMut = useMutation({
    mutationFn: () =>
      update({
        data: {
          id: form.id!,
          name_ar: form.name_ar,
          name_en: form.name_en,
          is_saudi: form.is_saudi,
          vat_applicable: form.vat_applicable,
          zakat_applicable: form.zakat_applicable,
          income_tax_applicable: form.income_tax_applicable,
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["fiscal_positions"] });
      setOpen(false);
      setForm(empty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveMut = () => (form.id ? updateMut.mutate() : createMut.mutate());
  const saving = createMut.isPending || updateMut.isPending;

  const toggleActive = useMutation({
    mutationFn: (m: any) => update({ data: { id: m.id, is_active: !m.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fiscal_positions"] }),
  });

  const removeMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["fiscal_positions"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = form.name_ar && form.name_en;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title"><Scale className="h-5 w-5" />{t("fiscalPositions.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("fiscalPositions.subtitle")}</p>
        </div>
        <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 me-1" />{t("common.new")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader><DialogTitle>{form.id ? t("common.edit") : t("fiscalPositions.title")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div><Label>{t("common.nameAr")} *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
              <div><Label>{t("common.nameEn")} *</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
              <div className="flex items-center gap-2 col-span-2">
                <Switch checked={form.is_saudi} onCheckedChange={(v) => setForm({ ...form, is_saudi: v })} />
                <Label>{form.is_saudi ? t("fiscalPositions.isSaudi") : t("fiscalPositions.nonSaudi")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.vat_applicable} onCheckedChange={(v) => setForm({ ...form, vat_applicable: v })} />
                <Label>{t("fiscalPositions.vatApplicable")}</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch checked={form.zakat_applicable} onCheckedChange={(v) => setForm({ ...form, zakat_applicable: v })} />
                <Label>{t("fiscalPositions.zakatApplicable")}</Label>
              </div>
              <div className="flex items-center gap-2 col-span-2">
                <Switch checked={form.income_tax_applicable} onCheckedChange={(v) => setForm({ ...form, income_tax_applicable: v })} />
                <Label>{t("fiscalPositions.incomeTaxApplicable")}</Label>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={saveMut} disabled={!canSave || saving}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-center p-3 font-medium">{t("fiscalPositions.isSaudi")}</th>
              <th className="text-center p-3 font-medium">{t("fiscalPositions.vatApplicable")}</th>
              <th className="text-center p-3 font-medium">{t("fiscalPositions.zakatApplicable")}</th>
              <th className="text-center p-3 font-medium">{t("fiscalPositions.incomeTaxApplicable")}</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
              <th className="text-center p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((m: any) => (
              <tr key={m.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-medium">{localized(m, "name")}</td>
                <td className="p-3 text-center">
                  <Badge variant={m.is_saudi ? "default" : "outline"}>{m.is_saudi ? t("fiscalPositions.isSaudi") : t("fiscalPositions.nonSaudi")}</Badge>
                </td>
                <td className="p-3 text-center">{m.vat_applicable ? "✓" : "—"}</td>
                <td className="p-3 text-center">{m.zakat_applicable ? "✓" : "—"}</td>
                <td className="p-3 text-center">{m.income_tax_applicable ? "✓" : "—"}</td>
                <td className="p-3 text-center">
                  <button onClick={() => toggleActive.mutate(m)} className="text-xs underline">
                    {m.is_active ? t("common.active") : t("common.inactive")}
                  </button>
                </td>
                <td className="p-3 text-center">
                  <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => removeMut.mutate(m.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>
    </div>
  );
}
