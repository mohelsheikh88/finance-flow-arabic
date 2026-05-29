import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPaymentMethods,
  createPaymentMethod,
  updatePaymentMethod,
  deletePaymentMethod,
  seedPaymentMethods,
  PAYMENT_METHOD_PRESETS,
} from "@/lib/api/payment-methods.functions";
import { listBankAccounts } from "@/lib/api/banks.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { Plus, Pencil, Trash2, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/payment-methods")({
  component: Page,
});

const TYPES = ["cash", "bank_transfer", "check", "card", "other"] as const;
type MethodType = (typeof TYPES)[number];

type FormState = {
  code: string;
  name_ar: string;
  name_en: string;
  method_type: MethodType;
  bank_account_id: string;
  is_inbound: boolean;
  is_outbound: boolean;
};

const emptyForm: FormState = {
  code: "",
  name_ar: "",
  name_en: "",
  method_type: "cash",
  bank_account_id: "",
  is_inbound: true,
  is_outbound: true,
};

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listPaymentMethods);
  const create = useServerFn(createPaymentMethod);
  const update = useServerFn(updatePaymentMethod);
  const remove = useServerFn(deletePaymentMethod);
  const seed = useServerFn(seedPaymentMethods);
  const banksFn = useServerFn(listBankAccounts);

  const { data: rows = [] } = useQuery({
    queryKey: ["payment_methods", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: banks = [] } = useQuery({
    queryKey: ["bank_accounts", companyId],
    queryFn: () => banksFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const existingCodes = useMemo(() => new Set(rows.map((r: any) => r.code)), [rows]);

  // Create / edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);

  const openNew = () => {
    setEditingId(null);
    setForm(emptyForm);
    setEditOpen(true);
  };
  const openEdit = (m: any) => {
    setEditingId(m.id);
    setForm({
      code: m.code,
      name_ar: m.name_ar,
      name_en: m.name_en,
      method_type: m.method_type,
      bank_account_id: m.bank_account_id ?? "",
      is_inbound: m.is_inbound,
      is_outbound: m.is_outbound,
    });
    setEditOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code,
        name_ar: form.name_ar,
        name_en: form.name_en,
        method_type: form.method_type,
        bank_account_id: form.bank_account_id || null,
        is_inbound: form.is_inbound,
        is_outbound: form.is_outbound,
      };
      if (editingId) {
        return update({ data: { id: editingId, ...payload } });
      }
      return create({ data: { company_id: companyId!, ...payload, is_active: true } });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["payment_methods"] });
      setEditOpen(false);
      setForm(emptyForm);
      setEditingId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (m: any) => update({ data: { id: m.id, is_active: !m.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["payment_methods"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["payment_methods"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Seed dialog
  const [seedOpen, setSeedOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const openSeed = () => {
    // pre-select all that are not already present
    setSelected(new Set(PAYMENT_METHOD_PRESETS.filter((p) => !existingCodes.has(p.code)).map((p) => p.code)));
    setSeedOpen(true);
  };
  const seedMut = useMutation({
    mutationFn: () => seed({ data: { company_id: companyId!, codes: Array.from(selected) } }),
    onSuccess: (r: any) => {
      toast.success(t("paymentMethods.seeded").replace("{count}", String(r.inserted ?? 0)));
      qc.invalidateQueries({ queryKey: ["payment_methods"] });
      setSeedOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const grouped = useMemo(() => {
    const g: Record<MethodType, any[]> = { cash: [], bank_transfer: [], check: [], card: [], other: [] };
    for (const r of rows) g[r.method_type as MethodType]?.push(r);
    return g;
  }, [rows]);

  const presetsByRegion = useMemo(() => {
    return {
      saudi: PAYMENT_METHOD_PRESETS.filter((p) => p.region === "saudi"),
      global: PAYMENT_METHOD_PRESETS.filter((p) => p.region === "global"),
    };
  }, []);

  const canSave = form.code && form.name_ar && form.name_en;

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="page-title">{t("nav.paymentMethods")}</h1>
          <p className="text-sm text-muted-foreground">{rows.length}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={openSeed}>
            <Sparkles className="h-4 w-4 me-1" />
            {t("paymentMethods.seed")}
          </Button>
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 me-1" />
            {t("common.new")}
          </Button>
        </div>
      </div>

      {/* Grouped by type */}
      <div className="space-y-4">
        {TYPES.map((typ) => {
          const items = grouped[typ];
          if (!items || items.length === 0) return null;
          return (
            <Card key={typ} className="overflow-hidden">
              <div className="px-4 py-2 bg-muted/40 border-b flex items-center justify-between">
                <div className="font-medium text-sm">{t(`paymentMethods.types.${typ}`)}</div>
                <Badge variant="secondary">{items.length}</Badge>
              </div>
              <table className="w-full text-xs">
                <thead className="bg-muted/20">
                  <tr>
                    <th className="text-start p-3 font-medium font-mono">{t("common.code")}</th>
                    <th className="text-start p-3 font-medium">{t("common.name")}</th>
                    <th className="text-start p-3 font-medium">{t("paymentMethods.bank")}</th>
                    <th className="text-center p-3 font-medium">{t("paymentMethods.inbound")}</th>
                    <th className="text-center p-3 font-medium">{t("paymentMethods.outbound")}</th>
                    <th className="text-center p-3 font-medium">{t("common.status")}</th>
                    <th className="text-end p-3 font-medium">{t("common.actions")}</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((m: any) => (
                    <tr key={m.id} className="border-t hover:bg-muted/30">
                      <td className="p-3 font-mono">{m.code}</td>
                      <td className="p-3 font-medium">{localized(m, "name")}</td>
                      <td className="p-3 text-muted-foreground">
                        {m.bank_accounts ? localized(m.bank_accounts, "name") : "—"}
                      </td>
                      <td className="p-3 text-center">{m.is_inbound ? "✓" : ""}</td>
                      <td className="p-3 text-center">{m.is_outbound ? "✓" : ""}</td>
                      <td className="p-3 text-center">
                        <button onClick={() => toggleActive.mutate(m)} className="text-xs underline">
                          {m.is_active ? t("common.active") : t("common.inactive")}
                        </button>
                      </td>
                      <td className="p-3 text-end">
                        <div className="inline-flex gap-1">
                          <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeleteId(m.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          );
        })}
        {rows.length === 0 && (
          <Card className="p-8 text-center text-muted-foreground text-sm">{t("common.noData")}</Card>
        )}
      </div>

      {/* Create / Edit dialog */}
      <Dialog
        open={editOpen}
        onOpenChange={(o) => {
          setEditOpen(o);
          if (!o) {
            setForm(emptyForm);
            setEditingId(null);
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingId ? t("paymentMethods.edit") : t("paymentMethods.new")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.code")} *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div>
              <Label>{t("paymentMethods.type")} *</Label>
              <Select
                value={form.method_type}
                onValueChange={(v) => setForm({ ...form, method_type: v as MethodType })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TYPES.map((typ) => (
                    <SelectItem key={typ} value={typ}>
                      {t(`paymentMethods.types.${typ}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("common.name")} (AR) *</Label>
              <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </div>
            <div>
              <Label>{t("common.name")} (EN) *</Label>
              <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label>{t("paymentMethods.bank")}</Label>
              <Select
                value={form.bank_account_id}
                onValueChange={(v) => setForm({ ...form, bank_account_id: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {banks.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.code} — {localized(b, "name")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_inbound} onCheckedChange={(v) => setForm({ ...form, is_inbound: v })} />
              <Label>{t("paymentMethods.inbound")}</Label>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.is_outbound} onCheckedChange={(v) => setForm({ ...form, is_outbound: v })} />
              <Label>{t("paymentMethods.outbound")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Seed dialog */}
      <Dialog open={seedOpen} onOpenChange={setSeedOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{t("paymentMethods.seedTitle")}</DialogTitle>
            <DialogDescription>{t("paymentMethods.seedDesc")}</DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 text-xs">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                setSelected(
                  new Set(PAYMENT_METHOD_PRESETS.filter((p) => !existingCodes.has(p.code)).map((p) => p.code)),
                )
              }
            >
              {t("paymentMethods.selectAll")}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
              {t("paymentMethods.clearSelection")}
            </Button>
          </div>
          <div className="grid md:grid-cols-2 gap-4 max-h-[60vh] overflow-y-auto">
            {(["saudi", "global"] as const).map((region) => (
              <div key={region}>
                <div className="font-medium text-sm mb-2">
                  {region === "saudi" ? t("paymentMethods.regionSaudi") : t("paymentMethods.regionGlobal")}
                </div>
                <div className="space-y-1">
                  {presetsByRegion[region].map((p) => {
                    const exists = existingCodes.has(p.code);
                    const checked = selected.has(p.code);
                    return (
                      <label
                        key={p.code}
                        className={`flex items-center gap-2 p-2 rounded border text-xs ${
                          exists ? "opacity-50 bg-muted/30" : "hover:bg-muted/30 cursor-pointer"
                        }`}
                      >
                        <Checkbox
                          checked={checked}
                          disabled={exists}
                          onCheckedChange={(v) => {
                            const next = new Set(selected);
                            if (v) next.add(p.code);
                            else next.delete(p.code);
                            setSelected(next);
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{localized(p, "name")}</div>
                          <div className="font-mono text-[10px] text-muted-foreground">{p.code}</div>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {t(`paymentMethods.types.${p.method_type}`)}
                        </Badge>
                      </label>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSeedOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => seedMut.mutate()} disabled={selected.size === 0 || seedMut.isPending}>
              {t("paymentMethods.seedAdd")} ({selected.size})
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.delete")}</AlertDialogTitle>
            <AlertDialogDescription>{t("paymentMethods.deleteConfirm")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMut.mutate(deleteId)}
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
