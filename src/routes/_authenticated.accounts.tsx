import { useState, useMemo, useRef, useEffect } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAccounts, upsertAccount, deleteAccount, importAccounts, listAccountTypes, listClassifications,
  listAccountingBuckets, upsertAccountingBucket, deleteAccountingBucket,
} from "@/lib/api/accounting.functions";

import { useBranch } from "@/lib/branch-context";
import { useAccountingBuckets } from "@/lib/use-buckets";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Download, Upload, ChevronDown, ChevronRight, FolderTree, FileText } from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { AccountTypesPage } from "./_authenticated.account-types";
import { ClassificationsPage } from "./_authenticated.classifications";
import { AccountClassificationsPage } from "./_authenticated.account-classifications";
import { CostCentersPage } from "./_authenticated.cost-centers";


export const Route = createFileRoute("/_authenticated/accounts")({
  component: AccountsPage,
});

function AccountsPage() {
  const { t } = useI18n();
  return (
    <div className="p-6 space-y-4">
      <h1 className="page-title">{t("accounts.title")}</h1>
      <Tabs defaultValue="coa" className="w-full">
        <TabsList>
          <TabsTrigger value="coa">{t("accounts.title")}</TabsTrigger>
          <TabsTrigger value="types">{t("accounts.accountTypesNav")}</TabsTrigger>
          <TabsTrigger value="classifications">{t("accounts.coreClassifications")}</TabsTrigger>
          <TabsTrigger value="buckets">{t("accounts.accountingBucket")}</TabsTrigger>
          <TabsTrigger value="mapping">{t("accounts.classificationMapping")}</TabsTrigger>
          <TabsTrigger value="cost-centers">{t("nav.costCenters")}</TabsTrigger>

        </TabsList>
        <TabsContent value="coa" className="mt-4">
          <ChartOfAccountsPanel />
        </TabsContent>
        <TabsContent value="types" className="mt-4">
          <AccountTypesPage embedded />
        </TabsContent>
        <TabsContent value="classifications" className="mt-4">
          <ClassificationsPage embedded />
        </TabsContent>
        <TabsContent value="buckets" className="mt-4">
          <AccountingBucketsPanel />
        </TabsContent>
        <TabsContent value="mapping" className="mt-4">
          <AccountClassificationsPage embedded />
        </TabsContent>
        <TabsContent value="cost-centers" className="mt-4">
          <CostCentersPage embedded />
        </TabsContent>

      </Tabs>

    </div>
  );
}




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


