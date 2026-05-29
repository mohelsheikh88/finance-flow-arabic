import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPaymentTerms,
  createPaymentTerm,
  updatePaymentTerm,
  deletePaymentTerm,
  seedPaymentTerms,
  PAYMENT_TERM_PRESETS,
} from "@/lib/api/payment-terms.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payment-terms")({
  component: Page,
});

type FormState = { name_ar: string; name_en: string; days: number; is_active: boolean };
const emptyForm: FormState = { name_ar: "", name_en: "", days: 30, is_active: true };

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listPaymentTerms);
  const create = useServerFn(createPaymentTerm);
  const update = useServerFn(updatePaymentTerm);
  const del = useServerFn(deletePaymentTerm);
  const seed = useServerFn(seedPaymentTerms);

  const { data: terms = [] } = useQuery({
    queryKey: ["payment-terms", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [seedOpen, setSeedOpen] = useState(false);
  const [selectedDays, setSelectedDays] = useState<Set<number>>(new Set());

  const existingDays = useMemo(() => new Set(terms.map((tr: any) => tr.days)), [terms]);

  const reset = () => { setForm(emptyForm); setEditing(null); };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) return update({ data: { id: editing.id, ...form } });
      return create({ data: { company_id: companyId!, ...form } });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["payment-terms"] });
      setOpen(false);
      reset();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => del({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.deleted"));
      qc.invalidateQueries({ queryKey: ["payment-terms"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const seedMut = useMutation({
    mutationFn: () => seed({ data: { company_id: companyId!, days_list: Array.from(selectedDays) } }),
    onSuccess: (res: any) => {
      toast.success(t("paymentTerms.seeded").replace("{count}", String(res?.inserted ?? 0)));
      qc.invalidateQueries({ queryKey: ["payment-terms"] });
      setSeedOpen(false);
      setSelectedDays(new Set());
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openEdit = (row: any) => {
    setEditing(row);
    setForm({ name_ar: row.name_ar, name_en: row.name_en, days: row.days, is_active: row.is_active });
    setOpen(true);
  };

  const toggleDay = (d: number) => {
    const next = new Set(selectedDays);
    if (next.has(d)) next.delete(d); else next.add(d);
    setSelectedDays(next);
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t("nav.paymentTerms")}</h1>
          <p className="text-sm text-muted-foreground">{terms.length}</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={seedOpen} onOpenChange={(v) => { setSeedOpen(v); if (!v) setSelectedDays(new Set()); }}>
            <DialogTrigger asChild>
              <Button variant="outline"><Sparkles className="h-4 w-4 me-1" />{t("paymentTerms.seed")}</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t("paymentTerms.seedTitle")}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{t("paymentTerms.seedDesc")}</p>
              <div className="flex gap-2 my-2">
                <Button size="sm" variant="outline" onClick={() => setSelectedDays(new Set(PAYMENT_TERM_PRESETS.filter((p) => !existingDays.has(p.days)).map((p) => p.days)))}>
                  {t("paymentMethods.selectAll")}
                </Button>
                <Button size="sm" variant="ghost" onClick={() => setSelectedDays(new Set())}>{t("paymentMethods.clearSelection")}</Button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_TERM_PRESETS.map((p) => {
                  const exists = existingDays.has(p.days);
                  return (
                    <label key={p.days} className={`flex items-center gap-2 p-2 rounded border ${exists ? "opacity-50" : "hover:bg-muted/50 cursor-pointer"}`}>
                      <Checkbox checked={selectedDays.has(p.days)} disabled={exists} onCheckedChange={() => toggleDay(p.days)} />
                      <div className="flex-1">
                        <div className="text-sm font-medium">{localized(p, "name")}</div>
                        <div className="text-xs text-muted-foreground">{p.days} {t("paymentTerms.days")}</div>
                      </div>
                      {exists && <Badge variant="secondary" className="text-xs">✓</Badge>}
                    </label>
                  );
                })}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setSeedOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={() => seedMut.mutate()} disabled={selectedDays.size === 0 || seedMut.isPending}>
                  {t("paymentMethods.seedAdd")} ({selectedDays.size})
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) reset(); }}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 me-1" />{t("paymentTerms.new")}</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editing ? t("paymentTerms.edit") : t("paymentTerms.new")}</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div><Label>{t("common.nameAr")}</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
                <div><Label>{t("common.nameEn")}</Label><Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
                <div><Label>{t("paymentTerms.days")}</Label><Input type="number" min={0} value={form.days} onChange={(e) => setForm({ ...form, days: Number(e.target.value) })} /></div>
                <div className="flex items-center gap-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label>{t("common.active")}</Label></div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
                <Button onClick={() => saveMut.mutate()} disabled={!form.name_ar || !form.name_en || saveMut.isPending}>{t("common.save")}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.nameAr")}</th>
              <th className="text-start p-3 font-medium">{t("common.nameEn")}</th>
              <th className="text-end p-3 font-medium">{t("paymentTerms.days")}</th>
              <th className="text-start p-3 font-medium">{t("common.status")}</th>
              <th className="text-end p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {terms.map((row: any) => (
              <tr key={row.id} className="border-t hover:bg-muted/30">
                <td className="p-3">{row.name_ar}</td>
                <td className="p-3">{row.name_en}</td>
                <td className="p-3 text-end font-mono">{row.days}</td>
                <td className="p-3">{row.is_active ? <Badge variant="outline" className="bg-success/10 text-success border-success/30">{t("common.active")}</Badge> : <Badge variant="outline">{t("common.inactive")}</Badge>}</td>
                <td className="p-3 text-end">
                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => openEdit(row)}><Pencil className="h-3 w-3" /></Button>
                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => setDeleteId(row.id)}><Trash2 className="h-3 w-3" /></Button>
                </td>
              </tr>
            ))}
            {terms.length === 0 && <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("paymentTerms.deleteConfirm")}</AlertDialogDescription>
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
