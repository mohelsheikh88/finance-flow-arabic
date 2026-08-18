import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Users2, ChevronDown, ChevronRight, Lock } from "lucide-react";
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
      // One combined set of keys we care about: each section's own key,
      // PLUS every individual screen's URL inside every section — both
      // live in the same table, just as different key strings.
      const allKeys = new Set<string>();
      for (const s of sections) {
        if (s.key) allKeys.add(s.key);
        for (const it of s.items) allKeys.add(it.url);
      }
      const keyList = Array.from(allKeys);
      if (keyList.length === 0) return new Map<string, Set<string>>();
      const { data, error } = await supabase
        .from("user_module_access")
        .select("user_id, module_key")
        .in("module_key", keyList);
      if (error) throw error;
      const map = new Map<string, Set<string>>(); // key (section or screen url) -> Set<user_id>
      for (const row of data as any[]) {
        if (!map.has(row.module_key)) map.set(row.module_key, new Set());
        map.get(row.module_key)!.add(row.user_id);
      }
      return map;
    },
  });

  const toggle = useMutation({
    mutationFn: async ({
      userId,
      sectionKey,
      granted,
      parentSectionKey,
    }: {
      userId: string;
      sectionKey: string;
      granted: boolean;
      /** When granting a single screen, its parent section must come along too — otherwise the section-level check hides it despite the screen being explicitly allowed. */
      parentSectionKey?: string;
    }) => {
      if (granted) {
        const rows = [{ user_id: userId, module_key: sectionKey }];
        if (parentSectionKey && parentSectionKey !== sectionKey) {
          rows.push({ user_id: userId, module_key: parentSectionKey });
        }
        const { error } = await supabase.from("user_module_access").upsert(rows, { onConflict: "user_id,module_key" });
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

  const isGranted = (key: string, userId: string) => !!grantedMap?.get(key)?.has(userId);
  const grantedCount = (key: string) => candidates.filter((c: any) => isGranted(key, c.id)).length;

  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const toggleExpanded = (key: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  if (candidates.length === 0) {
    return (
      <Card className="p-6 text-center text-sm text-muted-foreground">
        {t("common.noCandidatesForSectionAccess")}
      </Card>
    );
  }

  return (
    <div className="space-y-2.5">
      {sections.map((sg) => {
        if (!sg.key) return null;
        const isOpen = expanded.has(sg.key);
        return (
          <Card key={sg.key} className="p-3.5">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => toggleExpanded(sg.key!)}
                className="h-6 w-6 shrink-0 flex items-center justify-center rounded text-muted-foreground hover:bg-accent/40 hover:text-foreground transition-colors"
                title={t("common.showScreens")}
              >
                {isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
              </button>
              <div
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `hsl(${sg.hue ?? 210} 70% 45% / 0.15)` }}
              >
                <sg.icon className="h-[18px] w-[18px]" style={{ color: `hsl(${sg.hue ?? 210} 70% 40%)` }} />
              </div>
              <span className="flex-1 font-medium text-sm">{sg.label}</span>

              <EntityAccessPicker
                candidates={candidates}
                grantedCount={grantedCount(sg.key)}
                isGranted={(userId) => isGranted(sg.key!, userId)}
                onToggle={(userId, granted) => toggle.mutate({ userId, sectionKey: sg.key!, granted })}
                isLocked={(userId) => sg.items.some((it) => isGranted(it.url, userId))}
                lockedHint={t("common.sectionLockedHasScreens")}
                locale={locale}
              />
            </div>

            {isOpen && sg.items.length > 0 && (
              <div className="mt-2.5 ms-9 ps-3 border-s space-y-1.5">
                {sg.items.map((item) => (
                  <div key={item.url} className="flex items-center gap-2.5 py-1">
                    <item.icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    <span className="flex-1 text-[13px]">{item.title}</span>
                    <EntityAccessPicker
                      candidates={candidates}
                      grantedCount={grantedCount(item.url)}
                      isGranted={(userId) => isGranted(item.url, userId)}
                      onToggle={(userId, granted) => toggle.mutate({ userId, sectionKey: item.url, granted, parentSectionKey: sg.key! })}
                      locale={locale}
                      compact
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}

function EntityAccessPicker({
  candidates,
  grantedCount,
  isGranted,
  onToggle,
  locale,
  compact = false,
  isLocked,
  lockedHint,
}: {
  candidates: any[];
  grantedCount: number;
  isGranted: (userId: string) => boolean;
  onToggle: (userId: string, granted: boolean) => void;
  locale: string;
  compact?: boolean;
  /** When true for a user, their checkbox can't be UNchecked (checking is always allowed). */
  isLocked?: (userId: string) => boolean;
  lockedHint?: string;
}) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className={compact ? "h-7 gap-1 text-[11px] px-2" : "h-8 gap-1.5 text-xs"}>
          <Users2 className={compact ? "h-3 w-3" : "h-3.5 w-3.5"} />
          {grantedCount}/{candidates.length}
          <ChevronDown className={compact ? "h-3 w-3 opacity-60" : "h-3.5 w-3.5 opacity-60"} />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-64 p-2">
        <div className="max-h-64 overflow-y-auto space-y-0.5">
          {candidates.map((c: any) => {
            const locked = isGranted(c.id) && !!isLocked?.(c.id);
            return (
              <label
                key={c.id}
                className={
                  "flex items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors " +
                  (locked ? "cursor-not-allowed opacity-70" : "cursor-pointer hover:bg-accent/40")
                }
                title={locked ? lockedHint : undefined}
              >
                <Checkbox
                  checked={isGranted(c.id)}
                  disabled={locked}
                  onCheckedChange={(v) => {
                    if (locked) return;
                    onToggle(c.id, v === true);
                  }}
                />
                <span className="flex-1 text-[13px]">{userDisplayLabel(c, locale)}</span>
                {locked && <Lock className="h-3 w-3 text-muted-foreground shrink-0" />}
              </label>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}
