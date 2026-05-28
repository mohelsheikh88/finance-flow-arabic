import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listCurrencies,
  createCurrency,
  updateCurrency,
  deleteCurrency,
  listExchangeRates,
  upsertExchangeRate,
  deleteExchangeRate,
} from "@/lib/api/currencies.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, TrendingUp } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/currencies")({
  component: Page,
});

type Currency = {
  code: string;
  name_ar: string;
  name_en: string;
  symbol: string | null;
  decimals: number;
  is_active: boolean;
};

const emptyForm: Currency = {
  code: "",
  name_ar: "",
  name_en: "",
  symbol: "",
  decimals: 2,
  is_active: true,
};

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();

  const listFn = useServerFn(listCurrencies);
  const createFn = useServerFn(createCurrency);
  const updateFn = useServerFn(updateCurrency);
  const deleteFn = useServerFn(deleteCurrency);

  const { data: rows = [] } = useQuery({
    queryKey: ["currencies"],
    queryFn: () => listFn(),
  });

  const [search, setSearch] = useState("");
  const [activeOnly, setActiveOnly] = useState(false);

  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    return (rows as Currency[]).filter((c) => {
      if (activeOnly && !c.is_active) return false;
      if (!s) return true;
      return (
        c.code.toLowerCase().includes(s) ||
        c.name_ar.toLowerCase().includes(s) ||
        c.name_en.toLowerCase().includes(s)
      );
    });
  }, [rows, search, activeOnly]);

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Currency | null>(null);
  const [form, setForm] = useState<Currency>(emptyForm);
  const [toDelete, setToDelete] = useState<Currency | null>(null);
  const [ratesFor, setRatesFor] = useState<Currency | null>(null);

  const openNew = () => {
    setEditing(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (c: Currency) => {
    setEditing(c);
    setForm({ ...c, symbol: c.symbol ?? "" });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code.trim().toUpperCase(),
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim(),
        symbol: form.symbol?.trim() || null,
        decimals: Number(form.decimals) || 0,
        is_active: form.is_active,
      };
      if (editing) {
        return updateFn({ data: payload });
      }
      return createFn({ data: payload });
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["currencies"] });
      setOpen(false);
      setForm(emptyForm);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActive = useMutation({
    mutationFn: (c: Currency) =>
      updateFn({ data: { code: c.code, is_active: !c.is_active } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["currencies"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (c: Currency) => deleteFn({ data: { code: c.code } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["currencies"] });
      setToDelete(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setToDelete(null);
    },
  });

  const canSave =
    !!form.code.trim() && !!form.name_ar.trim() && !!form.name_en.trim();

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="page-title">{t("currencies.title")}</h1>
          <p className="text-sm text-muted-foreground">{t("currencies.subtitle")}</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 me-1" />{t("currencies.new")}
        </Button>
      </div>

      <Card className="p-3 flex items-center gap-3 flex-wrap">
        <Input
          placeholder={t("currencies.searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
        <div className="flex items-center gap-2">
          <Switch checked={activeOnly} onCheckedChange={setActiveOnly} />
          <Label className="text-sm">{t("currencies.filterActive")}</Label>
        </div>
        <div className="ms-auto text-xs text-muted-foreground">
          {filtered.length} / {rows.length}
        </div>
      </Card>

      <Card>
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium font-mono">{t("currencies.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-center p-3 font-medium">{t("currencies.symbol")}</th>
              <th className="text-center p-3 font-medium">{t("currencies.decimals")}</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
              <th className="text-end p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((c) => (
              <tr key={c.code} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono font-semibold">{c.code}</td>
                <td className="p-3">{localized(c, "name")}</td>
                <td className="p-3 text-center">{c.symbol || "—"}</td>
                <td className="p-3 text-center tabular-nums">{c.decimals}</td>
                <td className="p-3 text-center">
                  <button onClick={() => toggleActive.mutate(c)} className="inline-block">
                    <Badge variant={c.is_active ? "default" : "outline"}>
                      {c.is_active ? t("common.active") : t("common.inactive")}
                    </Badge>
                  </button>
                </td>
                <td className="p-3">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" onClick={() => setRatesFor(c)} title={t("currencies.rates")}>
                      <TrendingUp className="h-4 w-4" />
                    </Button>
                    <Button size="icon" variant="ghost" onClick={() => openEdit(c)} title={t("common.edit")}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setToDelete(c)}
                      title={t("common.delete")}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {t("common.noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Add / Edit dialog */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) { setForm(emptyForm); setEditing(null); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("currencies.edit") : t("currencies.new")}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("currencies.code")} *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                placeholder={t("currencies.codePlaceholder")}
                maxLength={10}
                disabled={!!editing}
                className="font-mono"
              />
            </div>
            <div>
              <Label>{t("currencies.symbol")}</Label>
              <Input
                value={form.symbol ?? ""}
                onChange={(e) => setForm({ ...form, symbol: e.target.value })}
                placeholder={t("currencies.symbolPlaceholder")}
                maxLength={10}
              />
            </div>
            <div>
              <Label>{t("currencies.nameAr")} *</Label>
              <Input
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                maxLength={255}
                dir="rtl"
              />
            </div>
            <div>
              <Label>{t("currencies.nameEn")} *</Label>
              <Input
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                maxLength={255}
              />
            </div>
            <div>
              <Label>{t("currencies.decimals")}</Label>
              <Input
                type="number"
                min={0}
                max={8}
                value={form.decimals}
                onChange={(e) => setForm({ ...form, decimals: Number(e.target.value) })}
              />
            </div>
            <div className="flex items-end gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>{t("currencies.isActive")}</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete confirm */}
      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("currencies.deleteConfirmTitle")} — {toDelete?.code}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t("currencies.deleteConfirmMessage")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => toDelete && deleteMut.mutate(toDelete)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Exchange rates dialog */}
      {ratesFor && (
        <ExchangeRatesDialog
          currency={ratesFor}
          onClose={() => setRatesFor(null)}
        />
      )}
    </div>
  );
}

function ExchangeRatesDialog({ currency, onClose }: { currency: Currency; onClose: () => void }) {
  const { t } = useI18n();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const listFn = useServerFn(listExchangeRates);
  const upsertFn = useServerFn(upsertExchangeRate);
  const delFn = useServerFn(deleteExchangeRate);

  const { data: rates = [] } = useQuery({
    queryKey: ["exchange_rates", companyId, currency.code],
    queryFn: () => listFn({ data: { companyId: companyId!, currencyCode: currency.code } }),
    enabled: !!companyId,
  });

  const [rateDate, setRateDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [rate, setRate] = useState<string>("");

  const addMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          company_id: companyId!,
          currency_code: currency.code,
          rate_date: rateDate,
          rate: Number(rate),
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["exchange_rates", companyId, currency.code] });
      setRate("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["exchange_rates", companyId, currency.code] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const canAdd = !!companyId && !!rateDate && Number(rate) > 0;

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {t("currencies.ratesFor")} {currency.code}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
          <div>
            <Label>{t("currencies.rateDate")}</Label>
            <Input type="date" value={rateDate} onChange={(e) => setRateDate(e.target.value)} />
          </div>
          <div>
            <Label>{t("currencies.rate")}</Label>
            <Input
              type="number"
              step="0.000001"
              min={0}
              value={rate}
              onChange={(e) => setRate(e.target.value)}
              placeholder="0.000000"
            />
          </div>
          <Button onClick={() => addMut.mutate()} disabled={!canAdd || addMut.isPending}>
            <Plus className="h-4 w-4 me-1" />{t("currencies.addRate")}
          </Button>
        </div>

        <Card className="max-h-80 overflow-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-start p-3 font-medium">{t("currencies.rateDate")}</th>
                <th className="text-end p-3 font-medium">{t("currencies.rate")}</th>
                <th className="text-end p-3 font-medium">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {(rates as any[]).map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-3 font-mono">{r.rate_date}</td>
                  <td className="p-3 text-end tabular-nums">{Number(r.rate).toFixed(6)}</td>
                  <td className="p-3 text-end">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => delMut.mutate(r.id)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rates.length === 0 && (
                <tr>
                  <td colSpan={3} className="p-6 text-center text-muted-foreground">
                    {t("currencies.noRates")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t("common.close")}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
