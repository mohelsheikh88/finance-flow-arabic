import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useI18n, useLocalized } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Pencil, Users2, UserPlus, Blocks } from "lucide-react";
import { toast } from "sonner";
import { userDisplayLabel } from "@/lib/user-display";

type UserGroup = {
  id: string;
  company_id: string;
  name_ar: string;
  name_en: string;
  description: string | null;
  hue: number;
};

type Profile = {
  id: string;
  email: string;
  employee_id: string | null;
  display_name_ar: string | null;
  display_name_en: string | null;
};

const emptyGroup = { name_ar: "", name_en: "", description: "" };

export function UserGroupsManagement() {
  const { t, locale } = useI18n();
  const localized = useLocalized();
  const qc = useQueryClient();

  const { data: companies = [] } = useQuery({
    queryKey: ["companies_for_groups"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id").limit(1);
      if (error) throw error;
      return data;
    },
  });
  const companyId = companies[0]?.id as string | undefined;

  const { data: groupsList = [] } = useQuery({
    queryKey: ["user_groups_list"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_groups").select("*").order("created_at");
      if (error) throw error;
      return data as UserGroup[];
    },
  });

  const { data: memberCounts } = useQuery({
    queryKey: ["user_group_member_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_group_members").select("group_id");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data as any[]) map.set(r.group_id, (map.get(r.group_id) ?? 0) + 1);
      return map;
    },
  });

  const { data: moduleCounts } = useQuery({
    queryKey: ["user_group_module_counts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_group_modules").select("group_id");
      if (error) throw error;
      const map = new Map<string, number>();
      for (const r of data as any[]) map.set(r.group_id, (map.get(r.group_id) ?? 0) + 1);
      return map;
    },
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["all_users_for_groups"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, email, employee_id, display_name_ar, display_name_en")
        .order("email");
      if (error) throw error;
      return data as Profile[];
    },
  });

  // ===== Create/Edit group =====
  const [groupOpen, setGroupOpen] = useState(false);
  const [groupForm, setGroupForm] = useState<typeof emptyGroup & { id?: string }>(emptyGroup);
  const openGroup = (g?: UserGroup) => {
    setGroupForm(g ? { id: g.id, name_ar: g.name_ar, name_en: g.name_en, description: g.description ?? "" } : emptyGroup);
    setGroupOpen(true);
  };

  const groupMut = useMutation({
    mutationFn: async () => {
      const payload = {
        name_ar: groupForm.name_ar,
        name_en: groupForm.name_en,
        description: groupForm.description || null,
      };
      if (groupForm.id) {
        const { error } = await supabase.from("user_groups").update(payload).eq("id", groupForm.id);
        if (error) throw error;
      } else {
        if (!companyId) throw new Error("No company found");
        const hue = (groupsList.length * 47) % 360;
        const { error } = await supabase.from("user_groups").insert({ ...payload, company_id: companyId, hue });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(t("common.saved"));
      setGroupOpen(false);
      qc.invalidateQueries({ queryKey: ["user_groups_list"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const canSaveGroup = groupForm.name_ar && groupForm.name_en && !!companyId;

  // ===== Members dialog =====
  const [membersGroup, setMembersGroup] = useState<UserGroup | null>(null);
  const { data: currentMemberIds } = useQuery({
    queryKey: ["group_members", membersGroup?.id],
    enabled: !!membersGroup,
    queryFn: async () => {
      const { data, error } = await supabase.from("user_group_members").select("user_id").eq("group_id", membersGroup!.id);
      if (error) throw error;
      return new Set((data as any[]).map((r) => r.user_id as string));
    },
  });

  const toggleMember = useMutation({
    mutationFn: async ({ userId, checked }: { userId: string; checked: boolean }) => {
      if (checked) {
        const { error } = await supabase.from("user_group_members").upsert({ group_id: membersGroup!.id, user_id: userId }, { onConflict: "group_id,user_id" });
        if (error) throw error;
      } else {
        const { error } = await supabase.from("user_group_members").delete().eq("group_id", membersGroup!.id).eq("user_id", userId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["group_members", membersGroup?.id] });
      qc.invalidateQueries({ queryKey: ["user_group_member_counts"] });
      qc.invalidateQueries({ queryKey: ["my_module_access"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const userLabel = (p: Profile) => userDisplayLabel(p, locale);

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button onClick={() => openGroup()} disabled={!companyId}>
          <Plus className="h-4 w-4 me-1" />
          {t("users.newGroup")}
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {groupsList.map((g) => (
          <Card key={g.id} className="p-4 flex flex-col">
            <div className="flex items-start gap-2.5 mb-2">
              <div className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center" style={{ background: `hsl(${g.hue} 70% 45% / 0.15)` }}>
                <Users2 className="h-[18px] w-[18px]" style={{ color: `hsl(${g.hue} 70% 40%)` }} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold truncate">{localized(g, "name")}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" onClick={() => openGroup(g)}>
                    <Pencil className="h-3 w-3" />
                  </Button>
                </div>
                {g.description && <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{g.description}</p>}
              </div>
            </div>

            <div className="flex items-center gap-2 mb-3 mt-1">
              <Badge variant="outline" className="gap-1 text-[11px]">
                <Users2 className="h-3 w-3" /> {memberCounts?.get(g.id) ?? 0} {t("users.groupMembers")}
              </Badge>
              <Badge variant="outline" className="gap-1 text-[11px]">
                <Blocks className="h-3 w-3" /> {moduleCounts?.get(g.id) ?? 0} {t("nav.modulesManagement")}
              </Badge>
            </div>

            <Button variant="outline" size="sm" className="mt-auto gap-1.5" onClick={() => setMembersGroup(g)}>
              <UserPlus className="h-3.5 w-3.5" />
              {t("users.manageMembers")}
            </Button>
          </Card>
        ))}
      </div>

      {groupsList.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-10">{t("users.noGroupsYet")}</p>
      )}

      {/* Create/Edit dialog */}
      <Dialog open={groupOpen} onOpenChange={setGroupOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{groupForm.id ? t("users.editGroup") : t("users.newGroup")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>{t("common.name")} (EN)</Label>
                <Input value={groupForm.name_en} onChange={(e) => setGroupForm((f) => ({ ...f, name_en: e.target.value }))} dir="ltr" />
              </div>
              <div>
                <Label>{t("common.name")} (AR)</Label>
                <Input value={groupForm.name_ar} onChange={(e) => setGroupForm((f) => ({ ...f, name_ar: e.target.value }))} dir="rtl" />
              </div>
            </div>
            <div>
              <Label>{t("users.groupDescription")}</Label>
              <Textarea value={groupForm.description} onChange={(e) => setGroupForm((f) => ({ ...f, description: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setGroupOpen(false)}>{t("common.cancel")}</Button>
            <Button onClick={() => groupMut.mutate()} disabled={!canSaveGroup || groupMut.isPending}>{t("common.save")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Members dialog */}
      <Dialog open={!!membersGroup} onOpenChange={(o) => !o && setMembersGroup(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {t("users.manageMembers")} — {membersGroup && localized(membersGroup, "name")}
            </DialogTitle>
          </DialogHeader>
          <div className="max-h-96 overflow-y-auto space-y-0.5">
            {allUsers.map((u) => {
              const checked = currentMemberIds?.has(u.id) ?? false;
              return (
                <label key={u.id} className="flex items-center gap-2.5 rounded-md px-2 py-2 cursor-pointer hover:bg-accent/40 transition-colors">
                  <Checkbox checked={checked} onCheckedChange={(v) => toggleMember.mutate({ userId: u.id, checked: v === true })} />
                  <span className="flex-1 text-sm">{userLabel(u)}</span>
                </label>
              );
            })}
            {allUsers.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">{t("common.noData")}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setMembersGroup(null)}>{t("common.cancel")}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
