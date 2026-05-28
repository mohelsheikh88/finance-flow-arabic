import { Card, CardContent } from "@/components/ui/card";
import { Construction } from "lucide-react";
import { useI18n } from "@/i18n";

export function ComingSoon({ title }: { title: string }) {
  const { t } = useI18n();
  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">{title}</h1>
      <Card>
        <CardContent className="p-12 text-center">
          <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-4">
            <Construction className="h-8 w-8 text-primary" />
          </div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-muted-foreground mt-2">
            {t("common.loading")}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
