import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import {
  listPartnerAttachments, uploadPartnerAttachment, deletePartnerAttachment, getPartnerAttachmentUrl,
  listPartnerBankAccounts, savePartnerBankAccounts, uploadBankAccountIban, getBankAccountIbanUrl,
} from "@/lib/api/accounting.functions";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Download, Paperclip, Plus, Trash2, Upload, X } from "lucide-react";
import { toast } from "sonner";

export const DOC_TYPES = ["cr", "vat", "national_address", "contract", "other"] as const;
export type DocType = (typeof DOC_TYPES)[number];

/* ============================== Bank Accounts ============================== */

export function PartnerBankAccounts({ partnerId }: { partnerId: string }) {
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

/* ============================== Attachments ============================== */

export function PartnerAttachments({ partnerId }: { partnerId: string }) {
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
