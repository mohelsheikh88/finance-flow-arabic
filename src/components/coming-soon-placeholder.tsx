import { useI18n } from "@/i18n";
import { Construction } from "lucide-react";

export function ComingSoonPlaceholder() {
  const { t } = useI18n();
  return (
    <div className="flex-1 flex items-center justify-center min-h-[60vh]">
      <div className="text-center space-y-4">
        <div className="mx-auto w-16 h-16 rounded-full bg-muted flex items-center justify-center">
          <Construction className="h-8 w-8 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold text-foreground">
          {t("common.comingSoon")}
        </h2>
        <p className="text-muted-foreground max-w-sm mx-auto">
          {t("common.willBeBuiltLater")}
        </p>
      </div>
    </div>
  );
}
