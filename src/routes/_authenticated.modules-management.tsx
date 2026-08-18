import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, useLocalized } from "@/i18n";
import { useNavGroups } from "@/lib/nav-config";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Blocks, MapPin } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/modules-management")({
  component: Page,
});

type Branch = { id: string; code: string; name_ar: string; name_en: string };

function Page() {
  const { t } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();
  const groups = useNavGroups(); // unfiltered — admin needs to see + toggle everything

  // Main Dashboard has no `key` by design (always visible to everyone) —
  // it's the only module that never appears here.
  const toggleableGroups = groups.filter((g) => !!g.key);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches_for_modules_management"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, code, name_ar, name_en").order("code");
      if (error) throw error;
      return data as Branch[];
    },
  });

  const [branchId, setBranchId] = useState("");
  const activeBranchId = branchId || branches[0]?.id || "";

  const { data: enabledMap } = useQuery({
    queryKey: ["branch_module_access", "admin", activeBranchId],
    enabled: !!activeBranchId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("branch_module_access")
        .select("module_key, is_enabled")
        .eq("branch_id", activeBranchId);
      if (error) throw error;
      const map = new Map<string, boolean>();
      for (const row of data as any[]) map.set(row.module_key, row.is_enabled);
      return map;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ moduleKey, enabled }: { moduleKey: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("branch_module_access")
        .upsert({ branch_id: activeBranchId, module_key: moduleKey, is_enabled: enabled }, { onConflict: "branch_id,module_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branch_module_access"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  // Not-yet-configured = visible in the app (fail-open), so the switch
  // should default to "on" until an admin explicitly turns it off.
  const isOn = (key: string) => enabledMap?.get(key) ?? true;

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl font-bold flex items-center gap-2">
            <Blocks className="h-5 w-5 text-muted-foreground" />
            {t("nav.modulesManagement")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">{t("common.modulesManagementSubtitle")}</p>
        </div>
        <div className="w-64">
          <Select value={activeBranchId} onValueChange={setBranchId}>
            <SelectTrigger>
              <SelectValue placeholder={t("common.selectBranch")} />
            </SelectTrigger>
            <SelectContent>
              {branches.map((b) => (
                <SelectItem key={b.id} value={b.id}>
                  <span className="flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    {localized(b, "name")} ({b.code})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3">
        {toggleableGroups.map((g) => (
          <Card key={g.key} className="p-4">
            <div className="flex items-center gap-3">
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `hsl(${g.hue} 70% 45% / 0.15)` }}
              >
                <g.icon className="h-[18px] w-[18px]" style={{ color: `hsl(${g.hue} 70% 40%)` }} />
              </div>
              <span className="flex-1 font-semibold">{g.label}</span>
              <Switch checked={isOn(g.key!)} onCheckedChange={(checked) => toggle.mutate({ moduleKey: g.key!, enabled: checked })} />
            </div>

            {g.subgroups && g.subgroups.length > 0 && (
              <div className="mt-3 ms-6 ps-4 border-s space-y-1">
                {g.subgroups.map((sg) =>
                  sg.key ? (
                    <div key={sg.key} className="flex items-center gap-2.5 rounded-md p-2 hover:bg-accent/30 transition-colors">
                      <sg.icon className="h-4 w-4 shrink-0" style={{ color: `hsl(${sg.hue ?? g.hue} 70% 45%)` }} />
                      <span className="flex-1 text-[13.5px] font-medium">{sg.label}</span>
                      <Switch checked={isOn(sg.key)} onCheckedChange={(checked) => toggle.mutate({ moduleKey: sg.key!, enabled: checked })} />
                    </div>
                  ) : null
                )}
              </div>
            )}
          </Card>
        ))}
      </div>
    </div>
  );
}
