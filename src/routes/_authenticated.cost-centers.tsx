import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listCostCenters, upsertCostCenter, deleteCostCenter } from "@/lib/api/accounting.functions";
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
import {
  Plus, Pencil, Trash2, ArrowLeft, ChevronRight, ChevronDown,
  Folder, FolderOpen, Wallet, Search, ChevronsDownUp, ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/cost-centers")({
  component: () => <CostCentersPage />,
});

type Row = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  parent_id: string | null;
  is_group: boolean;
  is_active: boolean;
};

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
  code: "", name_ar: "", name_en: "",
  parent_id: null, is_group: false, is_active: true,
};

type Node = Row & { depth: number; children: Node[] };

function buildTree(rows: Row[]): Node[] {
  const byId = new Map<string, Node>();
  rows.forEach((r) => byId.set(r.id, { ...r, depth: 0, children: [] }));
  const roots: Node[] = [];
  byId.forEach((n) => {
    if (n.parent_id && byId.has(n.parent_id)) {
      const p = byId.get(n.parent_id)!;
      n.depth = p.depth + 1;
      p.children.push(n);
    } else {
      roots.push(n);
    }
  });
  // depth recompute (BFS) since parents may have been set after children
  const fixDepth = (n: Node, d: number) => {
    n.depth = d;
    n.children.sort((a, b) => a.code.localeCompare(b.code));
    n.children.forEach((c) => fixDepth(c, d + 1));
  };
  roots.sort((a, b) => a.code.localeCompare(b.code));
  roots.forEach((r) => fixDepth(r, 0));
  return roots;
}

function flatten(nodes: Node[], expanded: Set<string>, out: Node[] = []): Node[] {
  for (const n of nodes) {
    out.push(n);
    if (n.children.length && expanded.has(n.id)) flatten(n.children, expanded, out);
  }
  return out;
}

function matchesQuery(n: Node, q: string, localized: (r: any, k: string) => string): boolean {
  const term = q.trim().toLowerCase();
  if (!term) return true;
  if (n.code.toLowerCase().includes(term)) return true;
  if ((n.name_ar || "").toLowerCase().includes(term)) return true;
  if ((n.name_en || "").toLowerCase().includes(term)) return true;
  if (localized(n, "name").toLowerCase().includes(term)) return true;
  return n.children.some((c) => matchesQuery(c, q, localized));
}

