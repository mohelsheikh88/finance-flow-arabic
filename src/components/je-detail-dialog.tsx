import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, Pencil, X } from "lucide-react";
import { toast } from "sonner";
import { getJournalEntry, updateJournalEntry, listAccounts, listPartners } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { formatLockError } from "@/lib/lock-error";

type Line = { account_id: string; partner_id?: string | null; description: string; debit: number; credit: number };

export function JEDetailDialog({ entryId, onClose }: { entryId: string | null; onClose: () => void }) {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();

  const getFn = useServerFn(getJournalEntry);
  const updFn = useServerFn(updateJournalEntry);
  const accountsFn = useServerFn(listAccounts);
  const partnersFn = useServerFn(listPartners);

  const { data: entry, isLoading } = useQuery({
    queryKey: ["je-detail", entryId],
    queryFn: () => getFn({ data: { id: entryId! } }),
    enabled: !!entryId,
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => accountsFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: partners = [] } = useQuery({
    queryKey: ["partners", companyId],
    queryFn: () => partnersFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const isManualDraft = entry && entry.status === "draft" && (entry.source_type ?? "manual") === "manual";

  const [editing, setEditing] = useState(false);
  const [header, setHeader] = useState({ entry_date: "", reference: "", description: "" });
  const [lines, setLines] = useState<Line[]>([]);

  useEffect(() => {
    if (entry) {
      setHeader({
        entry_date: entry.entry_date ?? "",
        reference: entry.reference ?? "",
        description: entry.description ?? "",
      });
      setLines(
        (entry.lines ?? []).map((l: any) => ({
          account_id: l.account_id,
          partner_id: l.partner_id,
          description: l.description ?? "",
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
        })),
      );
      setEditing(false);
    }
  }, [entry]);

  const postableAccounts = accounts.filter((a: any) => !a.is_group);
  const totals = useMemo(
    () => ({
      debit: lines.reduce((s, l) => s + (Number(l.debit) || 0), 0),
      credit: lines.reduce((s, l) => s + (Number(l.credit) || 0), 0),
    }),
    [lines],
  );
  const balanced = Math.abs(totals.debit - totals.credit) < 0.001 && totals.debit > 0;
  const updLine = (i: number, patch: Partial<Line>) =>
    setLines((arr) => arr.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));

  const save = useMutation({
    mutationFn: () =>
      updFn({
        data: {
          id: entryId!,
          entry_date: header.entry_date,
          reference: header.reference || null,
          description: header.description || null,
          lines: lines
            .filter((l) => l.account_id)
            .map((l) => ({
              account_id: l.account_id,
              partner_id: l.partner_id || null,
              description: l.description || null,
              debit: Number(l.debit) || 0,
              credit: Number(l.credit) || 0,
            })),
        },
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["je-list"] });
      qc.invalidateQueries({ queryKey: ["je-detail", entryId] });
      setEditing(false);
    },
    onError: (e: Error) => toast.error(formatLockError(e, t)),
  });

  return (
    <Dialog open={!!entryId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <span>{editing ? t("je.edit") : t("je.details")}</span>
            {entry && <span className="font-mono text-sm text-muted-foreground">{entry.entry_number}</span>}
            {entry && <Badge variant="outline">{t(`je.${entry.status}` as any)}</Badge>}
          </DialogTitle>
        </DialogHeader>

        {isLoading || !entry ? (
          <div className="p-8 text-center text-muted-foreground">{t("common.loading") ?? "..."}</div>
        ) : (
          <div className="space-y-4">
            {!isManualDraft && (
              <div className="text-xs text-muted-foreground bg-muted/40 border rounded p-2">
                {t("je.readOnlyNotice")}
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div>
                <Label>{t("je.journal")}</Label>
                <Input value={entry.journals ? `${entry.journals.code} — ${localized(entry.journals, "name")}` : ""} disabled className="h-9" />
              </div>
              <div>
                <Label>{t("je.entryDate")}</Label>
                <Input type="date" value={header.entry_date} onChange={(e) => setHeader({ ...header, entry_date: e.target.value })} disabled={!editing} className="h-9" />
              </div>
              <div>
                <Label>{t("je.reference")}</Label>
                <Input value={header.reference} onChange={(e) => setHeader({ ...header, reference: e.target.value })} disabled={!editing} className="h-9" />
              </div>
              <div className="md:col-span-3">
                <Label>{t("je.description")}</Label>
                <Textarea rows={2} value={header.description} onChange={(e) => setHeader({ ...header, description: e.target.value })} disabled={!editing} />
              </div>
            </div>

            <table className="w-full text-xs border-t">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start p-2 w-10">#</th>
                  <th className="text-start p-2">{t("je.account")}</th>
                  <th className="text-start p-2">{t("je.partner")}</th>
                  <th className="text-start p-2">{t("common.description")}</th>
                  <th className="text-end p-2 font-mono w-28">{t("je.debit")}</th>
                  <th className="text-end p-2 font-mono w-28">{t("je.credit")}</th>
                  {editing && <th className="w-10" />}
                </tr>
              </thead>
              <tbody>
                {lines.map((l, i) => {
                  const acct = (entry.lines?.[i] as any)?.accounts;
                  const ptr = (entry.lines?.[i] as any)?.partners;
                  return (
                    <tr key={i} className="border-t">
                      <td className="p-1 text-center text-muted-foreground">{i + 1}</td>
                      <td className="p-1">
                        {editing ? (
                          <Select value={l.account_id} onValueChange={(v) => updLine(i, { account_id: v })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {postableAccounts.map((a: any) => (
                                <SelectItem key={a.id} value={a.id}>{a.code} — {localized(a, "name")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span>{acct ? `${acct.code} — ${localized(acct, "name")}` : "—"}</span>
                        )}
                      </td>
                      <td className="p-1">
                        {editing ? (
                          <Select value={l.partner_id ?? ""} onValueChange={(v) => updLine(i, { partner_id: v || null })}>
                            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="—" /></SelectTrigger>
                            <SelectContent>
                              {partners.map((p: any) => (
                                <SelectItem key={p.id} value={p.id}>{p.code} — {localized(p, "name")}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <span>{ptr ? `${ptr.code} — ${localized(ptr, "name")}` : "—"}</span>
                        )}
                      </td>
                      <td className="p-1">
                        {editing ? (
                          <Input value={l.description} onChange={(e) => updLine(i, { description: e.target.value })} className="h-8 text-xs" />
                        ) : (
                          <span className="text-muted-foreground">{l.description || "—"}</span>
                        )}
                      </td>
                      <td className="p-1 text-end font-mono">
                        {editing ? (
                          <Input type="number" step="0.01" value={l.debit || ""} onChange={(e) => updLine(i, { debit: Number(e.target.value), credit: 0 })} className="h-8 text-xs text-end font-mono" dir="ltr" />
                        ) : (
                          <span>{Number(l.debit).toFixed(2)}</span>
                        )}
                      </td>
                      <td className="p-1 text-end font-mono">
                        {editing ? (
                          <Input type="number" step="0.01" value={l.credit || ""} onChange={(e) => updLine(i, { credit: Number(e.target.value), debit: 0 })} className="h-8 text-xs text-end font-mono" dir="ltr" />
                        ) : (
                          <span>{Number(l.credit).toFixed(2)}</span>
                        )}
                      </td>
                      {editing && (
                        <td className="p-1 text-center">
                          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setLines((arr) => arr.filter((_, idx) => idx !== i))} disabled={lines.length <= 2}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-muted/50 border-t-2">
                <tr>
                  <td colSpan={4} className="p-2 text-end font-medium">{t("common.total")}</td>
                  <td className="p-2 text-end font-mono font-bold">{totals.debit.toFixed(2)}</td>
                  <td className="p-2 text-end font-mono font-bold">{totals.credit.toFixed(2)}</td>
                  {editing && <td />}
                </tr>
              </tfoot>
            </table>

            {editing && (
              <Button variant="outline" size="sm" onClick={() => setLines((arr) => [...arr, { account_id: "", description: "", debit: 0, credit: 0 }])}>
                <Plus className="h-4 w-4 me-1" /> {t("je.addLine")}
              </Button>
            )}
          </div>
        )}

        <DialogFooter className="gap-2">
          {editing ? (
            <>
              <Badge variant="outline" className={balanced ? "bg-success/15 text-success border-success/30" : "bg-warning/15 text-warning border-warning/30"}>
                {balanced ? t("je.balanced") : t("je.unbalanced")}
              </Badge>
              <Button variant="outline" onClick={() => setEditing(false)}>
                <X className="h-4 w-4 me-1" /> {t("common.cancel")}
              </Button>
              <Button onClick={() => save.mutate()} disabled={save.isPending || !balanced}>
                <Save className="h-4 w-4 me-1" /> {t("common.save")}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={onClose}>{t("common.close") ?? "Close"}</Button>
              {isManualDraft && (
                <Button onClick={() => setEditing(true)}>
                  <Pencil className="h-4 w-4 me-1" /> {t("je.edit")}
                </Button>
              )}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
