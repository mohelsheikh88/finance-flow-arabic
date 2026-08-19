import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createPartner, listPartners, updatePartner, deletePartner, listAccounts,
  listCustomerTypes, upsertCustomerType, deleteCustomerType,
  listVendorGroups, upsertVendorGroup, deleteVendorGroup,
  listPartnerContacts, savePartnerContacts,
} from "@/lib/api/accounting.functions";
import { useBranch } from "@/lib/branch-context";
import { useI18n, useLocalized } from "@/i18n";
import { COUNTRIES } from "@/lib/countries";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountCombobox } from "@/components/account-combobox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Pencil, Plus, Search, Trash2, Users, X } from "lucide-react";
import { toast } from "sonner";

import { PartnerBankAccounts, PartnerAttachments } from "@/components/partner-panels";

export const Route = createFileRoute("/_authenticated/partners")({
  component: PartnersPage,
});

type ContactRow = { id?: string; name: string; email: string; mobile: string };
const emptyContact = (): ContactRow => ({ name: "", email: "", mobile: "" });

type FormState = {
  id?: string;
  code: string; name_ar: string; name_en: string; vat_number: string;
  customer_type_id: string | null; vendor_group_id: string | null; country: string | null; address_ar: string;
  is_customer: boolean; is_vendor: boolean;
  receivable_account_id: string | null; payable_account_id: string | null;
  credit_limit: number;
  contacts: ContactRow[];
};

const emptyForm: FormState = {
  code: "", name_ar: "", name_en: "", vat_number: "",
  customer_type_id: null, vendor_group_id: null, country: null, address_ar: "",
  is_customer: true, is_vendor: false,
  receivable_account_id: null, payable_account_id: null,
  credit_limit: 0,
  contacts: [emptyContact()],
};