function filterTree(nodes: Node[], q: string, localized: (r: any, k: string) => string): Node[] {
  if (!q.trim()) return nodes;
  return nodes
    .filter((n) => matchesQuery(n, q, localized))
    .map((n) => ({ ...n, children: filterTree(n.children, q, localized) }));
}

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

  const allRows = rows as Row[];
  const tree = useMemo(() => buildTree(allRows), [allRows]);
  const groups = useMemo(() => allRows.filter((r) => r.is_group), [allRows]);
  const stats = useMemo(() => ({
    total: allRows.length,
    groups: groups.length,
    leaves: allRows.filter((r) => !r.is_group).length,
    active: allRows.filter((r) => r.is_active).length,
  }), [allRows, groups]);

  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(empty);
  const [toDelete, setToDelete] = useState<Row | null>(null);

  // When searching, auto-expand matched groups
  const filtered = useMemo(() => filterTree(tree, search, localized), [tree, search, localized]);
  const effectiveExpanded = useMemo(() => {
    if (!search.trim()) return expanded;
    const s = new Set(expanded);
    const walk = (n: Node) => { if (n.children.length) s.add(n.id); n.children.forEach(walk); };
    filtered.forEach(walk);
    return s;
  }, [expanded, filtered, search]);

  const visible = useMemo(() => flatten(filtered, effectiveExpanded), [filtered, effectiveExpanded]);

  const toggle = (id: string) => {
    const s = new Set(expanded);
    s.has(id) ? s.delete(id) : s.add(id);
    setExpanded(s);
  };
  const expandAll = () => {
    const s = new Set<string>();
    const walk = (ns: Node[]) => ns.forEach((n) => { if (n.children.length) { s.add(n.id); walk(n.children); } });
    walk(tree);
    setExpanded(s);
  };
  const collapseAll = () => setExpanded(new Set());

  const openNew = (parent_id: string | null = null, is_group = false) => {
    setForm({ ...empty, parent_id, is_group });
    setOpen(true);
  };
  const openEdit = (r: Row) => {
    setForm({
      id: r.id, code: r.code ?? "", name_ar: r.name_ar ?? "", name_en: r.name_en ?? "",
      parent_id: r.parent_id ?? null, is_group: !!r.is_group, is_active: !!r.is_active,
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
      setOpen(false); setForm(empty);
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

  const canSave = !!form.code && !!form.name_ar && !!form.name_en && !!companyId;

  const title = t("nav.costCenters");

  return (
    <div className={embedded ? "space-y-4" : "p-6 space-y-4"}>
      {!embedded && (
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" asChild>
              <Link to="/accounts"><ArrowLeft className="h-4 w-4 me-1" />{t("accounts.title")}</Link>
            </Button>
            <h1 className="page-title">{title}</h1>
          </div>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("common.total") || "Total"}</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("common.group") || "Groups"}</div>
          <div className="text-2xl font-bold">{stats.groups}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("common.leaf") || "Leaves"}</div>
          <div className="text-2xl font-bold">{stats.leaves}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">{t("common.active")}</div>
          <div className="text-2xl font-bold text-success">{stats.active}</div>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute start-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("common.search") || "Search…"}
            className="ps-8"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={expandAll} disabled={!tree.length}>
            <ChevronsUpDown className="h-4 w-4 me-1" />{t("common.expandAll") || "Expand all"}
          </Button>
          <Button variant="outline" size="sm" onClick={collapseAll} disabled={!tree.length}>
            <ChevronsDownUp className="h-4 w-4 me-1" />{t("common.collapseAll") || "Collapse all"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => openNew(null, true)} disabled={!companyId}>
            <Folder className="h-4 w-4 me-1" />{t("common.newGroup") || "New group"}
          </Button>
          <Button size="sm" onClick={() => openNew(null, false)} disabled={!companyId}>
            <Plus className="h-4 w-4 me-1" />{t("common.new")}
          </Button>
        </div>
      </div>

      {/* Tree table */}
      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-center p-3 font-medium w-24">{t("common.type") || "Type"}</th>
              <th className="text-center p-3 font-medium w-24">{t("common.status")}</th>
              <th className="text-end p-3 font-medium w-40">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {visible.map((n) => {
              const isOpen = effectiveExpanded.has(n.id);
              const hasKids = n.children.length > 0;
              return (
                <tr key={n.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-mono">
                    <div className="flex items-center gap-1" style={{ paddingInlineStart: n.depth * 18 }}>
                      {n.is_group ? (
                        <button
                          type="button"
                          onClick={() => hasKids && toggle(n.id)}
                          className={`inline-flex h-5 w-5 items-center justify-center rounded hover:bg-muted ${hasKids ? "" : "opacity-30 cursor-default"}`}
                          aria-label={isOpen ? "collapse" : "expand"}
                        >
                          {hasKids ? (isOpen ? <ChevronDown className="h-3.5 w-3.5" /> : <ChevronRight className="h-3.5 w-3.5" />) : <span className="h-3.5 w-3.5" />}
                        </button>
                      ) : (
                        <span className="inline-block h-5 w-5" />
                      )}
                      {n.is_group ? (
                        isOpen
                          ? <FolderOpen className="h-3.5 w-3.5 text-primary shrink-0" />
                          : <Folder className="h-3.5 w-3.5 text-primary shrink-0" />
                      ) : (
                        <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      )}
                      <span className="ms-1">{n.code}</span>
                    </div>
                  </td>
                  <td className="p-2 font-medium">{localized(n, "name")}</td>
                  <td className="p-2 text-center">
                    {n.is_group
                      ? <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">{t("common.group") || "Group"}</Badge>
                      : <Badge variant="outline">{t("common.leaf") || "Leaf"}</Badge>}
                  </td>
                  <td className="p-2 text-center">
                    {n.is_active
                      ? <Badge variant="outline" className="bg-success/10 text-success border-success/30">{t("common.active")}</Badge>
                      : <Badge variant="outline" className="bg-muted text-muted-foreground">{t("common.inactive")}</Badge>}
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1 justify-end">
                      {n.is_group && (
                        <Button size="sm" variant="ghost" onClick={() => openNew(n.id, false)}
                          title={t("common.addChild") || "Add child"} aria-label="add child">
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      <Button size="sm" variant="ghost" onClick={() => openEdit(n)} aria-label={t("common.edit")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setToDelete(n)}
                        aria-label={t("common.delete")}
                        className="text-destructive hover:text-destructive">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {visible.length === 0 && (
              <tr><td colSpan={5} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      {/* Form */}
      <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) setForm(empty); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{form.id ? t("common.edit") : t("common.new")} — {title}</DialogTitle>
          </DialogHeader>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>{t("common.code")} *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} maxLength={50} />
            </div>
            <div>
              <Label>{t("common.parent") || "Parent"}</Label>
              <Select
                value={form.parent_id ?? "__none"}
                onValueChange={(v) => setForm({ ...form, parent_id: v === "__none" ? null : v })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none">— {t("common.rootLevel") || "Root"} —</SelectItem>
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
            <p className="col-span-2 text-xs text-muted-foreground">
              {t("costCenters.hint") || "Groups can have children; only leaves can be selected on transactions."}
            </p>
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
