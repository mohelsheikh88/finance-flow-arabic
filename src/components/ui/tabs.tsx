import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n";

// Radix's Tabs doesn't read the document's `dir` automatically — without an
// explicit `dir` prop, arrow-key navigation between triggers stays LTR-only
// even on an RTL page. This wrapper defaults `dir` to the current locale's
// direction (still overridable by passing `dir` explicitly).
const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root>
>(({ dir, ...props }, ref) => {
  const { locale } = useI18n();
  return <TabsPrimitive.Root ref={ref} dir={dir ?? (locale === "ar" ? "rtl" : "ltr")} {...props} />;
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "relative inline-flex h-11 items-center justify-start gap-1 rounded-xl border border-border/60 bg-gradient-to-b from-muted/40 to-muted/20 p-1 text-muted-foreground shadow-sm backdrop-blur supports-[backdrop-filter]:bg-muted/30",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
    className={cn(
      "group relative inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium tracking-tight text-muted-foreground ring-offset-background cursor-pointer transition-all duration-200 ease-out",
      "hover:text-foreground hover:bg-background/60",
      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed",
      "data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-[0_1px_2px_rgba(0,0,0,0.04),0_4px_12px_-2px_rgba(0,0,0,0.08)] data-[state=active]:ring-1 data-[state=active]:ring-border/60",
      "after:absolute after:start-3 after:end-3 after:-bottom-px after:h-0.5 after:rounded-full after:bg-gradient-to-r after:from-primary/60 after:via-primary after:to-primary/60 after:opacity-0 after:scale-x-0 after:transition-all after:duration-300 data-[state=active]:after:opacity-100 data-[state=active]:after:scale-x-100",
      className,
    )}
    {...props}
  />
));
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;


const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-2 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
