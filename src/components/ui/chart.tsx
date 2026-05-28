// Minimal stub — recharts v3 broke the original shadcn chart wrapper types.
// We use recharts directly in our dashboard components instead of this wrapper.
import * as React from "react";

export type ChartConfig = Record<string, { label?: string; color?: string }>;

export const ChartContainer = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { config?: ChartConfig }
>(({ children, ...props }, ref) => (
  <div ref={ref} {...props}>
    {children}
  </div>
));
ChartContainer.displayName = "ChartContainer";

export const ChartTooltip = () => null;
export const ChartTooltipContent = () => null;
export const ChartLegend = () => null;
export const ChartLegendContent = () => null;
export const ChartStyle = () => null;
