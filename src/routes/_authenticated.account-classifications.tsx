import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listAccounts,
  listAccountTypes,
  listClassifications,
  bulkUpdateAccountType,
} from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
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
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/account-classifications")({
  component: () => <AccountClassificationsPage />,
});

export function AccountClassificationsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const listAcc = useServerFn(listAccounts);
  const listTypes = useServerFn(listAccountTypes);
  const listCls = useServerFn(listClassifications);
  const bulkUpdate = useServerFn(bulkUpdateAccountType);

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => listAcc({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: types = [] } = useQuery({
    queryKey: ["account_types", companyId],
    queryFn: () => listTypes({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: classifications = [] } = useQuery<any[]>({
    queryKey: ["classifications", companyId],
    queryFn: () => listCls({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const typeById = useMemo(() => {
    const m = new Map<string, any>();
    (types as any[]).forEach((x) => m.set(x.id, x));
    return m;
  }, [types]);
  const clsById = useMemo(() => {
    const m = new Map<string, any>();
    (classifications as any[]).forEach((x) => m.set(x.id, x));
    return m;
  }, [classifications]);

  const [search, setSearch] = useState("");
  const [filterCls, setFilterCls] = useState<string>("__all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkTypeId, setBulkTypeId] = useState<string>("");
  const [confirmOpen, setConfirmOpen] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (accounts as any[]).filter((a) => {
      if (a.is_group) return false; // skip group/header accounts; classification flows from type only on leaf
      const at = a.account_type_id ? typeById.get(a.account_type_id) : null;
      const clsId = at?.classification_id ?? null;
      if (filterCls !== "__all") {
        if (filterCls === "__none" ? clsId : clsId !== filterCls) return false;
      }
      if (!q) return true;
      return (
        a.code?.toLowerCase().includes(q) ||
        a.name_ar?.toLowerCase().includes(q) ||
        a.name_en?.toLowerCase().includes(q)
      );
    });
  }, [accounts, search, filterCls, typeById]);

  const allSelected = filtered.length > 0 && filtered.every((a) => selected.has(a.id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) filtered.forEach((a) => next.delete(a.id));
    else filtered.forEach((a) => next.add(a.id));
    setSelected(next);
  };
  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelected(next);
  };

  const mut = useMutation({
    mutationFn: () =>
      bulkUpdate({
        data: {
          companyId: companyId!,
          accountIds: Array.from(selected),
          accountTypeId: bulkTypeId,
        },
      }),
    onSuccess: () => {
      toast.success(t("accounts.bulkUpdateSuccess"));
      qc.invalidateQueries({ queryKey: ["accounts", companyId] });
      setSelected(new Set());
      setBulkTypeId("");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const content = (
    <div className="space-y-4">
      <Card className="p-4 space-y-3">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[220px]">
            <Label className="text-xs">{t("common.search")}</Label>
            <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="..." />
          </div>
          <div className="min-w-[220px]">
            <Label className="text-xs">{t("accounts.filterByClassification")}</Label>
            <Select value={filterCls} onValueChange={setFilterCls}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__all">{t("accounts.allClassifications")}</SelectItem>
                <SelectItem value="__none">{t("accounts.noTypeAssigned")}</SelectItem>
                {(classifications as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{localized(c.name_ar, c.name_en)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex flex-wrap gap-3 items-end p-3 rounded-md border bg-muted/30">
          <div className="text-sm font-medium">
            {selected.size} {t("accounts.selectedCount")}
          </div>
          <div className="min-w-[260px] flex-1">
            <Label className="text-xs">{t("accounts.bulkChangeType")}</Label>
            <Select value={bulkTypeId} onValueChange={setBulkTypeId}>
              <SelectTrigger><SelectValue placeholder={t("accounts.selectAccountType")} /></SelectTrigger>
              <SelectContent>
                {(types as any[]).map((tp) => {
                  const cls = tp.classification_id ? clsById.get(tp.classification_id) : null;
                  return (
                    <SelectItem key={tp.id} value={tp.id}>
                      {localized(tp.name_ar, tp.name_en)}
                      {cls ? ` — ${localized(cls.name_ar, cls.name_en)}` : ""}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <Button
            disabled={selected.size === 0 || !bulkTypeId || mut.isPending}
            onClick={() => setConfirmOpen(true)}
          >
            {t("accounts.applyBulk")}
          </Button>
        </div>
      </Card>

      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted/40">
            <tr className="text-start">
              <th className="p-2 w-10">
                <Checkbox checked={allSelected} onCheckedChange={toggleAll} />
              </th>
              <th className="p-2 text-start">{t("accounts.code")}</th>
              <th className="p-2 text-start">{t("accounts.name")}</th>
              <th className="p-2 text-start">{t("accounts.type")}</th>
              <th className="p-2 text-start">{t("accounts.classification")}</th>
              <th className="p-2 text-start w-[260px]">{t("accounts.bulkChangeType")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((a) => {
              const at = a.account_type_id ? typeById.get(a.account_type_id) : null;
              const cls = at?.classification_id ? clsById.get(at.classification_id) : null;
              return (
                <tr key={a.id} className="border-t hover:bg-muted/20">
                  <td className="p-2">
                    <Checkbox checked={selected.has(a.id)} onCheckedChange={() => toggleOne(a.id)} />
                  </td>
                  <td className="p-2 font-mono">{a.code}</td>
                  <td className="p-2">{localized(a.name_ar, a.name_en)}</td>
                  <td className="p-2">
                    {at ? localized(at.name_ar, at.name_en) : <span className="text-muted-foreground">{t("accounts.noTypeAssigned")}</span>}
                  </td>
                  <td className="p-2">
                    {cls ? <Badge variant="outline">{localized(cls.name_ar, cls.name_en)}</Badge> : <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="p-2">
                    <Select
                      value={a.account_type_id ?? ""}
                      onValueChange={async (v) => {
                        try {
                          await bulkUpdate({ data: { companyId: companyId!, accountIds: [a.id], accountTypeId: v } });
                          toast.success(t("accounts.bulkUpdateSuccess"));
                          qc.invalidateQueries({ queryKey: ["accounts", companyId] });
                        } catch (e: any) {
                          toast.error(e.message);
                        }
                      }}
                    >
                      <SelectTrigger><SelectValue placeholder={t("accounts.selectAccountType")} /></SelectTrigger>
                      <SelectContent>
                        {(types as any[]).map((tp) => (
                          <SelectItem key={tp.id} value={tp.id}>{localized(tp.name_ar, tp.name_en)}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 && (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">—</td></tr>
            )}
          </tbody>
        </table>
      </Card>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("accounts.confirmBulkChangeTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("accounts.confirmBulkChangeMessage", { count: selected.size })}
              <br />
              <span className="font-semibold text-foreground mt-2 block">
                {bulkTypeId ? localized(typeById.get(bulkTypeId)?.name_ar, typeById.get(bulkTypeId)?.name_en) : ""}
              </span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setConfirmOpen(false)}>
              {t("common.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={mut.isPending}
              onClick={() => {
                setConfirmOpen(false);
                mut.mutate();
              }}
            >
              {t("common.confirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );

  if (embedded) return content;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-2xl font-bold">{t("accounts.classificationMappingTitle")}</h1>
      {content}
    </div>
  );
}