function ChartOfAccountsPanel() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const list = useServerFn(listAccounts);
  const listTypes = useServerFn(listAccountTypes);
  const listCls = useServerFn(listClassifications);
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

  const { data: classifications = [] } = useQuery({
    queryKey: ["classifications", companyId],
    queryFn: () => listCls({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });



  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const [search, setSearch] = useState("");
  const [filterClassification, setFilterClassification] = useState("all");
  const [filterIsGroup, setFilterIsGroup] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const parents = useMemo(
    () => (accounts as any[]).filter((a) => a.is_group && a.id !== form.id),
    [accounts, form.id],
  );

  const typeById = useMemo(() => {
    const m = new Map<string, any>();
    (accountTypes as any[]).forEach((t) => m.set(t.id, t));
    return m;
  }, [accountTypes]);

  const filteredAccounts = useMemo(() => {
    const text = search.trim().toLowerCase();
    return (accounts as any[]).filter((a) => {
      if (text) {
        const name = localized(a, "name").toLowerCase();
        const code = (a.code ?? "").toLowerCase();
        if (!name.includes(text) && !code.includes(text)) return false;
      }
      if (filterClassification !== "all") {
        const at = typeById.get(a.account_type_id);
        if ((at?.classification_id ?? null) !== filterClassification) return false;
      }

      if (filterIsGroup !== "all") {
        const isGroup = filterIsGroup === "group";
        if (a.is_group !== isGroup) return false;
      }
      if (filterStatus !== "all") {
        const isActive = filterStatus === "active";
        if (a.is_active !== isActive) return false;
      }
      return true;
    });
  }, [accounts, search, filterClassification, filterIsGroup, filterStatus, localized, typeById]);

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
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFile} />
        <Button variant="outline" onClick={handleExport} disabled={!companyId}>
          <Download className="h-4 w-4 me-1" />Export
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={!companyId || importMut.isPending}>
          <Upload className="h-4 w-4 me-1" />Import
        </Button>
        <Button onClick={openNew} disabled={!companyId || (accountTypes as any[]).length === 0}>
          <Plus className="h-4 w-4 me-1" />{t("common.new")}
        </Button>
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="space-y-1">
          <Label>{t("common.search")}</Label>
          <Input placeholder={t("common.search")} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>{t("accounts.classification")}</Label>
          <Select value={filterClassification} onValueChange={setFilterClassification}>
            <SelectTrigger><SelectValue placeholder={t("common.all")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              {(classifications as any[]).filter((c) => c.is_active).map((c: any) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.code} — {localized(c, "name")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label>{t("accounts.isGroup")}</Label>
          <Select value={filterIsGroup} onValueChange={setFilterIsGroup}>
            <SelectTrigger><SelectValue placeholder={t("common.all")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="group">{t("accounts.isGroup")}</SelectItem>
              <SelectItem value="leaf">{t("accounts.leafAccount")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label>{t("common.status")}</Label>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger><SelectValue placeholder={t("common.all")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("common.all")}</SelectItem>
              <SelectItem value="active">{t("common.active")}</SelectItem>
              <SelectItem value="inactive">{t("common.inactive")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="flex items-end">
          <Button variant="outline" className="w-full" onClick={() => { setSearch(""); setFilterClassification("all"); setFilterIsGroup("all"); setFilterStatus("all"); }}>
            {t("common.clear")}
          </Button>
        </div>
      </div>

      <ChartOfAccountsTree
        accounts={filteredAccounts as any[]}
        accountTypes={accountTypes as any[]}
        classifications={classifications as any[]}
        typeColors={typeColors}
        statementOf={statementOf}
        onEdit={openEdit}
        onDelete={setToDelete}
      />


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

type TreeNode = {
  id: string;
  kind: "bucket" | "classification" | "account_type" | "account";
  code: string;
  name: string;
  depth: number;
  data?: any;
  children: TreeNode[];
};

function ChartOfAccountsTree({
  accounts,
  accountTypes,
  classifications,
  typeColors,
  statementOf,
  onEdit,
  onDelete,
}: {
  accounts: any[];
  accountTypes: any[];
  classifications: any[];
  typeColors: Record<string, string>;
  statementOf: (cls: string) => string;
  onEdit: (a: any) => void;
  onDelete: (a: any) => void;
}) {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const { byCode: bucketByCode, bucketName, bucketOrder } = useAccountingBuckets(companyId ?? undefined);


  const tree = useMemo<TreeNode[]>(() => {
    const accountsByType = new Map<string, any[]>();
    accounts.forEach((a) => {
      if (!a.account_type_id) return;
      if (!accountsByType.has(a.account_type_id)) accountsByType.set(a.account_type_id, []);
      accountsByType.get(a.account_type_id)!.push(a);
    });

    const buildAccountSubtree = (typeAccs: any[]): TreeNode[] => {
      const nodes = new Map<string, TreeNode>();
      typeAccs.forEach((a) =>
        nodes.set(a.id, {
          id: `acc:${a.id}`,
          kind: "account",
          code: a.code,
          name: localized(a, "name"),
          depth: 0,
          data: a,
          children: [],
        }),
      );
      const roots: TreeNode[] = [];
      typeAccs.forEach((a) => {
        const n = nodes.get(a.id)!;
        if (a.parent_id && nodes.has(a.parent_id)) {
          nodes.get(a.parent_id)!.children.push(n);
        } else {
          roots.push(n);
        }
      });
      const sortRec = (arr: TreeNode[]) => {
        arr.sort((x, y) => String(x.code).localeCompare(String(y.code)));
        arr.forEach((c) => sortRec(c.children));
      };
      sortRec(roots);
      return roots;
    };

    const usedTypeIds = new Set(accounts.map((a) => a.account_type_id).filter(Boolean));
    const typesUsed = accountTypes.filter((tp) => usedTypeIds.has(tp.id));

    const typesByCls = new Map<string, any[]>();
    typesUsed.forEach((tp) => {
      const cid = tp.classification_id ?? "__none";
      if (!typesByCls.has(cid)) typesByCls.set(cid, []);
      typesByCls.get(cid)!.push(tp);
    });

    const usedClsIds = new Set(typesUsed.map((tp) => tp.classification_id).filter(Boolean));
    const clsUsed = classifications.filter((c) => usedClsIds.has(c.id));
    const clsByBucket = new Map<string, any[]>();
    clsUsed.forEach((c) => {
      if (!clsByBucket.has(c.bucket)) clsByBucket.set(c.bucket, []);
      clsByBucket.get(c.bucket)!.push(c);
    });

    const sortByOrder = (a: any, b: any) =>
      (a.sort_order ?? 0) - (b.sort_order ?? 0) || String(a.code).localeCompare(String(b.code));

    const bucketKeys = Array.from(clsByBucket.keys()).sort(
      (a, b) => bucketOrder(a) - bucketOrder(b) || String(a).localeCompare(String(b)),
    );
    const roots: TreeNode[] = [];

    bucketKeys.forEach((b) => {
      const cArr = (clsByBucket.get(b) ?? []).slice().sort(sortByOrder);
      if (cArr.length === 0) return;
      const bucketRec = bucketByCode.get(b);
      const bucketNode: TreeNode = {
        id: `b:${b}`,
        kind: "bucket",
        code: (bucketRec?.code ?? b).toUpperCase(),
        name: bucketName(b, t(`accounts.${b}`)),
        depth: 0,
        data: { bucket: b, bucketRec },
        children: [],
      };
      cArr.forEach((c) => {
        const tArr = (typesByCls.get(c.id) ?? []).slice().sort(sortByOrder);
        if (tArr.length === 0) return;
        const clsNode: TreeNode = {
          id: `c:${c.id}`,
          kind: "classification",
          code: c.code,
          name: localized(c, "name"),
          depth: 1,
          data: c,
          children: [],
        };
        tArr.forEach((tp) => {
          const typeAccs = accountsByType.get(tp.id) ?? [];
          if (typeAccs.length === 0) return;
          const typeNode: TreeNode = {
            id: `t:${tp.id}`,
            kind: "account_type",
            code: tp.code,
            name: localized(tp, "name"),
            depth: 2,
            data: tp,
            children: [],
          };
          const accRoots = buildAccountSubtree(typeAccs);
          const setDepth = (n: TreeNode, d: number) => {
            n.depth = d;
            n.children.forEach((cc) => setDepth(cc, d + 1));
          };
          accRoots.forEach((r) => setDepth(r, 3));
          typeNode.children = accRoots;
          clsNode.children.push(typeNode);
        });
        if (clsNode.children.length) bucketNode.children.push(clsNode);
      });
      if (bucketNode.children.length) roots.push(bucketNode);
    });

    return roots;
  }, [accounts, accountTypes, classifications, localized, t, bucketByCode, bucketName, bucketOrder]);

  const allExpandableIds = useMemo(() => {
    const ids: string[] = [];
    const walk = (n: TreeNode) => {
      if (n.children.length) {
        ids.push(n.id);
        n.children.forEach(walk);
      }
    };
    tree.forEach(walk);
    return ids;
  }, [tree]);

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const didInit = useRef(false);
  useEffect(() => {
    if (!didInit.current && allExpandableIds.length > 0) {
      setExpanded(new Set(allExpandableIds));
      didInit.current = true;
    }
  }, [allExpandableIds]);

  const toggle = (id: string) =>
    setExpanded((s) => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  const expandAll = () => setExpanded(new Set(allExpandableIds));
  const collapseAll = () => setExpanded(new Set());

  const visible = useMemo(() => {
    const out: TreeNode[] = [];
    const walk = (n: TreeNode) => {
      out.push(n);
      if (expanded.has(n.id)) n.children.forEach(walk);
    };
    tree.forEach(walk);
    return out;
  }, [tree, expanded]);

  const kindBadge = (n: TreeNode) => {
    if (n.kind === "bucket") return t("accounts.accountingBucket");
    if (n.kind === "classification") return t("accounts.coreClassification") || "Core Classification";
    if (n.kind === "account_type") return t("accounts.accountTypesNav");
    return n.data?.is_group ? (t("common.group") || "Group") : (t("common.leaf") || "Leaf");
  };

  return (
    <>
      <div className="flex items-center justify-end gap-2">
        <Button variant="outline" size="sm" onClick={expandAll}>
          {t("common.expandAll") || "Expand all"}
        </Button>
        <Button variant="outline" size="sm" onClick={collapseAll}>
          {t("common.collapseAll") || "Collapse all"}
        </Button>
      </div>
      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")} / {t("common.name")}</th>
              <th className="text-start p-3 font-medium">{t("accounts.statement")}</th>
              <th className="text-start p-3 font-medium">{t("accounts.type")}</th>
              <th className="text-center p-3 font-medium">{t("common.type") || "Type"}</th>
              <th className="text-center p-3 font-medium">{t("common.status")}</th>
              <th className="text-end p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((n) => {
              const hasChildren = n.children.length > 0;
              const isOpen = expanded.has(n.id);
              const isAccount = n.kind === "account";
              const bucketKey =
                n.kind === "bucket"
                  ? (n.data?.bucket as string)
                  : n.kind === "classification"
                    ? n.data?.bucket
                    : n.kind === "account_type"
                      ? n.data?.classification
                      : undefined;
              const rowBg =
                n.kind === "bucket"
                  ? "border-t bg-muted/60 hover:bg-muted/70"
                  : n.kind === "classification"
                    ? "border-t bg-muted/30 hover:bg-muted/50"
                    : n.kind === "account_type"
                      ? "border-t bg-muted/10 hover:bg-muted/30"
                      : "border-t hover:bg-muted/30";
              return (
                <tr key={n.id} className={rowBg}>
                  <td className="p-3">
                    <div className="flex items-stretch">
                      {Array.from({ length: n.depth }).map((_, i) => (
                        <span
                          key={i}
                          className="inline-block w-5 border-s border-dashed border-border/60"
                          aria-hidden
                        />
                      ))}
                      <div className="flex items-center gap-1 ps-1">
                        {n.depth > 0 && (
                          <span
                            className="inline-block w-3 border-t border-dashed border-border/60 -ms-1"
                            aria-hidden
                          />
                        )}
                        {hasChildren ? (
                          <button
                            onClick={() => toggle(n.id)}
                            className="p-0.5 hover:bg-muted rounded"
                          >
                            {isOpen ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </button>
                        ) : (
                          <span className="w-4 inline-block" />
                        )}
                        {!isAccount || n.data?.is_group ? (
                          <FolderTree
                            className={
                              n.kind === "bucket"
                                ? "h-4 w-4 text-primary"
                                : "h-3.5 w-3.5 text-primary"
                            }
                          />
                        ) : (
                          <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                        <span
                          className={
                            n.kind === "bucket"
                              ? "font-mono font-bold"
                              : n.kind === "classification"
                                ? "font-mono font-semibold"
                                : "font-mono"
                          }
                        >
                          {n.code}
                        </span>
                        <span className="mx-1 text-muted-foreground">—</span>
                        <span
                          className={
                            n.kind === "bucket"
                              ? "font-bold"
                              : n.kind === "classification" || n.kind === "account_type"
                                ? "font-semibold"
                                : n.data?.is_group
                                  ? "font-semibold"
                                  : ""
                          }
                        >
                          {n.name}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-muted-foreground">
                    {bucketKey ? t(`accounts.${statementOf(bucketKey)}`) : "—"}
                  </td>
                  <td className="p-3">
                    {bucketKey ? (
                      <Badge variant="outline" className={typeColors[bucketKey]}>
                        {t(`accounts.${bucketKey}`)}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="p-3 text-center">
                    <Badge variant="outline">{kindBadge(n)}</Badge>
                  </td>
                  <td className="p-3 text-center">
                    {isAccount ? (n.data?.is_active ? t("common.active") : t("common.inactive")) : "—"}
                  </td>
                  <td className="p-3">
                    <div className="flex items-center gap-1 justify-end">
                      {isAccount && (
                        <>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onEdit(n.data)}
                            aria-label={t("common.edit")}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => onDelete(n.data)}
                            aria-label={t("common.delete")}
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr>
                <td colSpan={6} className="p-8 text-center text-muted-foreground">
                  {t("common.noData")}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </Card>
    </>
  );
}


const BUCKETS = ["asset", "liability", "equity", "income", "expense"] as const;
const bucketColors: Record<string, string> = {
  asset: "bg-info/10 text-info border-info/30",
  liability: "bg-warning/10 text-warning border-warning/30",
  equity: "bg-primary/10 text-primary border-primary/30",
  income: "bg-success/10 text-success border-success/30",
  expense: "bg-destructive/10 text-destructive border-destructive/30",
};

function AccountingBucketsPanel() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const listBuckets = useServerFn(listAccountingBuckets);
  const upsert = useServerFn(upsertAccountingBucket);
  const remove = useServerFn(deleteAccountingBucket);
  const listCls = useServerFn(listClassifications);
  const listTypes = useServerFn(listAccountTypes);

  const { data: buckets = [] } = useQuery({
    queryKey: ["accounting_buckets", companyId],
    queryFn: () => listBuckets({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: classifications = [] } = useQuery({
    queryKey: ["classifications", companyId],
    queryFn: () => listCls({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: accountTypes = [] } = useQuery({
    queryKey: ["account_types", companyId],
    queryFn: () => listTypes({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  type BForm = {
    id?: string;
    code: string;
    name_ar: string;
    name_en: string;
    statement: "balance_sheet" | "income_statement";
    normal_balance: "debit" | "credit";
    sort_order: number;
    is_active: boolean;
    notes: string;
  };
  const emptyBForm: BForm = {
    code: "",
    name_ar: "",
    name_en: "",
    statement: "balance_sheet",
    normal_balance: "debit",
    sort_order: 0,
    is_active: true,
    notes: "",
  };

  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<BForm>(emptyBForm);
  const [toDelete, setToDelete] = useState<any | null>(null);

  const openNew = () =>
    setForm({ ...emptyBForm, sort_order: ((buckets as any[]).length + 1) * 10 });
  const openEdit = (b: any) =>
    setForm({
      id: b.id,
      code: b.code,
      name_ar: b.name_ar,
      name_en: b.name_en,
      statement: b.statement,
      normal_balance: b.normal_balance,
      sort_order: b.sort_order ?? 0,
      is_active: !!b.is_active,
      notes: b.notes ?? "",
    });

  const saveMut = useMutation({
    mutationFn: () =>
      upsert({
        data: {
          id: form.id,
          company_id: companyId!,
          code: form.code.trim(),
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim(),
          statement: form.statement,
          normal_balance: form.normal_balance,
          sort_order: form.sort_order,
          is_active: form.is_active,
          notes: form.notes.trim() || null,
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["accounting_buckets"] });
      qc.invalidateQueries({ queryKey: ["classifications"] });
      qc.invalidateQueries({ queryKey: ["account_types"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setOpen(false);
      setForm(emptyBForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["accounting_buckets"] });
      qc.invalidateQueries({ queryKey: ["classifications"] });
      qc.invalidateQueries({ queryKey: ["account_types"] });
      qc.invalidateQueries({ queryKey: ["accounts"] });
      setToDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSave = !!(form.code && form.name_ar && form.name_en && companyId);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end">
        <Button
          onClick={() => {
            openNew();
            setOpen(true);
          }}
          disabled={!companyId}
        >
          <Plus className="h-4 w-4 me-1" />
          {t("common.new")}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {(buckets as any[]).map((b) => {
          const cls = (classifications as any[]).filter(
            (c) => c.bucket === b.code && c.is_active,
          );
          const typesCount = (accountTypes as any[]).filter(
            (at) => at.classification === b.code,
          ).length;
          const swatch =
            bucketColors[b.code] ?? "bg-muted text-foreground border-border";
          return (
            <Card key={b.id} className="p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className={`${swatch} text-sm`}>
                    {localized(b, "name")}
                  </Badge>
                  {!b.is_active && (
                    <Badge variant="secondary" className="text-[10px]">
                      {t("common.inactive")}
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      openEdit(b);
                      setOpen(true);
                    }}
                    aria-label={t("common.edit")}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => setToDelete(b)}
                    aria-label={t("common.delete")}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="text-xs text-muted-foreground font-mono">{b.code}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <div className="text-muted-foreground">{t("accounts.statement")}</div>
                  <div className="font-medium">
                    {t(
                      b.statement === "balance_sheet"
                        ? "accounts.balanceSheet"
                        : "accounts.incomeStatement",
                    )}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">{t("accounts.normalBalance")}</div>
                  <div className="font-medium">
                    {t(b.normal_balance === "debit" ? "accounts.debit" : "accounts.credit")}
                  </div>
                </div>
              </div>
              <div className="space-y-1">
                <div className="text-xs text-muted-foreground">
                  {t("accounts.coreClassifications")} · {typesCount}{" "}
                  {t("accounts.accountTypesNav")}
                </div>
                {cls.length === 0 ? (
                  <div className="text-xs text-muted-foreground italic">
                    {t("common.noData")}
                  </div>
                ) : (
                  <ul className="space-y-1">
                    {cls.map((c) => (
                      <li
                        key={c.id}
                        className="flex items-center gap-2 text-xs border-t pt-1"
                      >
                        <span className="font-mono text-muted-foreground">{c.code}</span>
                        <span className="font-medium">{localized(c, "name")}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </Card>
          );
        })}
        {(buckets as any[]).length === 0 && (
          <div className="col-span-full p-8 text-center text-muted-foreground text-sm">
            {t("common.noData")}
          </div>
        )}
      </div>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setForm(emptyBForm);
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {form.id ? t("common.edit") : t("common.new")} — {t("accounts.accountingBucket")}
            </DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.code")} *</Label>
              <Input
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                maxLength={50}
                placeholder="asset"
              />
            </div>
            <div>
              <Label>{t("common.nameAr")} *</Label>
              <Input
                value={form.name_ar}
                onChange={(e) => setForm({ ...form, name_ar: e.target.value })}
                maxLength={255}
              />
            </div>
            <div>
              <Label>{t("common.nameEn")} *</Label>
              <Input
                value={form.name_en}
                onChange={(e) => setForm({ ...form, name_en: e.target.value })}
                maxLength={255}
              />
            </div>
            <div>
              <Label>{t("accounts.statement")} *</Label>
              <Select
                value={form.statement}
                onValueChange={(v) => setForm({ ...form, statement: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balance_sheet">{t("accounts.balanceSheet")}</SelectItem>
                  <SelectItem value="income_statement">
                    {t("accounts.incomeStatement")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>{t("accounts.normalBalance")} *</Label>
              <Select
                value={form.normal_balance}
                onValueChange={(v) => setForm({ ...form, normal_balance: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="debit">{t("accounts.debit")}</SelectItem>
                  <SelectItem value="credit">{t("accounts.credit")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Sort order</Label>
              <Input
                type="number"
                value={form.sort_order}
                onChange={(e) =>
                  setForm({ ...form, sort_order: parseInt(e.target.value || "0", 10) })
                }
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>{t("common.active")}</Label>
            </div>
            <div className="col-span-2">
              <Label>{t("common.notes")}</Label>
              <Input
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                maxLength={2000}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              {t("common.cancel")}
            </Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>
              {t("common.save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("common.delete")} — {toDelete?.code}
            </AlertDialogTitle>
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


