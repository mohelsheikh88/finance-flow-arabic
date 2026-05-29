import { useRef } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Paperclip, Upload, Trash2, Download, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useI18n } from "@/i18n";
import {
  listAttachments,
  addAttachment,
  deleteAttachment,
  getAttachmentUrl,
} from "@/lib/api/attachments.functions";

type Props = {
  transactionType: "invoice" | "payment" | "journal_entry" | "asset" | "asset_disposal";
  transactionId: string;
  companyId: string;
  branchId: string;
};

function humanSize(n?: number | null) {
  if (!n) return "";
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

export function TransactionAttachments({ transactionType, transactionId, companyId, branchId }: Props) {
  const { t } = useI18n();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const listFn = useServerFn(listAttachments);
  const addFn = useServerFn(addAttachment);
  const delFn = useServerFn(deleteAttachment);
  const urlFn = useServerFn(getAttachmentUrl);

  const queryKey = ["attachments", transactionType, transactionId];

  const { data: files = [] } = useQuery({
    queryKey,
    queryFn: () => listFn({ data: { transactionType, transactionId } }),
    enabled: !!transactionId,
  });

  const uploadMut = useMutation({
    mutationFn: async (file: File) => {
      const safe = file.name.replace(/[^\w.\-]/g, "_");
      const path = `${branchId}/${transactionType}/${transactionId}/${Date.now()}-${safe}`;
      const { error: upErr } = await supabase.storage
        .from("transaction-attachments")
        .upload(path, file, { contentType: file.type, upsert: false });
      if (upErr) throw new Error(upErr.message);
      await addFn({
        data: {
          company_id: companyId,
          branch_id: branchId,
          transaction_type: transactionType,
          transaction_id: transactionId,
          file_path: path,
          file_name: file.name,
          mime_type: file.type || null,
          file_size: file.size,
        },
      });
    },
    onSuccess: () => {
      toast.success(t("attachments.uploaded") || "تم رفع المرفق");
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const delMut = useMutation({
    mutationFn: (id: string) => delFn({ data: { id } }),
    onSuccess: () => {
      toast.success(t("common.deleted"));
      qc.invalidateQueries({ queryKey });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openFile = async (file_path: string) => {
    try {
      const { url } = await urlFn({ data: { file_path } });
      window.open(url, "_blank", "noopener,noreferrer");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <div className="border rounded-lg p-3 bg-muted/20">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Paperclip className="h-4 w-4 text-primary" />
          <span>{t("attachments.title") || "المرفقات"}</span>
          <span className="text-[11px] text-muted-foreground font-normal">({files.length})</span>
        </div>
        <Button
          size="sm"
          variant="outline"
          className="h-8"
          onClick={() => inputRef.current?.click()}
          disabled={uploadMut.isPending}
        >
          {uploadMut.isPending ? (
            <Loader2 className="h-3.5 w-3.5 me-1 animate-spin" />
          ) : (
            <Upload className="h-3.5 w-3.5 me-1" />
          )}
          {t("attachments.upload") || "رفع ملف"}
        </Button>
        <input
          ref={inputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) uploadMut.mutate(f);
            e.currentTarget.value = "";
          }}
        />
      </div>

      {files.length === 0 ? (
        <div className="text-[11px] text-muted-foreground text-center py-3">
          {t("attachments.empty") || "لا توجد مرفقات بعد"}
        </div>
      ) : (
        <ul className="space-y-1">
          {files.map((f: any) => (
            <li
              key={f.id}
              className="flex items-center gap-2 text-xs bg-background border rounded px-2 py-1.5"
            >
              <Paperclip className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <button
                onClick={() => openFile(f.file_path)}
                className="flex-1 text-start font-medium hover:text-primary truncate"
                title={f.file_name}
              >
                {f.file_name}
              </button>
              <span className="text-[10px] text-muted-foreground font-mono">{humanSize(f.file_size)}</span>
              <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openFile(f.file_path)}>
                <Download className="h-3 w-3" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-6 w-6 text-destructive"
                onClick={() => {
                  if (window.confirm(t("attachments.deleteConfirm") || "حذف المرفق؟")) delMut.mutate(f.id);
                }}
                disabled={delMut.isPending}
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
