import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createPartner, listPartners, updatePartner, deletePartner, listAccounts,
  listCustomerTypes, upsertCustomerType, deleteCustomerType,
  listPartnerContacts, savePartnerContacts,
  listPartnerAttachments, uploadPartnerAttachment, deletePartnerAttachment, getPartnerAttachmentUrl,
} from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Paperclip, Pencil, Plus, Search, Settings2, Trash2, Upload, Users, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/customers")({
  component: CustomersPage,
});

type ContactRow = { id?: string; name: string; email: string; mobile: string };

type FormState = {
  id?: string;
  code: string; name_ar: string; name_en: string; vat_number: string;
  credit_limit: number; address_ar: string;
  receivable_account_id: string | null;
  customer_type_id: string | null;
  contacts: ContactRow[];
};

const emptyContact = (): ContactRow => ({ name: "", email: "", mobile: "" });

const emptyForm: FormState = {
  code: "", name_ar: "", name_en: "", vat_number: "",
  credit_limit: 0, address_ar: "",
  receivable_account_id: null,
  customer_type_id: null,
  contacts: [emptyContact()],
};

function CustomersPage() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const list = useServerFn(listPartners);
  const create = useServerFn(createPartner);
  const update = useServerFn(updatePartner);
  const remove = useServerFn(deletePartner);
  const accountsFn = useServerFn(listAccounts);
  const typesFn = useServerFn(listCustomerTypes);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [typesOpen, setTypesOpen] = useState(false);

  const { data: all = [] } = useQuery({
    queryKey: ["partners", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => accountsFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });

  const { data: customerTypes = [] } = useQuery({
    queryKey: ["customer_types", companyId],
    queryFn: () => typesFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const activeTypes = (customerTypes as any[]).filter((t) => t.is_active);


  // Show only accounts marked as Receivable in the Chart of Accounts
  const arAccounts = (accounts as any[]).filter(
    (a) => a.is_active && !a.is_group && a.is_receivable,
  );

  const customers = all.filter((p: any) => p.is_customer);
  const filtered = customers.filter((p: any) =>
    !q || p.code.includes(q) || p.name_ar?.includes(q) || p.name_en?.toLowerCase().includes(q.toLowerCase())
  );
  const totalCredit = customers.reduce((s: number, p: any) => s + Number(p.credit_limit ?? 0), 0);

  const isEdit = !!form.id;
  const accountLabel = (id?: string | null) => {
    if (!id) return "—";
    const a = (accounts as any[]).find((x) => x.id === id);
    return a ? `${a.code} — ${localized(a, "name")}` : "—";
  };
  const typeLabel = (id?: string | null) => {
    if (!id) return "—";
    const ct = (customerTypes as any[]).find((x) => x.id === id);
    return ct ? localized(ct, "name") : "—";
  };


  const computeNextCode = (typeId: string): string => {
    const ct = (customerTypes as any[]).find((x) => x.id === typeId);
    if (!ct) return "";
    const prefix = String(ct.code);
    const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`);
    const nums = customers
      .filter((p: any) => p.customer_type_id === typeId)
      .map((p: any) => {
        const m = String(p.code ?? "").match(re);
        return m ? parseInt(m[1], 10) : 0;
      });
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  };

  const openCreate = () => { setForm({ ...emptyForm, contacts: [emptyContact()] }); setOpen(true); };
  const contactsFn = useServerFn(listPartnerContacts);
  const saveContactsFn = useServerFn(savePartnerContacts);

  const openEdit = async (p: any) => {
    let contacts: ContactRow[] = [];
    try {
      const rows = await contactsFn({ data: { partnerId: p.id } });
      contacts = (rows as any[]).map((r) => ({
        id: r.id, name: r.name ?? "", email: r.email ?? "", mobile: r.mobile ?? "",
      }));
    } catch { /* ignore */ }
    if (contacts.length === 0) {
      contacts = [{ name: "", email: p.email ?? "", mobile: p.phone ?? "" }];
    }
    setForm({
      id: p.id, code: p.code, name_ar: p.name_ar, name_en: p.name_en,
      vat_number: p.vat_number ?? "",
      credit_limit: Number(p.credit_limit ?? 0), address_ar: p.address_ar ?? "",
      receivable_account_id: p.receivable_account_id ?? null,
      customer_type_id: p.customer_type_id ?? null,
      contacts,
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const primary = form.contacts[0] ?? emptyContact();
      const payload = {
        code: form.code, name_ar: form.name_ar, name_en: form.name_en,
        vat_number: form.vat_number || null,
        email: primary.email || null, phone: primary.mobile || null,
        credit_limit: Number(form.credit_limit) || 0,
        address_ar: form.address_ar || null,
        receivable_account_id: form.receivable_account_id || null,
        customer_type_id: form.customer_type_id || null,
      };
      let partnerId = form.id;
      if (form.id) {
        await update({ data: { id: form.id, ...payload } as any });
      } else {
        const row = await create({ data: {
          ...payload, is_customer: true, is_vendor: false, company_id: companyId!,
        } as any });
        partnerId = (row as any)?.id;
      }
      if (partnerId) {
        const cleaned = form.contacts
          .filter((c) => (c.name || c.email || c.mobile).trim().length > 0)
          .map((c) => ({
            ...(c.id ? { id: c.id } : {}),
            name: c.name.trim() || "—",
            email: c.email.trim() || null,
            mobile: c.mobile.trim() || null,
          }));
        await saveContactsFn({ data: { partnerId, contacts: cleaned } });
      }
      return { ok: true };
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["partners"] });
      setOpen(false);
      setForm(emptyForm);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: () => remove({ data: { id: deleteId! } }),
    onSuccess: () => {
      toast.success(t("common.deleted") || "Deleted");
      qc.invalidateQueries({ queryKey: ["partners"] });
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="page-title">{t("customers.title")}</h1>
          <p className="text-sm text-muted-foreground">{customers.length} {t("customers.activeCustomers")}</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTypesOpen(true)}>
            <Settings2 className="h-4 w-4 me-1" />
            {t("customers.manageTypes")}
          </Button>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(emptyForm); }}>
            <DialogTrigger asChild>
              <Button onClick={openCreate}><Plus className="h-4 w-4 me-1" />{t("common.add")}</Button>
            </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("customers.title")} — {isEdit ? t("common.edit") : t("common.add")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              {/* 1. Code */}
              <div>
                <Label>{t("common.code")} *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  readOnly={!isEdit && !!form.customer_type_id}
                  className={!isEdit && !!form.customer_type_id ? "bg-muted" : undefined}
                />
              </div>
              <div /> {/* spacer to keep Code on its own row visually */}

              {/* 2. Name (Ar) - 3. Name (En) */}
              <div><Label>{t("common.nameAr")} *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
              <div><Label>{t("common.nameEn")} *</Label><Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>

              {/* 4. Customer Type */}
              <div>
                <Label>{t("customers.customerType")}</Label>
                <Select
                  value={form.customer_type_id ?? "__none__"}
                  onValueChange={(v) => {
                    const newTypeId = v === "__none__" ? null : v;
                    const ct = newTypeId
                      ? (customerTypes as any[]).find((x) => x.id === newTypeId)
                      : null;
                    setForm((prev) => ({
                      ...prev,
                      customer_type_id: newTypeId,
                      code: !prev.id && newTypeId ? computeNextCode(newTypeId) : (!newTypeId && !prev.id ? "" : prev.code),
                      receivable_account_id: ct?.receivable_account_id
                        ? ct.receivable_account_id
                        : prev.receivable_account_id,
                    }));
                  }}
                >
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">— {t("common.none")} —</SelectItem>
                    {activeTypes.map((ct) => (
                      <SelectItem key={ct.id} value={ct.id}>
                        {ct.code} — {localized(ct, "name")}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 5. AR (GL) */}
              <div>
                <Label>{t("customers.receivableAccount")}</Label>
                <Input
                  readOnly
                  className="bg-muted"
                  value={
                    form.receivable_account_id
                      ? (() => {
                          const a = (accounts as any[]).find((x) => x.id === form.receivable_account_id);
                          return a ? `${a.code} — ${localized(a, "name")}` : "—";
                        })()
                      : ""
                  }
                  placeholder={t("customers.defaultFromJournal")}
                />
              </div>

              {/* 6. VAT - 7. National Address */}
              <div><Label>{t("partners.vatNumber")}</Label><Input dir="ltr" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} /></div>
              <div><Label>{t("customers.nationalAddress")}</Label><Input value={form.address_ar} onChange={(e) => setForm({ ...form, address_ar: e.target.value })} /></div>

              {/* 8-10. Contacts (Name, Email, Phone) — repeatable */}
              <div className="col-span-2 space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label>{t("customers.contacts")}</Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => setForm({ ...form, contacts: [...form.contacts, emptyContact()] })}
                  >
                    <Plus className="h-3.5 w-3.5 me-1" />{t("customers.addContact")}
                  </Button>
                </div>
                {form.contacts.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                    <div>
                      {idx === 0 && <Label className="text-xs">{t("customers.contactName")}</Label>}
                      <Input
                        value={c.name}
                        onChange={(e) => {
                          const next = [...form.contacts];
                          next[idx] = { ...c, name: e.target.value };
                          setForm({ ...form, contacts: next });
                        }}
                      />
                    </div>
                    <div>
                      {idx === 0 && <Label className="text-xs">{t("common.email")}</Label>}
                      <Input
                        dir="ltr"
                        type="email"
                        value={c.email}
                        onChange={(e) => {
                          const next = [...form.contacts];
                          next[idx] = { ...c, email: e.target.value };
                          setForm({ ...form, contacts: next });
                        }}
                      />
                    </div>
                    <div>
                      {idx === 0 && <Label className="text-xs">{t("common.phone")}</Label>}
                      <Input
                        dir="ltr"
                        value={c.mobile}
                        onChange={(e) => {
                          const next = [...form.contacts];
                          next[idx] = { ...c, mobile: e.target.value };
                          setForm({ ...form, contacts: next });
                        }}
                      />
                    </div>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="h-9 w-9 text-destructive"
                      disabled={form.contacts.length === 1}
                      onClick={() => {
                        const next = form.contacts.filter((_, i) => i !== idx);
                        setForm({ ...form, contacts: next.length ? next : [emptyContact()] });
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              {/* 11. Credit Limit */}
              <div><Label>{t("partners.creditLimit")}</Label><Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>

              {/* Attachments */}
              <div className="col-span-2 pt-2 border-t">
                <Label className="mb-2 block">{t("customers.attachments")}</Label>
                {form.id ? (
                  <PartnerAttachments partnerId={form.id} />
                ) : (
                  <p className="text-xs text-muted-foreground">{t("customers.saveFirstHint")}</p>
                )}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.code || !form.name_ar || !form.name_en}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center"><Users className="h-5 w-5 text-primary" /></div>
            <div>
              <div className="text-xs text-muted-foreground">{t("customers.activeCustomers")}</div>
              <div className="text-2xl font-bold font-mono">{customers.length}</div>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="text-xs text-muted-foreground">{t("partners.creditLimit")}</div>
          <div className="text-2xl font-bold font-mono">{totalCredit.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">SAR</span></div>
        </Card>
        <Card className="p-4">
          <Link to="/reports/aging" className="text-xs text-primary underline">{t("nav.aging")}</Link>
          <div className="text-2xl font-bold font-mono text-muted-foreground">—</div>
        </Card>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="ps-9 h-9" />
      </div>

      <Card>
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium font-mono">{t("partners.vatNumber")}</th>
              <th className="text-start p-3 font-medium">{t("customers.customerType")}</th>
              <th className="text-start p-3 font-medium">{t("customers.receivableAccountShort")}</th>
              <th className="text-start p-3 font-medium">{t("customers.phone")}</th>
              <th className="text-end p-3 font-medium font-mono">{t("partners.creditLimit")}</th>
              <th className="text-end p-3 font-medium w-24">{t("common.actions") || ""}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr key={p.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{p.code}</td>
                <td className="p-3 font-medium">{localized(p, "name")}</td>
                <td className="p-3 font-mono text-muted-foreground">{p.vat_number || "—"}</td>
                <td className="p-3 text-muted-foreground">{typeLabel(p.customer_type_id)}</td>
                <td className="p-3 font-mono text-muted-foreground">{accountLabel(p.receivable_account_id)}</td>
                <td className="p-3 font-mono text-muted-foreground">{p.phone || "—"}</td>
                <td className="p-3 text-end font-mono">{Number(p.credit_limit ?? 0).toLocaleString()}</td>
                <td className="p-3 text-end">
                  <div className="flex items-center justify-end gap-1">
                    <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEdit(p)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(v) => !v && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("common.deleteWarning")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteMut.mutate()} disabled={deleteMut.isPending}>
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <CustomerTypesDialog
        open={typesOpen}
        onClose={() => setTypesOpen(false)}
        types={customerTypes as any[]}
        arAccounts={arAccounts}
        companyId={companyId!}
      />
    </div>
  );
}

type CTFormState = {
  id?: string;
  code: string; name_ar: string; name_en: string; notes: string;
  is_active: boolean; sort_order: number;
  receivable_account_id: string | null;
};
const ctEmpty: CTFormState = {
  code: "", name_ar: "", name_en: "", notes: "", is_active: true, sort_order: 0,
  receivable_account_id: null,
};

function CustomerTypesDialog({
  open, onClose, types, arAccounts, companyId,
}: {
  open: boolean; onClose: () => void; types: any[]; arAccounts: any[]; companyId: string;
}) {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertCustomerType);
  const removeFn = useServerFn(deleteCustomerType);
  const [form, setForm] = useState<CTFormState>(ctEmpty);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const saveMut = useMutation({
    mutationFn: () =>
      upsertFn({
        data: {
          ...(form.id ? { id: form.id } : {}),
          company_id: companyId,
          code: form.code.trim(),
          name_ar: form.name_ar.trim(),
          name_en: form.name_en.trim(),
          notes: form.notes.trim() || null,
          is_active: form.is_active,
          sort_order: Number(form.sort_order) || 0,
          receivable_account_id: form.receivable_account_id || null,
        } as any,
      }),
    onSuccess: () => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["customer_types"] });
      setForm(ctEmpty);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.deleted"));
      qc.invalidateQueries({ queryKey: ["customer_types"] });
      qc.invalidateQueries({ queryKey: ["partners"] });
      setConfirmDelete(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (ct: any) => setForm({
    id: ct.id, code: ct.code, name_ar: ct.name_ar, name_en: ct.name_en,
    notes: ct.notes ?? "", is_active: !!ct.is_active, sort_order: ct.sort_order ?? 0,
    receivable_account_id: ct.receivable_account_id ?? null,
  });

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setForm(ctEmpty); onClose(); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{t("customers.manageTypes")}</DialogTitle></DialogHeader>

          <div className="grid grid-cols-6 gap-2 items-end p-3 rounded-md border bg-muted/30">
            <div className="col-span-1">
              <Label className="text-xs">{t("common.code")} *</Label>
              <Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{t("common.nameAr")} *</Label>
              <Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} />
            </div>
            <div className="col-span-2">
              <Label className="text-xs">{t("common.nameEn")} *</Label>
              <Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} />
            </div>
            <div className="col-span-1 flex items-center gap-2 pb-2">
              <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
              <Label className="text-xs">{t("common.active")}</Label>
            </div>
            <div className="col-span-6">
              <Label className="text-xs">{t("customers.receivableAccount")}</Label>
              <Select
                value={form.receivable_account_id ?? "__none__"}
                onValueChange={(v) => setForm({ ...form, receivable_account_id: v === "__none__" ? null : v })}
              >
                <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">— {t("common.none")} —</SelectItem>
                  {arAccounts.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.code} — {localized(a, "name")}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="col-span-6 flex justify-end gap-2">
              {form.id && (
                <Button variant="outline" size="sm" onClick={() => setForm(ctEmpty)}>
                  {t("common.cancel")}
                </Button>
              )}
              <Button
                size="sm"
                onClick={() => saveMut.mutate()}
                disabled={saveMut.isPending || !form.code || !form.name_ar || !form.name_en}
              >
                <Plus className="h-4 w-4 me-1" />
                {form.id ? t("common.save") : t("common.add")}
              </Button>
            </div>
          </div>

          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-xs">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-start p-2">{t("common.code")}</th>
                  <th className="text-start p-2">{t("common.name")}</th>
                  <th className="text-start p-2">{t("common.status")}</th>
                  <th className="text-end p-2 w-24">{t("common.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {types.map((ct) => (
                  <tr key={ct.id} className="border-t hover:bg-muted/30">
                    <td className="p-2 font-mono">{ct.code}</td>
                    <td className="p-2">{localized(ct, "name")}</td>
                    <td className="p-2">{ct.is_active ? t("common.active") : t("common.inactive")}</td>
                    <td className="p-2 text-end">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(ct)}>
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(ct)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
                {types.length === 0 && (
                  <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setForm(ctEmpty); onClose(); }}>{t("common.close")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("common.confirmDelete")} — {confirmDelete?.code}</AlertDialogTitle>
            <AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
