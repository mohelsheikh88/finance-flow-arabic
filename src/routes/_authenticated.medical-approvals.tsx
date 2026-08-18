import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ShieldCheck } from "lucide-react";
import { RolesManagement } from "@/components/roles-management";
import { UserRolesManagement } from "@/components/user-roles-management";

export const Route = createFileRoute("/_authenticated/medical-approvals")({
  component: Page,
});

/**
 * The standard "Configuration → Approvals" pattern every module should
 * have (Roles Management, Users Roles, Workflows), applied here to
 * Medical Apps — the second module to get it, after Accounting.
 */
function Page() {
  const { t } = useI18n();

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="page-title flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" />
          {t("approvals.title")}
        </h1>
      </div>

      <Tabs defaultValue="roles">
        <TabsList>
          <TabsTrigger value="roles">{t("roles.title")}</TabsTrigger>
          <TabsTrigger value="user_roles">{t("approvals.usersRolesTab")}</TabsTrigger>
          <TabsTrigger value="workflows">{t("approvals.workflows")}</TabsTrigger>
        </TabsList>

        <TabsContent value="roles">
          <RolesManagement moduleKey="his" />
        </TabsContent>

        <TabsContent value="user_roles">
          <UserRolesManagement moduleScope="his" rolesOnly />
        </TabsContent>

        <TabsContent value="workflows">
          <Card className="p-8 text-center text-sm text-muted-foreground">
            {t("approvals.workflowsNotYetForModule")}
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
