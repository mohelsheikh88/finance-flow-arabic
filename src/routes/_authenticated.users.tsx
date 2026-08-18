import { createFileRoute } from "@tanstack/react-router";
import { useI18n } from "@/i18n";
import { UserRolesManagement } from "@/components/user-roles-management";
import { UserGroupsManagement } from "@/components/user-groups-management";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Users, Users2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/users")({
  component: Page,
});

function Page() {
  const { t } = useI18n();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-2">
        <Users className="h-5 w-5 text-primary" />
        <h1 className="page-title">{t("users.title")}</h1>
      </div>

      <Tabs defaultValue="users">
        <TabsList>
          <TabsTrigger value="users">
            <Users className="h-4 w-4 me-2" />
            {t("users.tabUsers")}
          </TabsTrigger>
          <TabsTrigger value="groups">
            <Users2 className="h-4 w-4 me-2" />
            {t("users.tabGroups")}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="mt-4">
          <UserRolesManagement />
        </TabsContent>
        <TabsContent value="groups" className="mt-4">
          <UserGroupsManagement />
        </TabsContent>
      </Tabs>
    </div>
  );
}
