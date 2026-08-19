import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  createPartner, listPartners, updatePartner, deletePartner, listAccounts,
  listCustomerTypes, upsertCustomerType, deleteCustomerType,
  listVendorGroups, upsertVendorGroup, deleteVendorGroup,
  listPartnerContacts, savePartnerContacts,
  listPartnerAttachments, uploadPartnerAttachment, deletePartnerAttachment, getPartnerAttachmentUrl,
  listPartnerBankAccounts, savePartnerBankAccounts, uploadBankAccountIban, getBankAccountIbanUrl,
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
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AccountCombobox } from "@/components/account-combobox";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Paperclip, Pencil, Plus, Search, Settings2, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/partners")({
  component: PartnersPage,
});

const DOC_TYPES = ["cr", "vat", "national_address", "contract", "other"] as const;
type DocType = (typeof DOC_TYPES)[number];

type FormState = {
  id?: string;
  code: string; name_ar: string; name_en: string; vat_number: string;
  customer_type_id: string | null; vendor_group_id: string | null; country: string | null; address_ar: string;
  is_customer: boolean; is_vendor: boolean;
  receivable_account_id: string | null; payable_account_id: string | null;
  credit_limit: number;
};

const emptyForm: FormState = {
  code: "", name_ar: "", name_en: "", vat_number: "",
  customer_type_id: null, vendor_group_id: null, country: null, address_ar: "",
  is_customer: true, is_vendor: false,
  receivable_account_id: null, payable_account_id: null,
  credit_limit: 0,
};

