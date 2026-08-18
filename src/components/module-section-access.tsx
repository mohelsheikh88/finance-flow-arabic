import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { userDisplayLabel } from "@/lib/user-display";
import type { NavSubgroup } from "@/lib/nav-config";

/**
 * Fine-grained, per-section access control lived INSIDE a module's own
 * Configuration screen (not a separate global admin page): granting a
 * user the module itself (in Users → Allowed Modules) only shows them
 * the module's own empty icon/shell. Which of the module's sections
 * (Reports, Receivables, Banks...) they can actually open is decided
 * here — by the people who manage that module day to day.
 *
 * Fully generic: pass any module's key + subgroup list and this renders
 * the same professional picker UI. Reused verbatim across modules.
 */
export function ModuleSectionAccessManagement({
  moduleKey,
  sections,
}: {
  moduleKey: string;
  sections: NavSubgroup[];
}) {
  const { t, locale } = useI18n();
  const qc = useQueryClient();

  // Only users who already have this module (top-level) are realistic
  // candidates — without that, no section would be reachable anyway.
  const { data: candidates = [] } = useQuery({
    queryKey: ["module_section_access_candidates", moduleKey],
    queryFn: async () => {
      const { data: grants, error: ge } = await supabase
        .from("user_module_access")
        .select("user_id")
        .eq("module_key", moduleKey);
      if (ge) throw ge;
      const userIds = Array.from(new Set((grants ?? []).map((r: any) => r.user_id as string)));
      if (userIds.length === 0) return [];
      const { data: profs, error: pe } = await supabase
        .from("profiles")
        .select("id, employee_id, display_name_ar, display_name_en")
        .in("id", userIds);
      if (pe) throw pe;
      return profs ?? [];
    },
  });

  const { data: grantedMap } = useQuery({
    queryKey: ["module_section_access_grants", moduleKey],
    queryFn: async () => {
      const sectionKeys = sections.map((s) => s.key).filter(Boolean) as string[];
      if (sectionKeys.length === 0) return new Map<string, Set<string>>();
      const { data, error } = await supabase
        .from("user_module_access")
        .select("user_id, module_key")
        .in("module_key", sectionKeys);
      if (error) throw error;
      const map = new Map<string, Set<string>>(); // section key -> Set<user_id>
      for (const row of data as any[]) {
        if (!map.has(row.module_key)) map.set(row.module_key, new Set());
        map.get(row.module_key)!.add(row.user_id);
      }
      return map;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({ userId, sectionKey, granted }: { userId: string; sectionKey: string; granted: boolean }) => {
      if (granted) {
        const { error } = await supabase
          .from("user_module_access")
          .upsert({ user_id: userId, module_key: sectionKey }, { onConflict: "user_id,module_key" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_module_access").delete().eq("user_id", userId).eq("module_key", sectionKey);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["module_section_access_grants", moduleKey] });
      qc.invalidateQueries({ queryKey: ["my_module_access"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isGranted = (sectionKey: string, userId: string) => !!grantedMap?.get(sectionKey)?.has(userId);
  const grantedCount = (sectionKey: string) => candidates.filter((c: any) => isGranted(sectionKey, c.id)).length;

  if (candidates.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        {t("common.noCandidatesForSectionAccess")}
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {sections.map((sg) =>
        sg.key ? (
          <Card key={sg.key} className="p-3.5 flex items-center gap-3">
            <div
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
              style={{ background: `hsl(${sg.hue ?? 210} 70% 45% / 0.15)` }}
            >
              <sg.icon className="h-[18px] w-[18px]" style={{ color: `hsl(${sg.hue ?? 210} 70% 40%)` }} />
            </div>
            <span className="flex-1 font-medium text-sm">{sg.label}</span>

            <Popover>
              <PopoverTrigger asChild>
                <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
                  <Users2 className="h-3.5 w-3.5" />
                  {grantedCount(sg.key)}/{candidates.length}
                  <ChevronDown className="h-3.5 w-3.5 opacity-60" />
                </Button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-64 p-2">
                <div className="max-h-64 overflow-y-auto space-y-0.5">
                  {candidates.map((c: any) => (
                    <label
                      key={c.id}
                      className="flex items-center gap-2 rounded-md px-1.5 py-1.5 cursor-pointer hover:bg-accent/40 transition-colors"
                    >
                      <Checkbox
                        checked={isGranted(sg.key!, c.id)}
                        onCheckedChange={(v) => toggle.mutate({ userId: c.id, sectionKey: sg.key!, granted: v === true })}
                      />
                      <span className="flex-1 text-[13px]">{userDisplayLabel(c, locale)}</span>
                    </label>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </Card>
        ) : null
      )}
    </div>
  );
}
