import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, useLocalized } from "@/i18n";
import { useNavGroups } from "@/lib/nav-config";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Blocks, MapPin, ChevronDown, ChevronUp } from "lucide-react";
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

  const toggleableGroups = groups.filter((g) => !!g.key);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches_for_modules_management"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, code, name_ar, name_en").order("code");
      if (error) throw error;
      return data as Branch[];
    },
  });

  // One query for EVERY (branch, module) row across the whole company —
  // we only need the ones explicitly turned OFF, since anything not
  // configured is enabled by default (fail-open).
  const { data: disabledMap } = useQuery({
    queryKey: ["branch_module_access", "admin_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branch_module_access").select("branch_id, module_key, is_enabled");
      if (error) throw error;
      const map = new Map<string, Set<string>>(); // module_key -> Set<branch_id explicitly disabled>
      for (const row of data as any[]) {
        if (row.is_enabled) continue;
        if (!map.has(row.module_key)) map.set(row.module_key, new Set());
        map.get(row.module_key)!.add(row.branch_id);
      }
      return map;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ branchId, moduleKey, enabled }: { branchId: string; moduleKey: string; enabled: boolean }) => {
      const { error } = await supabase
        .from("branch_module_access")
        .upsert({ branch_id: branchId, module_key: moduleKey, is_enabled: enabled }, { onConflict: "branch_id,module_key" });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["branch_module_access"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const isOn = (moduleKey: string, branchId: string) => !disabledMap?.get(moduleKey)?.has(branchId);
  // A sub-module only counts as "on" for a branch when its parent module
  // is ALSO on there — if the main module is closed at a branch, its
  // sub-modules are naturally out of the picture for that branch too.
  const isEffectivelyOn = (moduleKey: string, branchId: string, parentKey?: string) =>
    isOn(moduleKey, branchId) && (!parentKey || isOn(parentKey, branchId));
  const enabledCount = (moduleKey: string, parentKey?: string) =>
    branches.filter((b) => isEffectivelyOn(moduleKey, b.id, parentKey)).length;

  // ===== Reordering — writes a fresh sort_order for every sibling at
  // once, so the order is fully explicit and stays stable for everyone. =====
  const reorder = useMutation({
    mutationFn: async ({ orderedKeys, parentKey }: { orderedKeys: string[]; parentKey: string | null }) => {
      for (let i = 0; i < orderedKeys.length; i++) {
        const { error } = await supabase
          .from("module_sort_order")
          .upsert({ module_key: orderedKeys[i], parent_key: parentKey, sort_order: i }, { onConflict: "module_key" });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["module_sort_order"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const moveGroup = (index: number, dir: -1 | 1) => {
    const to = index + dir;
    if (to < 0 || to >= toggleableGroups.length) return;
    const keys = toggleableGroups.map((g) => g.key!);
    const arr = keys.slice();
    [arr[index], arr[to]] = [arr[to], arr[index]];
    reorder.mutate({ orderedKeys: arr, parentKey: null });
  };

  const moveSubgroup = (group: (typeof toggleableGroups)[number], index: number, dir: -1 | 1) => {
    const subs = group.subgroups!;
    const to = index + dir;
    if (to < 0 || to >= subs.length) return;
    const keys = subs.map((sg) => sg.key!);
    const arr = keys.slice();
    [arr[index], arr[to]] = [arr[to], arr[index]];
    reorder.mutate({ orderedKeys: arr, parentKey: group.key! });
  };

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Blocks className="h-5 w-5 text-muted-foreground" />
          {t("nav.modulesManagement")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("common.modulesManagementSubtitle")}</p>
      </div>

      <div className="space-y-3">
        {toggleableGroups.map((g, gIndex) => (
          <Card key={g.key} className="p-4">
            <div className="flex items-center gap-3">
              <div className="flex flex-col shrink-0">
                <Button variant="ghost" size="icon" className="h-5 w-5" disabled={gIndex <= 0} onClick={() => moveGroup(gIndex, -1)} title={t("common.moveUp")}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" disabled={gIndex >= toggleableGroups.length - 1} onClick={() => moveGroup(gIndex, 1)} title={t("common.moveDown")}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `hsl(${g.hue} 70% 45% / 0.15)` }}>
                <g.icon className="h-[18px] w-[18px]" style={{ color: `hsl(${g.hue} 70% 40%)` }} />
              </div>
              <span className="flex-1 font-semibold">{g.label}</span>
              <BranchPicker moduleKey={g.key!} branches={branches} isOn={isOn} enabledCount={enabledCount(g.key!)} toggle={toggle} t={t} localized={localized} />
            </div>

            {g.subgroups && g.subgroups.length > 0 && (
              <div className="mt-3 ms-6 ps-4 border-s space-y-1">
                {g.subgroups.map((sg, sgIndex) =>
                  sg.key ? (
                    <div key={sg.key} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent/30 transition-colors">
                      <div className="flex flex-col shrink-0">
                        <Button variant="ghost" size="icon" className="h-4 w-4" disabled={sgIndex <= 0} onClick={() => moveSubgroup(g, sgIndex, -1)} title={t("common.moveUp")}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-4 w-4" disabled={sgIndex >= g.subgroups!.length - 1} onClick={() => moveSubgroup(g, sgIndex, 1)} title={t("common.moveDown")}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                      <sg.icon className="h-4 w-4 shrink-0" style={{ color: `hsl(${sg.hue ?? g.hue} 70% 45%)` }} />
                      <span className="flex-1 text-[13.5px] font-medium">{sg.label}</span>
                      <BranchPicker
                        moduleKey={sg.key}
                        parentKey={g.key}
                        parentLabel={g.label}
                        branches={branches}
                        isOn={isOn}
                        enabledCount={enabledCount(sg.key, g.key)}
                        toggle={toggle}
                        t={t}
                        localized={localized}
                      />
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

function BranchPicker({
  moduleKey,
  parentKey,
  parentLabel,
  branches,
  isOn,
  enabledCount,
  toggle,
  t,
  localized,
}: {
  moduleKey: string;
  parentKey?: string;
  parentLabel?: string;
  branches: Branch[];
  isOn: (moduleKey: string, branchId: string) => boolean;
  enabledCount: number;
  toggle: ReturnType<typeof useMutation<void, Error, { branchId: string; moduleKey: string; enabled: boolean }>>;
  t: (k: string) => string;
  localized: (row: any, base: string) => string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <MapPin className="h-3.5 w-3.5" />
          {enabledCount}/{branches.length}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <p className="text-xs font-semibold text-muted-foreground px-1.5 pb-1.5">{t("common.selectBranch")}</p>
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {branches.map((b) => {
            const parentOn = !parentKey || isOn(parentKey, b.id);
            const checked = isOn(moduleKey, b.id) && parentOn;
            return (
              <label
                key={b.id}
                className={
                  "flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors " +
                  (parentOn ? "cursor-pointer hover:bg-accent/40" : "cursor-not-allowed opacity-40")
                }
                title={!parentOn ? `${t("common.enableParentFirst")} (${parentLabel})` : undefined}
              >
                <Checkbox
                  checked={checked}
                  disabled={!parentOn}
                  onCheckedChange={(v) => {
                    if (!parentOn) return;
                    toggle.mutate({ branchId: b.id, moduleKey, enabled: v === true });
                  }}
                />
                <span className="flex-1 text-[13px]">{localized(b, "name")}</span>
                <span className="text-[10.5px] text-muted-foreground font-mono">{b.code}</span>
              </label>
            );
          })}
          {branches.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t("common.noData")}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