function PartnersPage() {
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

  const [typesOpen, setTypesOpen] = useState(false);
  const [groupsOpen, setGroupsOpen] = useState(false);

  const receivableAccounts = (accounts as any[]).filter((a) => !a.is_group && a.account_type === "asset");
  const payableAccounts = (accounts as any[]).filter((a) => !a.is_group && a.account_type === "liability");

  const filtered = (partners as any[]).filter((p) =>
    !q || p.code.includes(q) || p.name_ar?.includes(q) || p.name_en?.toLowerCase().includes(q.toLowerCase())
  );

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

  const computeNextCode = (): string => {
    const nums = (partners as any[]).map((p) => {
      const m = String(p.code ?? "").match(/^(\d+)$/);
      return m ? parseInt(m[1], 10) : 0;
    });
    const next = (nums.length ? Math.max(...nums) : 0) + 1;
    return String(next).padStart(5, "0");
  };

  const openCreate = () => { setForm({ ...emptyForm, code: computeNextCode() }); setOpen(true); };
  const openEdit = (p: any) => {
    setForm({
      id: p.id, code: p.code, name_ar: p.name_ar, name_en: p.name_en, vat_number: p.vat_number ?? "",
      customer_type_id: p.customer_type_id, vendor_group_id: p.vendor_group_id, country: p.country, address_ar: p.address_ar ?? "",
      is_customer: p.is_customer, is_vendor: p.is_vendor,
      receivable_account_id: p.receivable_account_id, payable_account_id: p.payable_account_id,
      credit_limit: Number(p.credit_limit ?? 0),
    });
    setOpen(true);
  };

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = {
        code: form.code, name_ar: form.name_ar, name_en: form.name_en,
        vat_number: form.vat_number || null,
        customer_type_id: form.customer_type_id,
        vendor_group_id: form.vendor_group_id,
        country: form.country,
        address_ar: form.address_ar || null,
        is_customer: form.is_customer, is_vendor: form.is_vendor,
        receivable_account_id: form.is_customer ? form.receivable_account_id : null,
        payable_account_id: form.is_vendor ? form.payable_account_id : null,
        credit_limit: Number(form.credit_limit) || 0,
      };
      if (form.id) {
        await update({ data: { id: form.id, ...payload } as any });
        return form.id;
      }
      const row = await create({ data: { ...payload, company_id: companyId! } as any });
      return (row as any)?.id as string;
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

  const canSave = form.code.trim() && form.name_ar.trim() && form.name_en.trim() && (form.is_customer || form.is_vendor);

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="page-title">{t("partners.title")}</h1>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => setTypesOpen(true)}>
            <Settings2 className="h-4 w-4 me-1" />
            {t("customers.manageTypes")}
          </Button>
          <Button variant="outline" onClick={() => setGroupsOpen(true)}>
            <Settings2 className="h-4 w-4 me-1" />
            {t("partners.manageVendorGroups")}
          </Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4 me-1" />{t("common.add")}</Button>
        </div>
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
              <th className="text-start p-3 font-medium">{t("partners.partnerCategoryType")}</th>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl max-h-[88vh] overflow-y-auto">
          <DialogHeader><DialogTitle>{t("partners.title")}</DialogTitle></DialogHeader>

          <div className="grid grid-cols-2 gap-3">
            <div><Label>{t("common.nameAr")}</Label><Input value={form.name_ar} onChange={(e) => setForm({ ...form, name_ar: e.target.value })} dir="rtl" /></div>
            <div><Label>{t("common.nameEn")}</Label><Input dir="ltr" value={form.name_en} onChange={(e) => setForm({ ...form, name_en: e.target.value })} /></div>
            <div><Label>{t("common.code")}</Label><Input value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} /></div>
            <div><Label>{t("partners.vatNumber")}</Label><Input dir="ltr" value={form.vat_number} onChange={(e) => setForm({ ...form, vat_number: e.target.value })} /></div>
            {form.is_customer && (
              <div>
                <Label>{t("customers.customerType")}</Label>
                <Select value={form.customer_type_id ?? "__none__"} onValueChange={(v) => setForm({ ...form, customer_type_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {(customerTypes as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {localized(c, "name")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
            {form.is_vendor && (
              <div>
                <Label>{t("partners.vendorGroup")}</Label>
                <Select value={form.vendor_group_id ?? "__none__"} onValueChange={(v) => setForm({ ...form, vendor_group_id: v === "__none__" ? null : v })}>
                  <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">—</SelectItem>
                    {(vendorGroups as any[]).map((c) => <SelectItem key={c.id} value={c.id}>{c.code} — {localized(c, "name")}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}
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
          </div>

          <Tabs defaultValue="accounting" className="mt-2">
            <TabsList>
              <TabsTrigger value="accounting">{t("partners.tabAccounting")}</TabsTrigger>
              <TabsTrigger value="contacts">{t("customers.contacts")}</TabsTrigger>
              <TabsTrigger value="bank">{t("partners.tabBankAccounts")}</TabsTrigger>
              <TabsTrigger value="attachments">{t("customers.attachments")}</TabsTrigger>
            </TabsList>

            <TabsContent value="accounting" className="mt-4 space-y-4">
              <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch checked={form.is_customer} onCheckedChange={(v) => setForm({ ...form, is_customer: v })} />
                  {t("partners.isCustomer")}
                </label>
                <label className="flex items-center gap-2 text-sm cursor-pointer">
                  <Switch checked={form.is_vendor} onCheckedChange={(v) => setForm({ ...form, is_vendor: v })} />
                  {t("partners.isVendor")}
                </label>
              </div>
              <div className="grid grid-cols-2 gap-3">
                {form.is_customer && (
                  <div>
                    <Label>{t("customers.receivableAccountShort")}</Label>
                    <AccountCombobox accounts={receivableAccounts} value={form.receivable_account_id} onChange={(v) => setForm({ ...form, receivable_account_id: v })} />
                  </div>
                )}
                {form.is_vendor && (
                  <div>
                    <Label>{t("partners.payableAccount")}</Label>
                    <AccountCombobox accounts={payableAccounts} value={form.payable_account_id} onChange={(v) => setForm({ ...form, payable_account_id: v })} />
                  </div>
                )}
                <div><Label>{t("partners.creditLimit")}</Label><Input type="number" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: Number(e.target.value) })} /></div>
              </div>
            </TabsContent>

            <TabsContent value="contacts" className="mt-4">
              {form.id ? <PartnerContacts partnerId={form.id} /> : <p className="text-xs text-muted-foreground">{t("customers.saveFirstHint")}</p>}
            </TabsContent>

            <TabsContent value="bank" className="mt-4">
              {form.id ? <PartnerBankAccounts partnerId={form.id} /> : <p className="text-xs text-muted-foreground">{t("customers.saveFirstHint")}</p>}
            </TabsContent>

            <TabsContent value="attachments" className="mt-4">
              {form.id ? <PartnerAttachments partnerId={form.id} /> : <p className="text-xs text-muted-foreground">{t("customers.saveFirstHint")}</p>}
            </TabsContent>
          </Tabs>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => saveMut.mutate()} disabled={!canSave || saveMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => deleteMut.mutate()}>{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {typesOpen && (
        <CustomerTypesDialog
          open={typesOpen}
          onClose={() => setTypesOpen(false)}
          types={customerTypes as any[]}
          arAccounts={receivableAccounts}
          companyId={companyId!}
        />
      )}
      {groupsOpen && (
        <VendorGroupsDialog
          open={groupsOpen}
          onClose={() => setGroupsOpen(false)}
          groups={vendorGroups as any[]}
          apAccounts={payableAccounts}
          companyId={companyId!}
        />
      )}
    </div>
  );
}

/* ============================== Manage Customer Types ============================== */

type CTFormState = { id?: string; code: string; name_ar: string; name_en: string; notes: string; is_active: boolean; sort_order: number; receivable_account_id: string | null };
const ctEmpty: CTFormState = { code: "", name_ar: "", name_en: "", notes: "", is_active: true, sort_order: 0, receivable_account_id: null };

function CustomerTypesDialog({
  open, onClose, types, arAccounts, companyId,
}: { open: boolean; onClose: () => void; types: any[]; arAccounts: any[]; companyId: string }) {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertCustomerType);
  const removeFn = useServerFn(deleteCustomerType);
  const [form, setForm] = useState<CTFormState>(ctEmpty);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

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
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setForm(ctEmpty); onClose(); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{t("customers.manageTypes")}</DialogTitle></DialogHeader>
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
                {types.map((ct) => (
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
                {types.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
              </tbody>
            </table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setForm(ctEmpty); onClose(); }}>{t("common.close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")} — {confirmDelete?.code}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/* ============================== Manage Vendor Groups ============================== */

type VGFormState = { id?: string; code: string; name_ar: string; name_en: string; notes: string; is_active: boolean; sort_order: number; payable_account_id: string | null };
const vgEmpty: VGFormState = { code: "", name_ar: "", name_en: "", notes: "", is_active: true, sort_order: 0, payable_account_id: null };

function VendorGroupsDialog({
  open, onClose, groups, apAccounts, companyId,
}: { open: boolean; onClose: () => void; groups: any[]; apAccounts: any[]; companyId: string }) {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();
  const upsertFn = useServerFn(upsertVendorGroup);
  const removeFn = useServerFn(deleteVendorGroup);
  const [form, setForm] = useState<VGFormState>(vgEmpty);
  const [confirmDelete, setConfirmDelete] = useState<any | null>(null);

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
      <Dialog open={open} onOpenChange={(v) => { if (!v) { setForm(vgEmpty); onClose(); } }}>
        <DialogContent className="max-w-3xl">
          <DialogHeader><DialogTitle>{t("partners.manageVendorGroups")}</DialogTitle></DialogHeader>
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
                {groups.map((g) => (
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
                {groups.length === 0 && <tr><td colSpan={4} className="p-6 text-center text-muted-foreground">{t("common.noData")}</td></tr>}
              </tbody>
            </table>
          </div>
          <DialogFooter><Button variant="outline" onClick={() => { setForm(vgEmpty); onClose(); }}>{t("common.close")}</Button></DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>{t("common.confirmDelete")} — {confirmDelete?.code}</AlertDialogTitle><AlertDialogDescription>{t("common.deleteWarning")}</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel><AlertDialogAction onClick={() => confirmDelete && deleteMut.mutate(confirmDelete.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{t("common.delete")}</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PartnerContacts({ partnerId }: { partnerId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listPartnerContacts);
  const saveFn = useServerFn(savePartnerContacts);
  const { data: contacts = [] } = useQuery({
    queryKey: ["partner_contacts", partnerId],
    queryFn: () => listFn({ data: { partnerId } }),
  });

  type Row = { id?: string; name: string; email: string; mobile: string };
  const [rows, setRows] = useState<Row[] | null>(null);
  const effective: Row[] = rows ?? (contacts as any[]).map((c) => ({ id: c.id, name: c.name ?? "", email: c.email ?? "", mobile: c.mobile ?? "" }));
  const list = effective.length ? effective : [{ name: "", email: "", mobile: "" }];

  const saveMut = useMutation({
    mutationFn: () => saveFn({
      data: {
        partnerId,
        contacts: list
          .filter((c) => (c.name || c.email || c.mobile).trim().length > 0)
          .map((c) => ({ ...(c.id ? { id: c.id } : {}), name: c.name.trim() || "—", email: c.email.trim() || null, mobile: c.mobile.trim() || null })),
      },
    }),
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["partner_contacts", partnerId] }); setRows(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (idx: number, patch: Partial<Row>) => setRows(list.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{t("customers.contacts")}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setRows([...list, { name: "", email: "", mobile: "" }])}>
          <Plus className="h-3.5 w-3.5 me-1" />{t("customers.addContact")}
        </Button>
      </div>
      {list.map((c, idx) => (
        <div key={idx} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2 items-end">
          <div>{idx === 0 && <Label className="text-xs">{t("customers.contactName")}</Label>}<Input value={c.name} onChange={(e) => update(idx, { name: e.target.value })} /></div>
          <div>{idx === 0 && <Label className="text-xs">{t("common.email")}</Label>}<Input dir="ltr" type="email" value={c.email} onChange={(e) => update(idx, { email: e.target.value })} /></div>
          <div>{idx === 0 && <Label className="text-xs">{t("common.phone")}</Label>}<Input dir="ltr" value={c.mobile} onChange={(e) => update(idx, { mobile: e.target.value })} /></div>
          <Button type="button" size="icon" variant="ghost" className="h-9 w-9 text-destructive" disabled={list.length === 1} onClick={() => setRows(list.filter((_, i) => i !== idx))}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex justify-end pt-1">
        <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{t("common.save")}</Button>
      </div>
    </div>
  );
}

function PartnerBankAccounts({ partnerId }: { partnerId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listPartnerBankAccounts);
  const saveFn = useServerFn(savePartnerBankAccounts);
  const uploadFn = useServerFn(uploadBankAccountIban);
  const urlFn = useServerFn(getBankAccountIbanUrl);

  const { data: accounts = [] } = useQuery({
    queryKey: ["partner_bank_accounts", partnerId],
    queryFn: () => listFn({ data: { partnerId } }),
  });

  type Row = { id?: string; bank_name: string; account_name: string; account_number: string; iban: string; swift_code: string; currency_code: string; is_primary: boolean; iban_file_name?: string | null };
  const empty = (): Row => ({ bank_name: "", account_name: "", account_number: "", iban: "", swift_code: "", currency_code: "SAR", is_primary: false });
  const [rows, setRows] = useState<Row[] | null>(null);
  const effective: Row[] = rows ?? (accounts as any[]).map((a) => ({
    id: a.id, bank_name: a.bank_name ?? "", account_name: a.account_name ?? "", account_number: a.account_number ?? "",
    iban: a.iban ?? "", swift_code: a.swift_code ?? "", currency_code: a.currency_code ?? "SAR", is_primary: a.is_primary, iban_file_name: a.iban_file_name,
  }));
  const list = effective.length ? effective : [empty()];
  const [uploadingIdx, setUploadingIdx] = useState<number | null>(null);

  const saveMut = useMutation({
    mutationFn: () => saveFn({
      data: {
        partnerId,
        accounts: list
          .filter((r) => r.bank_name.trim())
          .map((r) => ({
            ...(r.id ? { id: r.id } : {}),
            bank_name: r.bank_name.trim(), account_name: r.account_name || null, account_number: r.account_number || null,
            iban: r.iban || null, swift_code: r.swift_code || null, currency_code: r.currency_code || "SAR", is_primary: r.is_primary,
          })),
      },
    }),
    onSuccess: () => { toast.success(t("common.saved")); qc.invalidateQueries({ queryKey: ["partner_bank_accounts", partnerId] }); setRows(null); },
    onError: (e: Error) => toast.error(e.message),
  });

  const update = (idx: number, patch: Partial<Row>) => setRows(list.map((r, i) => (i === idx ? { ...r, ...patch } : r)));

  const onUploadIban = async (idx: number, file: File) => {
    const row = list[idx];
    if (!row.id) { toast.error(t("common.saved")); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
    setUploadingIdx(idx);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      const contentBase64 = btoa(binary);
      await uploadFn({ data: { bankAccountId: row.id, fileName: file.name, mimeType: file.type || null, contentBase64 } });
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["partner_bank_accounts", partnerId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploadingIdx(null);
    }
  };

  const onDownloadIban = async (idx: number) => {
    const row = list[idx];
    if (!row.id) return;
    try {
      const { url } = await urlFn({ data: { bankAccountId: row.id } });
      window.open(url, "_blank", "noopener");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-semibold">{t("partners.tabBankAccounts")}</Label>
        <Button type="button" size="sm" variant="outline" onClick={() => setRows([...list, empty()])}>
          <Plus className="h-3.5 w-3.5 me-1" />{t("partners.addBankAccount")}
        </Button>
      </div>
      {list.map((r, idx) => (
        <Card key={idx} className="p-3 space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div><Label className="text-xs">{t("partners.bankName")}</Label><Input value={r.bank_name} onChange={(e) => update(idx, { bank_name: e.target.value })} /></div>
            <div><Label className="text-xs">{t("partners.accountName")}</Label><Input value={r.account_name} onChange={(e) => update(idx, { account_name: e.target.value })} /></div>
            <div><Label className="text-xs">{t("partners.accountNumber")}</Label><Input dir="ltr" value={r.account_number} onChange={(e) => update(idx, { account_number: e.target.value })} /></div>
            <div><Label className="text-xs">IBAN</Label><Input dir="ltr" value={r.iban} onChange={(e) => update(idx, { iban: e.target.value })} /></div>
            <div><Label className="text-xs">{t("partners.swiftCode")}</Label><Input dir="ltr" value={r.swift_code} onChange={(e) => update(idx, { swift_code: e.target.value })} /></div>
            <div><Label className="text-xs">{t("common.currency")}</Label><Input dir="ltr" maxLength={3} value={r.currency_code} onChange={(e) => update(idx, { currency_code: e.target.value.toUpperCase() })} /></div>
          </div>
          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <Switch checked={r.is_primary} onCheckedChange={(v) => update(idx, { is_primary: v })} />
              {t("partners.primaryAccount")}
            </label>
            <div className="flex items-center gap-1">
              {r.id ? (
                r.iban_file_name ? (
                  <Button size="sm" variant="ghost" className="h-7 gap-1 text-xs" onClick={() => onDownloadIban(idx)}>
                    <Paperclip className="h-3.5 w-3.5" />{r.iban_file_name}
                  </Button>
                ) : (
                  <label className="cursor-pointer">
                    <input type="file" className="hidden" disabled={uploadingIdx === idx} onChange={(e) => { const f = e.target.files?.[0]; if (f) onUploadIban(idx, f); e.target.value = ""; }} />
                    <span className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md border bg-background text-xs hover:bg-muted">
                      <Upload className="h-3.5 w-3.5" />{uploadingIdx === idx ? "…" : t("partners.uploadIban")}
                    </span>
                  </label>
                )
              ) : (
                <span className="text-[11px] text-muted-foreground">{t("common.save")}</span>
              )}
              <Button type="button" size="icon" variant="ghost" className="h-7 w-7 text-destructive" disabled={list.length === 1} onClick={() => setRows(list.filter((_, i) => i !== idx))}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </Card>
      ))}
      <div className="flex justify-end">
        <Button size="sm" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>{t("common.save")}</Button>
      </div>
    </div>
  );
}

function PartnerAttachments({ partnerId }: { partnerId: string }) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const listFn = useServerFn(listPartnerAttachments);
  const uploadFn = useServerFn(uploadPartnerAttachment);
  const deleteFn = useServerFn(deletePartnerAttachment);
  const urlFn = useServerFn(getPartnerAttachmentUrl);
  const [docType, setDocType] = useState<DocType>("cr");
  const [uploading, setUploading] = useState(false);

  const { data: attachments = [] } = useQuery({
    queryKey: ["partner_attachments", partnerId],
    queryFn: () => listFn({ data: { partnerId } }),
  });

  const onFile = async (file: File) => {
    if (file.size > 20 * 1024 * 1024) { toast.error("Max 20MB"); return; }
    setUploading(true);
    try {
      const buf = await file.arrayBuffer();
      let binary = "";
      const bytes = new Uint8Array(buf);
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
      const contentBase64 = btoa(binary);
      await uploadFn({ data: { partnerId, docType, fileName: file.name, mimeType: file.type || null, fileSize: file.size, contentBase64 } });
      toast.success(t("common.saved"));
      qc.invalidateQueries({ queryKey: ["partner_attachments", partnerId] });
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setUploading(false);
    }
  };

  const onDownload = async (id: string) => {
    try {
      const { url, fileName } = await urlFn({ data: { id } });
      const a = document.createElement("a");
      a.href = url; a.download = fileName; a.target = "_blank"; a.rel = "noopener";
      document.body.appendChild(a); a.click(); a.remove();
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const onDelete = async (id: string) => {
    try {
      await deleteFn({ data: { id } });
      qc.invalidateQueries({ queryKey: ["partner_attachments", partnerId] });
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-end gap-2">
        <div className="flex-1">
          <Label className="text-xs">{t("customers.attachments")}</Label>
          <Select value={docType} onValueChange={(v) => setDocType(v as DocType)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {DOC_TYPES.map((d) => <SelectItem key={d} value={d}>{t(`customers.doc_${d}`)}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <label className="cursor-pointer">
          <input type="file" className="hidden" disabled={uploading} onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }} />
          <span className="inline-flex items-center gap-1 h-9 px-3 rounded-md border bg-background text-sm hover:bg-muted">
            <Upload className="h-4 w-4" />{uploading ? "…" : t("customers.uploadFile")}
          </span>
        </label>
      </div>
      <div className="space-y-1">
        {(attachments as any[]).length === 0 ? (
          <p className="text-xs text-muted-foreground">{t("common.noData")}</p>
        ) : (
          (attachments as any[]).map((a) => (
            <div key={a.id} className="flex items-center gap-2 p-2 rounded border text-sm">
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs text-muted-foreground w-32 shrink-0">{t(`customers.doc_${a.doc_type as DocType}`)}</span>
              <span className="flex-1 truncate" title={a.file_name}>{a.file_name}</span>
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => onDownload(a.id)}><Download className="h-3.5 w-3.5" /></Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => onDelete(a.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
