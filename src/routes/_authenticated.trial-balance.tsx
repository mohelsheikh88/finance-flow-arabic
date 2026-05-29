import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getTrialBalance, listJournals } from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Check, ChevronsUpDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/trial-balance")({
  component: TBPage,
});

function defaultRange() {
  const d = new Date();
  const from = new Date(d.getFullYear(), d.getMonth(), 1);
  const f = (x: Date) =>
    `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  return { from: f(from), to: f(d) };
}

type Option = { value: string; label: string };

function MultiSelect({
  options,
  selected,
  onChange,
  placeholder,
  searchPlaceholder,
  emptyText,
  className,
}: {
  options: Option[];
  selected: string[];
  onChange: (v: string[]) => void;
  placeholder: string;
  searchPlaceholder: string;
  emptyText: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const toggle = (v: string) =>
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  const labelMap = useMemo(() => {
    const m = new Map<string, string>();
    options.forEach((o) => m.set(o.value, o.label));
    return m;
  }, [options]);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "min-h-10 w-full flex items-center gap-1.5 px-2 py-1 border border-input rounded-lg bg-background hover:border-ring/50 focus:outline-none focus:ring-2 focus:ring-ring/20 focus:border-ring transition-colors cursor-pointer text-start",
            className,
          )}
        >
          <div className="flex flex-wrap items-center gap-1 flex-1 min-w-0">
            {selected.length === 0 ? (
              <span className="text-muted-foreground text-sm font-normal px-1">{placeholder}</span>
            ) : selected.length <= 2 ? (
              selected.map((v) => (
                <span
                  key={v}
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground text-xs font-medium border border-border"
                >
                  {labelMap.get(v) ?? v}
                  <X
                    className="h-3 w-3 cursor-pointer text-muted-foreground hover:text-foreground"
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      toggle(v);
                    }}
                  />
                </span>
              ))
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-muted text-foreground text-xs font-semibold border border-border">
                {selected.length}
              </span>
            )}
          </div>
          <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[20rem] p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} className="h-9" />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            <CommandGroup>
              {options.map((o) => {
                const isSel = selected.includes(o.value);
                return (
                  <CommandItem key={o.value} value={o.label} onSelect={() => toggle(o.value)}>
                    <Check className={cn("me-2 h-4 w-4", isSel ? "opacity-100" : "opacity-0")} />
                    {o.label}
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
          {selected.length > 0 && (
            <div className="border-t p-2">
              <Button variant="ghost" size="sm" className="w-full h-7 text-xs" onClick={() => onChange([])}>
                <X className="h-3 w-3 me-1" />
                <span>Clear all</span>
              </Button>
            </div>
          )}
        </Command>
      </PopoverContent>
    </Popover>
  );
}

function TBPage() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const init = useMemo(defaultRange, []);
  const [dateFrom, setDateFrom] = useState(init.from);
  const [dateTo, setDateTo] = useState(init.to);
  const [statuses, setStatuses] = useState<string[]>(["draft", "posted"]);
  const [journalIds, setJournalIds] = useState<string[]>([]);

  const tbFn = useServerFn(getTrialBalance);
  const journalsFn = useServerFn(listJournals);

  const { data: journals = [] } = useQuery({
    queryKey: ["journals-list", companyId],
    queryFn: () => journalsFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const { data: rows = [] } = useQuery({
    queryKey: ["tb", companyId, dateFrom, dateTo, statuses.join(","), journalIds.join(",")],
    queryFn: () =>
      tbFn({
        data: {
          companyId: companyId!,
          asOfDate: dateTo,
          dateFrom,
          statuses: statuses.length ? statuses : null,
          journalIds: journalIds.length ? journalIds : null,
        },
      }),
    enabled: !!companyId,
  });

  const journalOptions: Option[] = (journals as any[]).map((j) => ({
    value: j.id,
    label: `${j.code} — ${locale === "ar" ? j.name_ar : j.name_en}`,
  }));
  const statusOptions: Option[] = [
    { value: "draft", label: t("je.draft") },
    { value: "posted", label: t("je.posted") },
  ];

  const fmt = (n: number) => new Intl.NumberFormat(locale === "ar" ? "ar-SA" : "en-US", { minimumFractionDigits: 2 }).format(n);
  const totals = rows.reduce(
    (a: any, r: any) => ({
      beg: a.beg + (Number(r.beginning_debit) - Number(r.beginning_credit)),
      d: a.d + Number(r.debit),
      c: a.c + Number(r.credit),
    }),
    { beg: 0, d: 0, c: 0 },
  );
  const totalClosing = totals.beg + totals.d - totals.c;

  const labelCls = "block text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5 ms-1";

  return (
    <div className="p-6 space-y-4">
      <h1 className="page-title">{t("tb.title")}</h1>
      <Card className="p-4">
        <div className="flex flex-wrap items-start gap-4">
          <div className="flex-1 min-w-[160px]">
            <Label className={labelCls}>{t("vat.dateFrom")}</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="h-10 rounded-lg font-medium"
            />
          </div>
          <div className="flex-1 min-w-[160px]">
            <Label className={labelCls}>{t("vat.dateTo")}</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="h-10 rounded-lg font-medium"
            />
          </div>
          <div className="flex-[1.5] min-w-[240px]">
            <Label className={labelCls}>{locale === "ar" ? "الحالة" : "Status"}</Label>
            <MultiSelect
              options={statusOptions}
              selected={statuses}
              onChange={setStatuses}
              placeholder={locale === "ar" ? "كل الحالات" : "All statuses"}
              searchPlaceholder={locale === "ar" ? "ابحث..." : "Search..."}
              emptyText={locale === "ar" ? "لا نتائج" : "No results"}
            />
          </div>
          <div className="flex-[1.5] min-w-[200px]">
            <Label className={labelCls}>{locale === "ar" ? "الدفاتر" : "Journals"}</Label>
            <MultiSelect
              options={journalOptions}
              selected={journalIds}
              onChange={setJournalIds}
              placeholder={locale === "ar" ? "كل الدفاتر" : "All journals"}
              searchPlaceholder={locale === "ar" ? "ابحث عن دفتر..." : "Search journals..."}
              emptyText={locale === "ar" ? "لا نتائج" : "No results"}
            />
          </div>
        </div>
      </Card>
      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3">{t("common.code")}</th>
              <th className="text-start p-3">{t("tb.account")}</th>
              <th className="text-start p-3">{t("accounts.classification")}</th>
              <th className="text-end p-3 font-mono">{t("tb.openingBalance")}</th>
              <th className="text-end p-3 font-mono">{t("tb.periodDebit")}</th>
              <th className="text-end p-3 font-mono">{t("tb.periodCredit")}</th>
              <th className="text-end p-3 font-mono">{t("tb.closingBalance")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r: any) => {
              const beg = Number(r.beginning_debit) - Number(r.beginning_credit);
              const pd = Number(r.debit);
              const pc = Number(r.credit);
              const closing = beg + pd - pc;
              const clsName = r.classification_id
                ? localized({ name_ar: r.classification_name_ar, name_en: r.classification_name_en }, "name")
                : t(`accounts.${r.bucket ?? r.type}`);
              return (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono">{r.code}</td>
                  <td className="p-3 font-medium">{localized(r, "name")}</td>
                  <td className="p-3 text-muted-foreground">{clsName}</td>
                  <td className={`p-3 text-end font-mono ${beg < 0 ? "text-destructive" : ""}`}>{fmt(beg)}</td>
                  <td className="p-3 text-end font-mono">{fmt(pd)}</td>
                  <td className="p-3 text-end font-mono">{fmt(pc)}</td>
                  <td className={`p-3 text-end font-mono ${closing < 0 ? "text-destructive" : ""}`}>{fmt(closing)}</td>
                </tr>
              );
            })}
            {rows.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
          <tfoot className="bg-muted/50 border-t-2 font-bold">
            <tr>
              <td colSpan={3} className="p-3 text-end">{t("tb.totals")}</td>
              <td className={`p-3 text-end font-mono ${totals.beg < 0 ? "text-destructive" : ""}`}>{fmt(totals.beg)}</td>
              <td className="p-3 text-end font-mono">{fmt(totals.d)}</td>
              <td className="p-3 text-end font-mono">{fmt(totals.c)}</td>
              <td className={`p-3 text-end font-mono ${totalClosing < 0 ? "text-destructive" : ""}`}>{fmt(totalClosing)}</td>
            </tr>
          </tfoot>
        </table>
      </Card>
    </div>
  );
}
