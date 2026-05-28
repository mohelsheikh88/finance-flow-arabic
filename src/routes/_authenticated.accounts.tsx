import { useState, useMemo, useRef } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAccounts, upsertAccount, deleteAccount, importAccounts, listAccountTypes,
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
import { Plus, Pencil, Trash2, Download, Upload, Settings2 } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
});

type FormState = {
  id?: string;
  code: string;
  name_ar: string;
  name_en: string;
  account_type_id: string;
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
  account_type_id: "",
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
  const listTypes = useServerFn(listAccountTypes);
  const upsert = useServerFn(upsertAccount);
  const remove = useServerFn(deleteAccount);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const { data: accountTypes = [] } = useQuery({
    queryKey: ["account_types", companyId],
    queryFn: () => listTypes({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const parents = useMemo(
    () => (accounts as any[]).filter((a) => a.is_group && a.id !== form.id),
    [accounts, form.id],
  );

  const typeById = useMemo(() => {
    const m = new Map<string, any>();
    (accountTypes as any[]).forEach((t) => m.set(t.id, t));
    return m;
  }, [accountTypes]);

  const openNew = () => {
    const def = (accountTypes as any[]).find((t) => t.classification === "asset") ?? (accountTypes as any[])[0];
    setForm({ ...empty, account_type_id: def?.id ?? "" });
    setOpen(true);
  };
  const openEdit = (a: any) => {
    setForm({
      id: a.id,
      code: a.code ?? "",
      name_ar: a.name_ar ?? "",
      name_en: a.name_en ?? "",
      account_type_id: a.account_type_id ?? (accountTypes as any[]).find((t) => t.classification === a.account_type)?.id ?? "",
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
          account_type_id: form.account_type_id,
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

  const statementOf = (classification: string) => {
    const bs = ["asset", "liability", "equity"];
    return bs.includes(classification) ? "balanceSheet" : "incomeStatement";
  };


  const importFn = useServerFn(importAccounts);
  const fileRef = useRef<HTMLInputElement>(null);
  const [importResult, setImportResult] = useState<{ created: number; updated: number; errors: { code: string; error: string }[] } | null>(null);

  const importMut = useMutation({
    mutationFn: (rows: any[]) => importFn({ data: { companyId: companyId!, rows } }),
    onSuccess: (res) => {
      setImportResult(res);
      qc.invalidateQueries({ queryKey: ["accounts"] });
      const msg = `+${res.created} / ~${res.updated}` + (res.errors.length ? ` (${res.errors.length} ⚠)` : "");
      res.errors.length ? toast.warning(msg) : toast.success(msg);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const handleExport = () => {
    const rows = (accounts as any[]).map((a) => ({
      code: a.code,
      name_ar: a.name_ar,
      name_en: a.name_en,
      account_type: a.account_type,
      parent_code: (accounts as any[]).find((p) => p.id === a.parent_id)?.code ?? "",
      currency_code: a.currency_code ?? "",
      is_group: a.is_group ? 1 : 0,
      is_active: a.is_active ? 1 : 0,
      is_reconcilable: a.is_reconcilable ? 1 : 0,
      notes: a.notes ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows.length ? rows : [{
      code: "", name_ar: "", name_en: "", account_type: "asset",
      parent_code: "", currency_code: "", is_group: 0, is_active: 1, is_reconcilable: 0, notes: "",
    }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "accounts");
    XLSX.writeFile(wb, `chart_of_accounts_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = "";
    if (!f || !companyId) return;
    try {
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
      const rows = raw.map((r) => ({
        code: String(r.code ?? "").trim(),
        name_ar: String(r.name_ar ?? "").trim(),
        name_en: String(r.name_en ?? "").trim(),
        account_type: String(r.account_type ?? "").trim().toLowerCase(),
        parent_code: r.parent_code ? String(r.parent_code).trim() : null,
        currency_code: r.currency_code ? String(r.currency_code).trim() : null,
        is_group: r.is_group === true || r.is_group === 1 || String(r.is_group).toLowerCase() === "true",
        is_active: r.is_active === undefined || r.is_active === "" ? true
          : r.is_active === true || r.is_active === 1 || String(r.is_active).toLowerCase() === "true",
        is_reconcilable: r.is_reconcilable === true || r.is_reconcilable === 1 || String(r.is_reconcilable).toLowerCase() === "true",
        notes: r.notes ? String(r.notes) : null,
      })).filter((r) => r.code);
      if (!rows.length) { toast.error(t("common.noData")); return; }
      importMut.mutate(rows);
    } catch (err: any) {
      toast.error(err.message ?? "Import failed");
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-bold">{t("accounts.title")}</h1>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
          <Button variant="outline" onClick={handleExport} disabled={!companyId}>
            <Download className="h-4 w-4 me-1" />Export
          </Button>
          <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!companyId || importMut.isPending}>
            <Upload className="h-4 w-4 me-1" />Import
          </Button>
          <Button variant="outline" asChild disabled={!companyId}>
            <Link to="/account-types"><Settings2 className="h-4 w-4 me-1" />{t("accounts.manageTypes") ?? "إدارة الأنواع"}</Link>
          </Button>
          <Button onClick={openNew} disabled={!companyId || (accountTypes as any[]).length === 0}>
            <Plus className="h-4 w-4 me-1" />{t("common.new")}
          </Button>
        </div>
      </div>


      {importResult && (
        <Card className="p-3 text-xs flex items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <span>Created: <b className="text-success">{importResult.created}</b></span>
            <span>Updated: <b className="text-info">{importResult.updated}</b></span>
            <span>Errors: <b className={importResult.errors.length ? "text-destructive" : ""}>{importResult.errors.length}</b></span>
            {importResult.errors.slice(0, 3).map((e, i) => (
              <span key={i} className="text-destructive">[{e.code}] {e.error}</span>
            ))}
            {importResult.errors.length > 3 && <span className="text-muted-foreground">+{importResult.errors.length - 3}…</span>}
          </div>
          <Button size="sm" variant="ghost" onClick={() => setImportResult(null)}>×</Button>
        </Card>
      )}

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium">{t("accounts.statement")}</th>
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
                    {(() => {
                      const at = typeById.get(a.account_type_id);
                      const cls = at?.classification ?? a.account_type;
                      return (
                        <Badge variant="outline" className={typeColors[cls]}>
                          {at ? localized(at, "name") : t(`accounts.${cls}`)}
                        </Badge>
                      );
                    })()}
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
              <Select value={form.account_type_id} onValueChange={(v) => setForm({ ...form, account_type_id: v })}>
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  {(accountTypes as any[]).filter((tp) => tp.is_active).map((tp: any) => (
                    <SelectItem key={tp.id} value={tp.id}>
                      {tp.code} — {localized(tp, "name")} ({t(`accounts.${tp.classification}`)})
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
            <Button onClick={() => saveMut.mutate()} disabled={!form.code || !form.name_ar || !form.name_en || !form.account_type_id || !companyId || saveMut.isPending}>{t("common.save")}</Button>

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
