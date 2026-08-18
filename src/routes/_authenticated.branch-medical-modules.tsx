import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, useLocalized } from "@/i18n";
import { useNavGroups } from "@/lib/nav-config";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Building2, MapPin } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/branch-medical-modules")({
  component: Page,
});

type Branch = {
  id: string;
  code: string;
  name_ar: string;
  name_en: string;
  company_id: string;
};

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();
  const groups = useNavGroups();

  // Reuse the exact same 5 medical sub-modules (label/icon/hue) already
  // defined for Medical App, so this admin screen never drifts out of
  // sync with what actually exists in the product.
  const medicalModules = groups.find((g) => g.key === "his")?.subgroups ?? [];

  const { data: branches } = useQuery({
    queryKey: ["branches_for_medical_modules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branches")
        .select("id, code, name_ar, name_en, company_id")
        .order("code");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const { data: enabledMap } = useQuery({
    queryKey: ["branch_medical_modules_all"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_medical_modules")
        .select("branch_id, module_key, is_enabled");
      if (error) throw error;
      const map = new Map<string, boolean>();
      for (const row of data as any[]) {
        map.set(`${row.branch_id}:${row.module_key}`, row.is_enabled);
      }
      return map;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ branchId, moduleKey, enabled }: { branchId: string; moduleKey: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("branch_medical_modules")
        .upsert(
          { branch_id: branchId, module_key: moduleKey, is_enabled: enabled },
          { onConflict: "branch_id,module_key" }
        );
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branch_medical_modules_all"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Building2 className="h-5 w-5 text-muted-foreground" />
          {t("nav.branchMedicalModules")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("common.chooseModuleToStart")}</p>
      </div>

      <div className="space-y-3">
        {(branches ?? []).map((branch) => (
          <Card key={branch.id} className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <MapPin className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold">{localized(branch, "name")}</span>
              <span className="text-xs text-muted-foreground">({branch.code})</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {medicalModules.map((mod) => {
                const isEnabled = enabledMap?.get(`${branch.id}:${mod.key}`) ?? false;
                return (
                  <label
                    key={mod.key}
                    className="flex items-center gap-2 rounded-lg border p-2.5 cursor-pointer hover:bg-accent/40 transition-colors"
                  >
                    <mod.icon className="h-4 w-4 shrink-0" style={{ color: `hsl(${mod.hue ?? 200} 70% 45%)` }} />
                    <span className="flex-1 text-[13px] font-medium truncate">{mod.label}</span>
                    <Switch
                      checked={isEnabled}
                      onCheckedChange={(checked) =>
                        toggle.mutate({ branchId: branch.id, moduleKey: mod.key!, enabled: checked })
                      }
                    />
                  </label>
                );
              })}
            </div>
          </Card>
        ))}

        {branches?.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">—</p>
        )}
      </div>
    </div>
  );
}
