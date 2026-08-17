import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { listRoles, createRole, updateRole, deleteRole } from "@/lib/api/roles.functions";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Lock } from "lucide-react";
import { toast } from "sonner";

type RoleRow = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  description_ar: string | null;
  description_en: string | null;
  is_system: boolean;
  is_active: boolean;
  sort_order: number;
};

export function RolesManagement() {
  const { t, locale } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listRoles);
  const createFn = useServerFn(createRole);
  const updateFn = useServerFn(updateRole);
  const deleteFn = useServerFn(deleteRole);

  const { data: roles = [], isLoading } = useQuery({
    queryKey: ["roles_registry"],
    queryFn: () => listFn(),
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<RoleRow | null>(null);
  const [form, setForm] = useState({
    code: "", name_ar: "", name_en: "",
    description_ar: "", description_en: "",
    is_active: true, sort_order: 100,
  });

  const openCreate = () => {
    setEditing(null);
    setForm({ code: "", name_ar: "", name_en: "", description_ar: "", description_en: "", is_active: true, sort_order: 100 });
    setDialogOpen(true);
  };

  const openEdit = (r: RoleRow) => {
    setEditing(r);
    setForm({
      code: r.code,
      name_ar: r.name_ar,
      name_en: r.name_en,
      description_ar: r.description_ar ?? "",
      description_en: r.description_en ?? "",
      is_active: r.is_active,
      sort_order: r.sort_order,
    });
    setDialogOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      if (editing) {
        return updateFn({
          data: {
            id: editing.id,
            name_ar: form.name_ar,
            name_en: form.name_en,
            description_ar: form.description_ar || null,
            description_en: form.description_en || null,
            is_active: form.is_active,
            sort_order: form.sort_order,
          },
        });
      }
      const code = form.code.trim().toLowerCase();
      if (!/^[a-z][a-z0-9_]*$/.test(code)) {
        throw new Error(
          locale === "ar"
            ? "كود الدور يجب أن يبدأ بحرف إنجليزي صغير ويحتوي فقط على حروف صغيرة وأرقام و _"
            : "Role code must start with a lowercase letter and contain only lowercase letters, digits, and _",
        );
      }
      if (!form.name_ar.trim() || !form.name_en.trim()) {
        throw new Error(locale === "ar" ? "الاسم بالعربي والإنجليزي مطلوب" : "Arabic and English names are required");
      }
      return createFn({
        data: {
          code,
          name_ar: form.name_ar,
          name_en: form.name_en,
          description_ar: form.description_ar || null,
          description_en: form.description_en || null,
          is_active: form.is_active,
          sort_order: form.sort_order,
        },
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles_registry"] });
      qc.invalidateQueries({ queryKey: ["roles_active"] });
      setDialogOpen(false);
      toast.success(t("common.saved"));
    },
    onError: (e: any) => {
      let msg = e?.message ?? String(e);
      try {
        const parsed = JSON.parse(msg);
        if (Array.isArray(parsed) && parsed[0]?.path?.[0] === "code") {
          msg = locale === "ar"
            ? "كود الدور غير صالح: استخدم حروف إنجليزية صغيرة وأرقام و _ فقط، ويبدأ بحرف"
            : "Invalid role code: use lowercase letters, digits, and _ only, starting with a letter";
        }
      } catch {}
      toast.error(msg);
    },
  });

  const toggleMut = useMutation({
    mutationFn: (v: { id: string; is_active: boolean }) =>
      updateFn({ data: { id: v.id, is_active: v.is_active } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles_registry"] });
      qc.invalidateQueries({ queryKey: ["roles_active"] });
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { id } }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["roles_registry"] });
      qc.invalidateQueries({ queryKey: ["roles_active"] });
      toast.success(t("common.deleted"));
    },
    onError: (e: any) => toast.error(e.message ?? String(e)),
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="h-10 w-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
            <Lock className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold">{t("roles.title")}</h2>
            <p className="text-xs text-muted-foreground">{t("roles.subtitle")}</p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4 me-1" /> {t("roles.addNew")}
        </Button>
      </div>

      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/40">
              <tr className="text-start">
                <th className="px-3 py-2 text-start font-semibold">{t("roles.code")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("common.nameAr")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("common.nameEn")}</th>
                <th className="px-3 py-2 text-start font-semibold">{t("roles.description")}</th>
                <th className="px-3 py-2 text-center font-semibold">{t("roles.type")}</th>
                <th className="px-3 py-2 text-center font-semibold">{t("common.active")}</th>
                <th className="px-3 py-2 text-center font-semibold">{t("common.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{t("common.loading")}</td></tr>
              )}
              {!isLoading && roles.length === 0 && (
                <tr><td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
              )}
              {roles.map((r: RoleRow) => (
                <tr key={r.id} className="border-t border-border/40">
                  <td className="px-3 py-2 font-mono text-xs">{r.code}</td>
                  <td className="px-3 py-2">{r.name_ar}</td>
                  <td className="px-3 py-2">{r.name_en}</td>
                  <td className="px-3 py-2 text-muted-foreground text-xs max-w-xs truncate">
                    {locale === "ar" ? (r.description_ar ?? "") : (r.description_en ?? "")}
                  </td>
                  <td className="px-3 py-2 text-center">
                    {r.is_system ? (
                      <Badge variant="secondary" className="gap-1"><Lock className="h-3 w-3" />{t("roles.system")}</Badge>
                    ) : (
                      <Badge variant="outline">{t("roles.custom")}</Badge>
                    )}
                  </td>
                  <td className="px-3 py-2 text-center">
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => toggleMut.mutate({ id: r.id, is_active: v })}
                    />
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx === 0 || reorderMut.isPending}
                        onClick={() => move(idx, -1)}
                        title={t("common.moveUp")}
                      >
                        <ArrowUp className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={idx === roles.length - 1 || reorderMut.isPending}
                        onClick={() => move(idx, 1)}
                        title={t("common.moveDown")}
                      >
                        <ArrowDown className="h-3.5 w-3.5" />
                      </Button>
                      <Button size="icon" variant="ghost" onClick={() => openEdit(r)} title={t("common.edit")}>
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button size="icon" variant="ghost" className="text-destructive" title={t("common.delete")}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
                            <AlertDialogDescription>
                              {locale === "ar" ? r.name_ar : r.name_en}
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
                            <AlertDialogAction onClick={() => delMut.mutate(r.id)}>{t("common.delete")}</AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </td>

                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-xs text-muted-foreground">{t("roles.systemHint")}</p>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editing ? t("roles.editRole") : t("roles.addNew")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>{t("roles.code")}</Label>
              <Input
                value={form.code}
                disabled={!!editing}
                onChange={(e) => {
                  const sanitized = e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9_]/g, "_")
                    .replace(/^[^a-z]+/, "");
                  setForm({ ...form, code: sanitized });
                }}
                placeholder="e.g. treasury_manager"
              />
              {!editing && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {locale === "ar"
                    ? "حروف إنجليزية صغيرة وأرقام و _ فقط، ويبدأ بحرف. مثال: treasury_manager"
                    : "Lowercase letters, digits, and _ only. Must start with a letter. e.g. treasury_manager"}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("common.nameAr")}</Label>
                <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" />
              </div>
              <div>
                <Label>{t("common.nameEn")}</Label>
                <Input value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("roles.descriptionAr")}</Label>
                <Textarea rows={2} value={form.description_ar} onChange={(e) => setForm({ ...form, description_ar: e.target.value })} dir="rtl" />
              </div>
              <div>
                <Label>{t("roles.descriptionEn")}</Label>
                <Textarea rows={2} value={form.description_en} onChange={(e) => setForm({ ...form, description_en: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label>{t("roles.sortOrder")}</Label>
                <Input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: Number(e.target.value) || 0 })} />
              </div>
              <div className="flex items-center gap-2 pb-2">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label>{t("common.active")}</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