function PartnersPage() {
  const { t } = useI18n();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="page-title">{t("partners.title")}</h1>
      </div>

      <Tabs defaultValue="list">
        <TabsList>
          <TabsTrigger value="list">{t("partners.title")}</TabsTrigger>
          <TabsTrigger value="types">{t("partners.tabPartnerTypes")}</TabsTrigger>
        </TabsList>

        <TabsContent value="list" className="mt-4">
          <PartnersListTab />
        </TabsContent>
        <TabsContent value="types" className="mt-4">
          <PartnerTypesTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================== Partners list + CRUD ============================== */

function PartnersListTab() {
  const { t } = useI18n();
  const localized = useLocalized();
  const { companyId } = useBranch();
  const qc = useQueryClient();
  const list = useServerFn(listPartners);
  const create = useServerFn(createPartner);
  const update = useServerFn(updatePartner);
  const remove = useServerFn(deletePartner);
  const accFn = useServerFn(listAccounts);
  const typesFn = useServerFn(listCustomerTypes);
  const groupsFn = useServerFn(listVendorGroups);
  const contactsFn = useServerFn(listPartnerContacts);
  const saveContactsFn = useServerFn(savePartnerContacts);

  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: partners = [] } = useQuery({
    queryKey: ["partners", companyId],
    queryFn: () => list({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => accFn({ data: { companyId: companyId! } } as any),
    enabled: !!companyId,
  });
  const { data: customerTypes = [] } = useQuery({
    queryKey: ["customer_types", companyId],
    queryFn: () => typesFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const { data: vendorGroups = [] } = useQuery({
    queryKey: ["vendor_groups", companyId],
    queryFn: () => groupsFn({ data: { companyId: companyId! } }),
    enabled: !!companyId,
  });
  const activeTypes = (customerTypes as any[]).filter((c) => c.is_active);
  const activeGroups = (vendorGroups as any[]).filter((g) => g.is_active);

  const filtered = (partners as any[]).filter((p) =>
    !q || p.code.includes(q) || p.name_ar?.includes(q) || p.name_en?.toLowerCase().includes(q.toLowerCase())
  );

  const accountLabel = (id?: string | null) => {
    if (!id) return "—";
    const a = (accounts as any[]).find((x) => x.id === id);
    return a ? `${a.code} — ${localized(a, "name")}` : "—";
  };
  const typeLabel = (id?: string | null) => {
    if (!id) return "—";
    const ct = (customerTypes as any[]).find((c) => c.id === id);
    return ct ? localized(ct, "name") : "—";
  };
  const groupLabel = (id?: string | null) => {
    if (!id) return "—";
    const g = (vendorGroups as any[]).find((c) => c.id === id);
    return g ? localized(g, "name") : "—";
  };
  const countryLabel = (code?: string | null) => {
    if (!code) return "—";
    const c = COUNTRIES.find((c) => c.code === code);
    return c ? localized(c, "name") : code;
  };

  const computeNextCode = (prefix: string, scopeField: "customer_type_id" | "vendor_group_id", scopeId: string): string => {
    const re = new RegExp(`^${prefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}-(\\d+)$`);
    const nums = (partners as any[])
      .filter((p) => p[scopeField] === scopeId)
      .map((p) => {
        const m = String(p.code ?? "").match(re);
        return m ? parseInt(m[1], 10) : 0;
      });
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return `${prefix}-${String(next).padStart(4, "0")}`;
  };

  const isEdit = !!form.id;
  const openCreate = () => { setForm({ ...emptyForm, contacts: [emptyContact()] }); setOpen(true); };
  const openEdit = async (p: any) => {
    let contacts: ContactRow[] = [];
    try {
      const rows: any[] = await contactsFn({ data: { partnerId: p.id } });
      contacts = rows.length ? rows.map((c) => ({ id: c.id, name: c.name ?? "", email: c.email ?? "", mobile: c.mobile ?? "" })) : [emptyContact()];
    } catch {
      contacts = [emptyContact()];
    }
    setForm({
      id: p.id, code: p.code, name_ar: p.name_ar, name_en: p.name_en, vat_number: p.vat_number ?? "",
      customer_type_id: p.customer_type_id, vendor_group_id: p.vendor_group_id, country: p.country, address_ar: p.address_ar ?? "",
      is_customer: p.is_customer, is_vendor: p.is_vendor,
      receivable_account_id: p.receivable_account_id, payable_account_id: p.payable_account_id,
      credit_limit: Number(p.credit_limit ?? 0),
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
        customer_type_id: form.customer_type_id,
        vendor_group_id: form.vendor_group_id,
        country: form.country,
        address_ar: form.address_ar || null,
        is_customer: form.is_customer, is_vendor: form.is_vendor,
        receivable_account_id: form.is_customer ? form.receivable_account_id : null,
        payable_account_id: form.is_vendor ? form.payable_account_id : null,
        credit_limit: Number(form.credit_limit) || 0,
      };
      let partnerId = form.id;
      if (form.id) {
        await update({ data: { id: form.id, ...payload } as any });
      } else {
        const row = await create({ data: { ...payload, company_id: companyId! } as any });
        partnerId = (row as any)?.id;
      }
      if (partnerId) {
        const cleaned = form.contacts
          .filter((c) => (c.name || c.email || c.mobile).trim().length > 0)
          .map((c) => ({ ...(c.id ? { id: c.id } : {}), name: c.name.trim() || "—", email: c.email.trim() || null, mobile: c.mobile.trim() || null }));
        await saveContactsFn({ data: { partnerId, contacts: cleaned } });
      }
      return partnerId as string;
    },
    onSuccess: (id) => {
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["partners"] });
      setForm((f) => ({ ...f, id }));
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
    onError: (e: Error) => { toast.error(e.message); setDeleteId(null); },
  });

  const canSave = form.code && form.name_ar && form.name_en && (form.is_customer || form.is_vendor);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{(partners as any[]).length} {t("partners.title")}</p>
        <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setForm(emptyForm); }}>
          <DialogTrigger asChild>
            <Button onClick={openCreate}><Plus className="h-4 w-4 me-1" />{t("common.add")}</Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>{t("partners.title")} — {isEdit ? t("common.edit") : t("common.add")}</DialogTitle></DialogHeader>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("common.code")} *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  readOnly={!isEdit && !!(form.customer_type_id || form.vendor_group_id)}
                  className={!isEdit && !!(form.customer_type_id || form.vendor_group_id) ? "bg-muted" : undefined}
                />
              </div>
              <div className="flex items-center gap-4 pt-6">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch checked={form.is_customer} onCheckedChange={(v) => setForm({ ...form, is_customer: v })} />
                  {t("partners.isCustomer")}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch checked={form.is_vendor} onCheckedChange={(v) => setForm({ ...form, is_vendor: v })} />
                  {t("partners.isVendor")}
                </label>
              </div>

              <div><Label>{t("common.nameAr")} *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
              <div><Label>{t("common.nameEn")} *</Label><Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>

              {form.is_customer && (
                <div>
                  <Label>{t("customers.customerType")}</Label>
                  <Select
                    value={form.customer_type_id ?? "__none__"}
                    onValueChange={(v) => {
                      const newTypeId = v === "__none__" ? null : v;
                      const ct = newTypeId ? activeTypes.find((x) => x.id === newTypeId) : null;
                      setForm((prev) => ({
                        ...prev,
                        customer_type_id: newTypeId,
                        code: !prev.id && newTypeId ? computeNextCode(String(ct?.code ?? ""), "customer_type_id", newTypeId) : (!newTypeId && !prev.id ? "" : prev.code),
                        receivable_account_id: ct?.receivable_account_id ? ct.receivable_account_id : prev.receivable_account_id,
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— {t("common.none")} —</SelectItem>
                      {activeTypes.map((ct) => <SelectItem key={ct.id} value={ct.id}>{ct.code} — {localized(ct, "name")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.is_customer && (
                <div>
                  <Label>{t("customers.receivableAccount")}</Label>
                  <Input readOnly className="bg-muted" value={accountLabel(form.receivable_account_id)} placeholder={t("customers.defaultFromJournal")} />
                </div>
              )}

              {form.is_vendor && (
                <div>
                  <Label>{t("partners.vendorGroup")}</Label>
                  <Select
                    value={form.vendor_group_id ?? "__none__"}
                    onValueChange={(v) => {
                      const newGroupId = v === "__none__" ? null : v;
                      const g = newGroupId ? activeGroups.find((x) => x.id === newGroupId) : null;
                      setForm((prev) => ({
                        ...prev,
                        vendor_group_id: newGroupId,
                        code: !prev.id && newGroupId ? computeNextCode(String(g?.code ?? ""), "vendor_group_id", newGroupId) : (!newGroupId && !prev.id ? "" : prev.code),
                        payable_account_id: g?.payable_account_id ? g.payable_account_id : prev.payable_account_id,
                      }));
                    }}
                  >
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— {t("common.none")} —</SelectItem>
                      {activeGroups.map((g) => <SelectItem key={g.id} value={g.id}>{g.code} — {localized(g, "name")}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {form.is_vendor && (
                <div>
                  <Label>{t("partners.payableAccount")}</Label>
                  <Input readOnly className="bg-muted" value={accountLabel(form.payable_account_id)} placeholder={t("customers.defaultFromJournal")} />
                </div>
              )}

              <div><Label>{t("partners.vatNumber")}</Label><Input dir="ltr" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} /></div>
              <div>
                <Label>{t("partners.country")}</Label>
                <Select value={form.country ?? "__none__"} onValueChange={(v) => setForm({ ...form, country: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent className="max-h-72">
                    <SelectItem value="__none__">—</SelectItem>
                    {COUNTRIES.map((c) => <SelectItem key={c.code} value={c.code}>{localized(c, "name")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div className="col-span-2"><Label>{t("customers.nationalAddress")}</Label><Input value={form.address_ar} onChange={(e) => setForm({ ...form, address_ar: e.target.value })} /></div>

              <div className="col-span-2 space-y-2 pt-2 border-t">
                <div className="flex items-center justify-between">
                  <Label>{t("customers.contacts")}</Label>
                  <Button type="button" size="sm" variant="outline" onClick={() => setForm({ ...form, contacts: [...form.contacts, emptyContact()] })}>
                    <Plus className="h-3.5 w-3.5 me-1" />{t("customers.addContact")}
                  </Button>
                </div>
                {form.contacts.map((c, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
                    <div>{idx === 0 && <Label className="text-xs">{t("customers.contactName")}</Label>}<Input value={c.name} onChange={(e) => { const next = [...form.contacts]; next[idx] = { ...c, name: e.target.value }; setForm({ ...form, contacts: next }); }} /></div>
                    <div>{idx === 0 && <Label className="text-xs">{t("common.email")}</Label>}<Input dir="ltr" type="email" value={c.email} onChange={(e) => { const next = [...form.contacts]; next[idx] = { ...c, email: e.target.value }; setForm({ ...form, contacts: next }); }} /></div>
                    <div>{idx === 0 && <Label className="text-xs">{t("common.phone")}</Label>}<Input dir="ltr" value={c.mobile} onChange={(e) => { const next = [...form.contacts]; next[idx] = { ...c, mobile: e.target.value }; setForm({ ...form, contacts: next }); }} /></div>
                    <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive" disabled={form.contacts.length === 1} onClick={() => { const next = form.contacts.filter((_, i) => i !== idx); setForm({ ...form, contacts: next.length ? next : [emptyContact()] }); }}>
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>

              <div className="col-span-2 pt-2 border-t">
                <Label className="mb-2 block">{t("partners.tabBankAccounts")}</Label>
                {form.id ? <PartnerBankAccounts partnerId={form.id} /> : <p className="text-xs text-muted-foreground">{t("customers.saveFirstHint")}</p>}
              </div>

              <div><Label>{t("partners.creditLimit")}</Label><Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>

              <div className="col-span-2 pt-2 border-t">
                <Label className="mb-2 block">{t("customers.attachments")}</Label>
                {form.id ? <PartnerAttachments partnerId={form.id} /> : <p className="text-xs text-muted-foreground">{t("customers.saveFirstHint")}</p>}
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
              <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>{t("common.save")}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder={t("common.search")} value={q} onChange={(e) => setQ(e.target.value)} className="ps-9 h-9" />
      </div>

      <Card className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-start p-3 font-medium">{t("common.code")}</th>
              <th className="text-start p-3 font-medium">{t("common.name")}</th>
              <th className="text-start p-3 font-medium">{t("partners.partnerType")}</th>
              <th className="text-start p-3 font-medium">{t("common.status")}</th>
              <th className="text-start p-3 font-medium">{t("partners.country")}</th>
              <th className="text-start p-3 font-medium font-mono">{t("partners.vatNumber")}</th>
              <th className="text-center p-3 font-medium">{t("common.actions")}</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((p: any) => (
              <tr key={p.id} className="border-t hover:bg-muted/30">
                <td className="p-3 font-mono">{p.code}</td>
                <td className="p-3 font-medium">{localized(p, "name")}</td>
                <td className="p-3 space-x-1 rtl:space-x-reverse">
                  {p.is_customer && <Badge variant="outline" className="bg-info/10 text-info border-info/30">{t("partners.isCustomer")}</Badge>}
                  {p.is_vendor && <Badge variant="outline" className="bg-warning/10 text-warning border-warning/30">{t("partners.isVendor")}</Badge>}
                </td>
                <td className="p-3 text-muted-foreground">
                  {[p.is_customer && typeLabel(p.customer_type_id), p.is_vendor && groupLabel(p.vendor_group_id)]
                    .filter((v) => v && v !== "—")
                    .join(" · ") || "—"}
                </td>
                <td className="p-3 text-muted-foreground">{countryLabel(p.country)}</td>
                <td className="p-3 font-mono text-muted-foreground">{p.vat_number || "—"}</td>
                <td className="p-3">
                  <div className="flex items-center justify-center gap-1">
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}><Pencil className="h-3.5 w-3.5" /></Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => setDeleteId(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
          </tbody>
        </table>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteMut.mutate()}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

/* ============================== Partner Types tab: Customer Types + Vendor Types ============================== */

function PartnerTypesTab() {
  const { t } = useI18n();
  const { companyId } = useBranch();
  const accFn = useServerFn(listAccounts);
  const { data: accounts = [] } = useQuery({
    queryKey: ["accounts", companyId],
    queryFn: () => accFn({ data: { companyId: companyId! } } as any),
    enabled: !!companyId,
  });
  const arAccounts = (accounts as any[]).filter((a) => a.is_active && !a.is_group && a.is_receivable);
  const apAccounts = (accounts as any[]).filter((a) => a.is_active && !a.is_group && a.is_payable);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("customers.manageTypes")}</h2>
        <CustomerTypesPanel arAccounts={arAccounts} companyId={companyId!} />
      </section>
      <section className="space-y-3">
        <h2 className="text-sm font-semibold">{t("partners.manageVendorGroups")}</h2>
        <VendorTypesPanel apAccounts={apAccounts} companyId={companyId!} />
      </section>
    </div>
  );
}

type CTFormState = { id?: string; code: string; name_ar: string; name_en: string; notes: string; is_active: boolean; sort_order: number; receivable_account_id: string | null };
const ctEmpty: CTFormState = { code: "", name_ar: "", name_en: "", notes: "", is_active: true, sort_order: 0, receivable_account_id: null };

function CustomerTypesPanel({ arAccounts, companyId }: { arAccounts: any[]; companyId: string }) {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();
  const listFn = useServerFn(listCustomerTypes);
  const upsertFn = useServerFn(upsertCustomerType);
  const removeFn = useServerFn(deleteCustomerType);
  const [form, setForm] = useState<CTFormState>(ctEmpty);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const { data: types = [] } = useQuery({
    queryKey: ["customer_types", companyId],
    queryFn: () => listFn({ data: { companyId } }),
    enabled: !!companyId,
  });

  const saveMut = useMutation({
    mutationFn: () => upsertFn({ data: {
      ...(form.id ? { id: form.id } : {}), company_id: companyId,
      code: form.code.trim(), name_ar: form.name_ar.trim(), name_en: form.name_en.trim(),
      notes: form.notes.trim() || null, is_active: form.is_active, sort_order: Number(form.sort_order) || 0,
      receivable_account_id: form.receivable_account_id || null,
    } as any }),
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["customer_types"] }); setForm(ctEmpty); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["customer_types"] }); qc.invalidateQueries({ queryKey: ["partners"] }); setConfirmDelete(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (ct: any) => setForm({
    id: ct.id, code: ct.code, name_ar: ct.name_ar, name_en: ct.name_en,
    notes: ct.notes ?? "", is_active: !!ct.is_active, sort_order: ct.sort_order ?? 0,
    receivable_account_id: ct.receivable_account_id ?? null,
  });

  return (
    <>
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-6 gap-2 items-end p-3 rounded-md border bg-muted/30">
          <div className="col-span-1"><Label className="text-xs">{t("common.code")} *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div className="col-span-2"><Label className="text-xs">{t("common.nameAr")} *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
          <div className="col-span-2"><Label className="text-xs">{t("common.nameEn")} *</Label><Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
          <div className="col-span-1 flex items-center gap-2 pb-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label className="text-xs">{t("common.active")}</Label></div>
          <div className="col-span-6">
            <Label className="text-xs">{t("customers.receivableAccount")}</Label>
            <AccountCombobox accounts={arAccounts} value={form.receivable_account_id} onChange={(v) => setForm({ ...form, receivable_account_id: v })} />
          </div>
          <div className="col-span-6 flex justify-end gap-2">
            {form.id && <Button variant="outline" size="sm" onClick={() => setForm(ctEmpty)}>{t("common.cancel")}</Button>}
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.code || !form.name_ar || !form.name_en}>
              <Plus className="h-4 w-4 me-1" />{form.id ? t("common.save") : t("common.add")}
            </Button>
          </div>
        </div>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr><th className="text-start p-2">{t("common.code")}</th><th className="text-start p-2">{t("common.name")}</th><th className="text-start p-2">{t("common.status")}</th><th className="text-end p-2 w-24">{t("common.actions")}</th></tr></thead>
            <tbody>
              {(types as any[]).map((ct) => (
                <tr key={ct.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-mono">{ct.code}</td>
                  <td className="p-2">{localized(ct, "name")}</td>
                  <td className="p-2">{ct.is_active ? t("common.active") : t("common.inactive")}</td>
                  <td className="p-2 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(ct)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(ct)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(types as any[]).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")} — {confirmDelete?.code}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

type VGFormState = { id?: string; code: string; name_ar: string; name_en: string; notes: string; is_active: boolean; sort_order: number; payable_account_id: string | null };
const vgEmpty: VGFormState = { code: "", name_ar: "", name_en: "", notes: "", is_active: true, sort_order: 0, payable_account_id: null };

function VendorTypesPanel({ apAccounts, companyId }: { apAccounts: any[]; companyId: string }) {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();
  const listFn = useServerFn(listVendorGroups);
  const upsertFn = useServerFn(upsertVendorGroup);
  const removeFn = useServerFn(deleteVendorGroup);
  const [form, setForm] = useState<VGFormState>(vgEmpty);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

  const { data: groups = [] } = useQuery({
    queryKey: ["vendor_groups", companyId],
    queryFn: () => listFn({ data: { companyId } }),
    enabled: !!companyId,
  });

  const saveMut = useMutation({
    mutationFn: () => upsertFn({ data: {
      ...(form.id ? { id: form.id } : {}), company_id: companyId,
      code: form.code.trim(), name_ar: form.name_ar.trim(), name_en: form.name_en.trim(),
      notes: form.notes.trim() || null, is_active: form.is_active, sort_order: Number(form.sort_order) || 0,
      payable_account_id: form.payable_account_id || null,
    } as any }),
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["vendor_groups"] }); setForm(vgEmpty); },
    onError: (e: Error) => toast.error(e.message),
  });
  const deleteMut = useMutation({
    mutationFn: (id: string) => removeFn({ data: { id } }),
    onSuccess: () => { toast.success(t("common.deleted")); qc.invalidateQueries({ queryKey: ["vendor_groups"] }); qc.invalidateQueries({ queryKey: ["partners"] }); setConfirmDelete(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const startEdit = (g: any) => setForm({
    id: g.id, code: g.code, name_ar: g.name_ar, name_en: g.name_en,
    notes: g.notes ?? "", is_active: !!g.is_active, sort_order: g.sort_order ?? 0,
    payable_account_id: g.payable_account_id ?? null,
  });

  return (
    <>
      <Card className="p-3 space-y-3">
        <div className="grid grid-cols-6 gap-2 items-end p-3 rounded-md border bg-muted/30">
          <div className="col-span-1"><Label className="text-xs">{t("common.code")} *</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
          <div className="col-span-2"><Label className="text-xs">{t("common.nameAr")} *</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} /></div>
          <div className="col-span-2"><Label className="text-xs">{t("common.nameEn")} *</Label><Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
          <div className="col-span-1 flex items-center gap-2 pb-2"><Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} /><Label className="text-xs">{t("common.active")}</Label></div>
          <div className="col-span-6">
            <Label className="text-xs">{t("partners.payableAccount")}</Label>
            <AccountCombobox accounts={apAccounts} value={form.payable_account_id} onChange={(v) => setForm({ ...form, payable_account_id: v })} />
          </div>
          <div className="col-span-6 flex justify-end gap-2">
            {form.id && <Button variant="outline" size="sm" onClick={() => setForm(vgEmpty)}>{t("common.cancel")}</Button>}
            <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending || !form.code || !form.name_ar || !form.name_en}>
              <Plus className="h-4 w-4 me-1" />{form.id ? t("common.save") : t("common.add")}
            </Button>
          </div>
        </div>
        <div className="border rounded-md overflow-hidden">
          <table className="w-full text-xs">
            <thead className="bg-muted/50"><tr><th className="text-start p-2">{t("common.code")}</th><th className="text-start p-2">{t("common.name")}</th><th className="text-start p-2">{t("common.status")}</th><th className="text-end p-2 w-24">{t("common.actions")}</th></tr></thead>
            <tbody>
              {(groups as any[]).map((g) => (
                <tr key={g.id} className="border-t hover:bg-muted/30">
                  <td className="p-2 font-mono">{g.code}</td>
                  <td className="p-2">{localized(g, "name")}</td>
                  <td className="p-2">{g.is_active ? t("common.active") : t("common.inactive")}</td>
                  <td className="p-2 text-end">
                    <div className="flex items-center justify-end gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => startEdit(g)}><Pencil className="h-3.5 w-3.5" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => setConfirmDelete(g)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </td>
                </tr>
              ))}
              {(groups as any[]).length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")} — {confirmDelete?.code}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
