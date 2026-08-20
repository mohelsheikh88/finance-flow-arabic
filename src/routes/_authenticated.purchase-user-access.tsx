import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { useNavGroups } from "@/lib/nav-config";
import { ModuleSectionAccessManagement } from "@/components/module-section-access";
import { UserRolesManagement } from "@/components/user-roles-management";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { UserCog } from "lucide-react";

export const Route = createFileRoute("/_authenticated/purchase-user-access")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  const groups = useNavGroups();
  const purchase = groups.find((g) => g.key === "purchase");

  // Every section of Purchase EXCEPT Configuration itself — granting
  // access to Configuration is a bigger admin capability handled
  // separately (top-level "Allowed Modules"), not casually from here.
  const sections = (purchase?.subgroups ?? []).filter((sg) => sg.key !== "purchaseConfiguration");

  return (
    <div className="p-6 space-y-4 max-w-3xl mx-auto">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <UserCog className="h-5 w-5 text-muted-foreground" />
          {t("common.sectionAccessTitle")}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">{t("common.sectionAccessSubtitle")}</p>
      </div>

      <Tabs defaultValue="access">
        <TabsList>
          <TabsTrigger value="access">{t("common.sectionAccessTitle")}</TabsTrigger>
          <TabsTrigger value="user_roles">{t("approvals.usersRolesTab")}</TabsTrigger>
        </TabsList>

        <TabsContent value="access" className="mt-4">
          <ModuleSectionAccessManagement moduleKey="purchase" sections={sections} />
        </TabsContent>

        <TabsContent value="user_roles" className="mt-4">
          <UserRolesManagement moduleScope="purchase" rolesOnly />
        </TabsContent>
      </Tabs>
    </div>
  );
}
