import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listAuditLog, listAuditTables } from "@/lib/api/audit.functions";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { History, Eye, RefreshCw } from "lucide-react";

export const Route = createFileRoute("/_authenticated/audit-log")({
  component: AuditLogPage,
});

type AuditRow = {
  id: string;
  table_name: string;
  record_id: string | null;
  action: "INSERT" | "UPDATE" | "DELETE";
  user_id: string | null;
  changed_at: string;
  old_data: any;
  new_data: any;
  user: { email: string; display_name_ar: string | null; display_name_en: string | null } | null;
};

function AuditLogPage() {
  const fetchFn = useServerFn(listAuditLog);
  const tablesFn = useServerFn(listAuditTables);

  const [filters, setFilters] = useState<{
    tableName: string;
    action: string;
    from: string;
    to: string;
    limit: number;
  }>({ tableName: "", action: "", from: "", to: "", limit: 100 });

  const { data: tables = [] } = useQuery({
    queryKey: ["audit_tables"],
    queryFn: () => tablesFn() as Promise<string[]>,
  });

  const { data: rows = [], refetch, isFetching } = useQuery({
    queryKey: ["audit_log", filters],
    queryFn: () =>
      fetchFn({
        data: {
          tableName: filters.tableName || null,
          action: (filters.action || null) as any,
          from: filters.from || null,
          to: filters.to || null,
          limit: filters.limit,
        },
      }) as Promise<AuditRow[]>,
  });

  const [selected, setSelected] = useState<AuditRow | null>(null);

  const actionColor: Record<string, string> = {
    INSERT: "bg-success/15 text-success border-success/30",
    UPDATE: "bg-info/15 text-info border-info/30",
    DELETE: "bg-destructive/15 text-destructive border-destructive/30",
  };
  const actionLabel: Record<string, string> = { INSERT: "إضافة", UPDATE: "تعديل", DELETE: "حذف" };

  const stats = {
    total: rows.length,
    inserts: rows.filter((r) => r.action === "INSERT").length,
    updates: rows.filter((r) => r.action === "UPDATE").length,
    deletes: rows.filter((r) => r.action === "DELETE").length,
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <History className="h-6 w-6 text-primary" />
          <h1 className="page-title">سجل التدقيق والمراقبة</h1>
        </div>
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`h-4 w-4 me-1 ${isFetching ? "animate-spin" : ""}`} /> تحديث
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="إجمالي الأحداث" value={stats.total} />
        <StatCard label="إضافات" value={stats.inserts} tone="success" />
        <StatCard label="تعديلات" value={stats.updates} tone="info" />
        <StatCard label="عمليات حذف" value={stats.deletes} tone="destructive" />
      </div>

      <Card>
        <CardHeader className="pb-2"><CardTitle className="text-base">الفلاتر</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div>
            <Label>الجدول</Label>
            <Select value={filters.tableName || "all"} onValueChange={(v) => setFilters({ ...filters, tableName: v === "all" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                {tables.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>نوع العملية</Label>
            <Select value={filters.action || "all"} onValueChange={(v) => setFilters({ ...filters, action: v === "all" ? "" : v })}>
              <SelectTrigger className="h-9"><SelectValue placeholder="الكل" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="INSERT">إضافة</SelectItem>
                <SelectItem value="UPDATE">تعديل</SelectItem>
                <SelectItem value="DELETE">حذف</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>من تاريخ</Label><Input type="datetime-local" value={filters.from} onChange={(e) => setFilters({ ...filters, from: e.target.value })} className="h-9" /></div>
          <div><Label>إلى تاريخ</Label><Input type="datetime-local" value={filters.to} onChange={(e) => setFilters({ ...filters, to: e.target.value })} className="h-9" /></div>
          <div>
            <Label>عدد النتائج</Label>
            <Select value={String(filters.limit)} onValueChange={(v) => setFilters({ ...filters, limit: Number(v) })}>
              <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
              <SelectContent>
                {[50, 100, 200, 500].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="text-start p-3 font-medium">الوقت</th>
                <th className="text-start p-3 font-medium">العملية</th>
                <th className="text-start p-3 font-medium">الجدول</th>
                <th className="text-start p-3 font-medium">معرّف السجل</th>
                <th className="text-start p-3 font-medium">المستخدم</th>
                <th className="text-center p-3 font-medium w-20">التفاصيل</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t hover:bg-muted/30">
                  <td className="p-3 font-mono text-muted-foreground" dir="ltr">{new Date(r.changed_at).toLocaleString("ar-SA")}</td>
                  <td className="p-3"><Badge variant="outline" className={actionColor[r.action]}>{actionLabel[r.action]}</Badge></td>
                  <td className="p-3 font-medium">{r.table_name}</td>
                  <td className="p-3 font-mono text-muted-foreground text-[10px]" dir="ltr">{r.record_id?.slice(0, 8) ?? "—"}</td>
                  <td className="p-3">
                    {r.user ? (
                      <div className="flex flex-col">
                        <span className="font-medium">{r.user.display_name_ar || r.user.display_name_en || r.user.email}</span>
                        <span className="text-[10px] text-muted-foreground" dir="ltr">{r.user.email}</span>
                      </div>
                    ) : <span className="text-muted-foreground">نظام</span>}
                  </td>
                  <td className="p-3 text-center">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setSelected(r)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">لا توجد أحداث</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الحدث</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <Info label="الوقت" value={new Date(selected.changed_at).toLocaleString("ar-SA")} />
                <Info label="العملية" value={actionLabel[selected.action]} />
                <Info label="الجدول" value={selected.table_name} />
                <Info label="معرّف السجل" value={selected.record_id ?? "—"} mono />
                <Info label="المستخدم" value={selected.user?.email ?? "نظام"} />
                <Info label="معرّف المستخدم" value={selected.user_id ?? "—"} mono />
              </div>
              {selected.old_data && (
                <div>
                  <Label className="text-xs font-bold">القيم القديمة</Label>
                  <pre className="bg-muted p-3 rounded text-[10px] overflow-auto max-h-64" dir="ltr">{JSON.stringify(selected.old_data, null, 2)}</pre>
                </div>
              )}
              {selected.new_data && (
                <div>
                  <Label className="text-xs font-bold">القيم الجديدة</Label>
                  <pre className="bg-muted p-3 rounded text-[10px] overflow-auto max-h-64" dir="ltr">{JSON.stringify(selected.new_data, null, 2)}</pre>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone?: "success" | "info" | "destructive" }) {
  const cls = tone === "success" ? "text-success" : tone === "info" ? "text-info" : tone === "destructive" ? "text-destructive" : "text-primary";
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className={`text-2xl font-bold ${cls}`}>{value}</div>
      </CardContent>
    </Card>
  );
}

function Info({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex flex-col">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={mono ? "font-mono text-[10px]" : ""} dir={mono ? "ltr" : undefined}>{value}</span>
    </div>
  );
}
