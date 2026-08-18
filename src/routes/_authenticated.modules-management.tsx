import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, useLocalized } from "@/i18n";
import { useNavGroups, type NavGroup } from "@/lib/nav-config";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Blocks, MapPin, Users2, ChevronDown, ChevronUp } from "lucide-react";
import { toast } from "sonner";
import type { ReactNode } from "react";

export const Route = createFileRoute("/_authenticated/modules-management")({
  component: Page,
});

type Entity = { id: string; label: string; sub?: string; hue?: number };

function Page() {
  const { t } = useI18n();

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-xl font-bold flex items-center gap-2">
          <Blocks className="h-5 w-5 text-muted-foreground" />
          {t("nav.modulesManagement")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("common.modulesManagementSubtitle")}</p>
      </div>

      <Tabs defaultValue="branches">
        <TabsList>
          <TabsTrigger value="branches">
            <MapPin className="h-4 w-4 me-2" />
            {t("common.modulesAndBranches")}
          </TabsTrigger>
          <TabsTrigger value="groups">
            <Users2 className="h-4 w-4 me-2" />
            {t("common.modulesAndUserGroups")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branches" className="mt-4">
          <ModulesAndBranches />
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <ModulesAndUserGroups />
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ============================================================
 * Shared tree layout — renders every module + sub-module once,
 * delegating the actual "who has access" control to renderPicker.
 * ============================================================ */
function ModuleTree({
  groups,
  showReorder,
  moveGroup,
  moveSubgroup,
  renderPicker,
}: {
  groups: NavGroup[];
  showReorder: boolean;
  moveGroup?: (index: number, dir: -1 | 1) => void;
  moveSubgroup?: (group: NavGroup, index: number, dir: -1 | 1) => void;
  renderPicker: (moduleKey: string, parentKey?: string, parentLabel?: string) => ReactNode;
}) {
  const { t } = useI18n();
  return (
    <div className="space-y-3">
      {groups.map((g, gIndex) => (
        <Card key={g.key} className="p-4">
          <div className="flex items-center gap-3">
            {showReorder && (
              <div className="flex flex-col shrink-0">
                <Button variant="ghost" size="icon" className="h-5 w-5" disabled={gIndex <= 0} onClick={() => moveGroup?.(gIndex, -1)} title={t("common.moveUp")}>
                  <ChevronUp className="h-3.5 w-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-5 w-5" disabled={gIndex >= groups.length - 1} onClick={() => moveGroup?.(gIndex, 1)} title={t("common.moveDown")}>
                  <ChevronDown className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `hsl(${g.hue} 70% 45% / 0.15)` }}>
              <g.icon className="h-[18px] w-[18px]" style={{ color: `hsl(${g.hue} 70% 40%)` }} />
            </div>
            <span className="flex-1 font-semibold">{g.label}</span>
            {renderPicker(g.key!)}
          </div>

          {g.subgroups && g.subgroups.length > 0 && (
            <div className="mt-3 ms-6 ps-4 border-s space-y-1">
              {g.subgroups.map((sg, sgIndex) =>
                sg.key ? (
                  <div key={sg.key} className="flex items-center gap-2 rounded-md p-2 hover:bg-accent/30 transition-colors">
                    {showReorder && (
                      <div className="flex flex-col shrink-0">
                        <Button variant="ghost" size="icon" className="h-4 w-4" disabled={sgIndex <= 0} onClick={() => moveSubgroup?.(g, sgIndex, -1)} title={t("common.moveUp")}>
                          <ChevronUp className="h-3 w-3" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-4 w-4" disabled={sgIndex >= g.subgroups!.length - 1} onClick={() => moveSubgroup?.(g, sgIndex, 1)} title={t("common.moveDown")}>
                          <ChevronDown className="h-3 w-3" />
                        </Button>
                      </div>
                    )}
                    <sg.icon className="h-4 w-4 shrink-0" style={{ color: `hsl(${sg.hue ?? g.hue} 70% 45%)` }} />
                    <span className="flex-1 text-[13.5px] font-medium">{sg.label}</span>
                    {renderPicker(sg.key, g.key, g.label)}
                  </div>
                ) : null
              )}
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

/* ============================================================
 * Generic multi-select popover — same UI for "which branches"
 * and "which user groups" have a module.
 * ============================================================ */
function EntityPicker({
  entities,
  isChecked,
  onToggle,
  enabledCount,
  isParentOn,
  parentLabel,
  icon,
}: {
  entities: Entity[];
  isChecked: (id: string) => boolean;
  onToggle: (id: string, checked: boolean) => void;
  enabledCount: number;
  isParentOn?: (id: string) => boolean;
  parentLabel?: string;
  icon: ReactNode;
}) {
  const { t } = useI18n();
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          {icon}
          {enabledCount}/{entities.length}
          <ChevronDown className="h-3.5 w-3.5 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {entities.map((e) => {
            const parentOn = isParentOn ? isParentOn(e.id) : true;
            const checked = isChecked(e.id) && parentOn;
            return (
              <label
                key={e.id}
                className={
                  "flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors " +
                  (parentOn ? "cursor-pointer hover:bg-accent/40" : "cursor-not-allowed opacity-40")
                }
                title={!parentOn ? `${t("common.enableParentFirst")} (${parentLabel})` : undefined}
              >
                <Checkbox checked={checked} disabled={!parentOn} onCheckedChange={(v) => parentOn && onToggle(e.id, v === true)} />
                <span className="flex-1 text-[13px]">{e.label}</span>
                {e.sub && <span className="text-[10.5px] text-muted-foreground font-mono">{e.sub}</span>}
              </label>
            );
          })}
          {entities.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">{t("common.noData")}</p>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

/* ============================================================
 * Tab 1: Modules & Branches (also owns the global reorder controls)
 * ============================================================ */
function ModulesAndBranches() {
  const qc = useQueryClient();
  const groups = useNavGroups();
  const toggleableGroups = groups.filter((g) => !!g.key);

  const { data: branches = [] } = useQuery({
    queryKey: ["branches_for_modules_management"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branches").select("id, code, name_ar, name_en").order("code");
      if (error) throw error;
      return data;
    },
  });
  const localized = useLocalized();
  const branchEntities: Entity[] = branches.map((b: any) => ({ id: b.id, label: localized(b, "name"), sub: b.code }));

  const { data: disabledMap } = useQuery({
    queryKey: ["branch_module_access", "admin_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("branch_module_access").select("branch_id, module_key, is_enabled");
      if (error) throw error;
      const map = new Map<string, Set<string>>();
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
  const isEffectivelyOn = (moduleKey: string, branchId: string, parentKey?: string) =>
    isOn(moduleKey, branchId) && (!parentKey || isOn(parentKey, branchId));
  const enabledCount = (moduleKey: string, parentKey?: string) =>
    branches.filter((b: any) => isEffectivelyOn(moduleKey, b.id, parentKey)).length;

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
  const moveSubgroup = (group: NavGroup, index: number, dir: -1 | 1) => {
    const subs = group.subgroups!;
    const to = index + dir;
    if (to < 0 || to >= subs.length) return;
    const keys = subs.map((sg) => sg.key!);
    const arr = keys.slice();
    [arr[index], arr[to]] = [arr[to], arr[index]];
    reorder.mutate({ orderedKeys: arr, parentKey: group.key! });
  };

  return (
    <ModuleTree
      groups={toggleableGroups}
      showReorder
      moveGroup={moveGroup}
      moveSubgroup={moveSubgroup}
      renderPicker={(moduleKey, parentKey, parentLabel) => (
        <EntityPicker
          entities={branchEntities}
          isChecked={(id) => isOn(moduleKey, id)}
          onToggle={(id, checked) => toggle.mutate({ branchId: id, moduleKey, enabled: checked })}
          enabledCount={enabledCount(moduleKey, parentKey)}
          isParentOn={parentKey ? (id) => isOn(parentKey, id) : undefined}
          parentLabel={parentLabel}
          icon={<MapPin className="h-3.5 w-3.5" />}
        />
      )}
    />
  );
}

/* ============================================================
 * Tab 2: Modules & User Groups
 * ============================================================ */
function ModulesAndUserGroups() {
  const { t } = useI18n();
  const qc = useQueryClient();
  const groups = useNavGroups();
  const toggleableGroups = groups.filter((g) => !!g.key);
  const localized = useLocalized();

  const { data: userGroups = [] } = useQuery({
    queryKey: ["user_groups_for_modules_management"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_groups").select("id, name_ar, name_en, hue").order("name_en");
      if (error) throw error;
      return data;
    },
  });
  const groupEntities: Entity[] = userGroups.map((g: any) => ({ id: g.id, label: localized(g, "name") }));

  const { data: enabledMap } = useQuery({
    queryKey: ["user_group_modules_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_group_modules").select("group_id, module_key");
      if (error) throw error;
      const map = new Map<string, Set<string>>(); // module_key -> Set<group_id enabled>
      for (const row of data as any[]) {
        if (!map.has(row.module_key)) map.set(row.module_key, new Set());
        map.get(row.module_key)!.add(row.group_id);
      }
      return map;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ groupId, moduleKey, enabled }: { groupId: string; moduleKey: string; enabled: boolean }) => {
      if (enabled) {
        const { error } = await supabase.from("user_group_modules").upsert({ group_id: groupId, module_key: moduleKey }, { onConflict: "group_id,module_key" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_group_modules").delete().eq("group_id", groupId).eq("module_key", moduleKey);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["user_group_modules_all"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const isOn = (moduleKey: string, groupId: string) => !!enabledMap?.get(moduleKey)?.has(groupId);
  // Same rule as branches: a sub-module can only be granted to a group
  // that ALSO has the parent module — keeps the two tabs consistent.
  const isEffectivelyOn = (moduleKey: string, groupId: string, parentKey?: string) =>
    isOn(moduleKey, groupId) && (!parentKey || isOn(parentKey, groupId));
  const enabledCount = (moduleKey: string, parentKey?: string) =>
    userGroups.filter((g: any) => isEffectivelyOn(moduleKey, g.id, parentKey)).length;

  if (userGroups.length === 0) {
    return <p className="text-sm text-muted-foreground text-center py-10">{t("common.noUserGroupsYet")}</p>;
  }

  return (
    <ModuleTree
      groups={toggleableGroups}
      showReorder={false}
      renderPicker={(moduleKey, parentKey, parentLabel) => (
        <EntityPicker
          entities={groupEntities}
          isChecked={(id) => isOn(moduleKey, id)}
          onToggle={(id, checked) => toggle.mutate({ groupId: id, moduleKey, enabled: checked })}
          enabledCount={enabledCount(moduleKey, parentKey)}
          isParentOn={parentKey ? (id) => isOn(parentKey, id) : undefined}
          parentLabel={parentLabel}
          icon={<Users2 className="h-3.5 w-3.5" />}
        />
      )}
    />
  );
}
