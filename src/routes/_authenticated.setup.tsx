import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { createCompanyWithSetup } from "@/lib/api/setup.functions";
import { useI18n } from "@/i18n";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/setup")({
  component: SetupPage,
});

function SetupPage() {
  const { t } = useI18n();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const create = useServerFn(createCompanyWithSetup);

  const [form, setForm] = useState({
    code: "MAIN",
    name_ar: "",
    name_en: "",
    vat_number: "",
    cr_number: "",
    address_ar: "",
    phone: "",
    email: "",
    branch_code: "HQ",
    branch_name_ar: "الفرع الرئيسي",
    branch_name_en: "Head Office",
    seedDefaults: true,
  });

  const mutation = useMutation({
    mutationFn: (input: typeof form) => create({ data: { ...input, default_currency: "SAR" } }),
    onSuccess: () => {
      toast.success(t("setup.done"));
      qc.invalidateQueries();
      navigate({ to: "/apps" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const upd = (k: string) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="page-title">{t("setup.title")}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t("setup.subtitle")}</p>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          mutation.mutate(form);
        }}
        className="space-y-4"
      >
        <Card>
          <CardHeader><CardTitle className="text-base">{t("setup.companyInfo")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Field label={t("common.code")} value={form.code} onChange={upd("code")} required />
            <div />
            <Field label={t("common.nameAr")} value={form.name_ar} onChange={upd("name_ar")} required />
            <Field label={t("common.nameEn")} value={form.name_en} onChange={upd("name_en")} required dir="ltr" />
            <Field label={t("setup.vatNumber")} value={form.vat_number} onChange={upd("vat_number")} dir="ltr" />
            <Field label={t("setup.crNumber")} value={form.cr_number} onChange={upd("cr_number")} dir="ltr" />
            <Field label="Email" value={form.email} onChange={upd("email")} dir="ltr" type="email" />
            <Field label="Phone" value={form.phone} onChange={upd("phone")} dir="ltr" />
            <div className="md:col-span-2">
              <Field label={t("setup.address")} value={form.address_ar} onChange={upd("address_ar")} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">{t("setup.branchInfo")}</CardTitle></CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Field label={t("common.code")} value={form.branch_code} onChange={upd("branch_code")} required />
            <Field label={t("common.nameAr")} value={form.branch_name_ar} onChange={upd("branch_name_ar")} required />
            <Field label={t("common.nameEn")} value={form.branch_name_en} onChange={upd("branch_name_en")} required dir="ltr" />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 flex items-center gap-3">
            <Checkbox
              id="seed"
              checked={form.seedDefaults}
              onCheckedChange={(v) => setForm((f) => ({ ...f, seedDefaults: !!v }))}
            />
            <Label htmlFor="seed" className="text-sm cursor-pointer">{t("setup.seedData")}</Label>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-2">
          <Button type="submit" size="lg" disabled={mutation.isPending}>
            {mutation.isPending && <Loader2 className="h-4 w-4 me-2 animate-spin" />}
            {t("setup.create")}
          </Button>
        </div>
      </form>
    </div>
  );
}

function Field({
  label, value, onChange, required, dir, type,
}: { label: string; value: string; onChange: (v: string) => void; required?: boolean; dir?: string; type?: string }) {
  return (
    <div>
      <Label className="text-xs">{label}{required && <span className="text-destructive ms-1">*</span>}</Label>
      <Input value={value} onChange={(e) => onChange(e.target.value)} required={required} dir={dir} type={type ?? "text"} className="h-9" />
    </div>
  );
}
