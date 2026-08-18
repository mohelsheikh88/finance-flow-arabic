import { Link } from "@tanstack/react-router";

export type ModuleCardData = {
  label: string;
  icon: any;
  hue: number;
  url: string;
};

/** Turns a route path into a valid, stable CSS view-transition-name. */
export function transitionNameFor(url: string): string {
  return "card-" + url.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

/**
 * The exact glossy/glowing square card used on the main Apps launcher.
 * Reused for any sub-launcher grid (e.g. Medical App's own modules) so
 * every "pick a module" screen in the product looks identical.
 *
 * Each card carries a unique `view-transition-name`, matched by the same
 * name on the destination screen's hero header — the browser's native
 * View Transitions API then morphs the card into the header automatically
 * ("card grows into the screen"), with a graceful no-op fallback on
 * browsers that don't support it yet.
 */
export function ModuleCardGrid({ items, className = "" }: { items: ModuleCardData[]; className?: string }) {
  return (
    <div className={"grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3 sm:gap-3.5 w-full max-w-4xl " + className}>
      {items.map((item) => (
        <Link
          key={item.url}
          to={item.url}
          viewTransition
          style={{ ["--hue" as any]: item.hue, viewTransitionName: transitionNameFor(item.url) }}
          className="group flex flex-col items-center justify-center gap-2 aspect-square overflow-hidden rounded-2xl p-3 sm:p-3.5
                     bg-gradient-to-br from-white/[0.08] to-white/[0.02] border border-white/[0.10]
                     shadow-[0_8px_24px_-12px_rgba(0,0,0,0.5)] backdrop-blur-sm
                     transition-all duration-200 ease-out
                     hover:from-white/[0.13] hover:to-white/[0.03] hover:border-[hsl(var(--hue)_85%_60%/0.45)]
                     hover:-translate-y-1 hover:shadow-[0_20px_44px_-16px_rgba(0,0,0,0.6)]
                     active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[hsl(var(--hue)_85%_60%/0.5)]"
        >
          <div className="relative flex h-11 w-11 sm:h-12 sm:w-12 shrink-0 items-center justify-center">
            {/* Ambient colored glow — pure light, no visible edge/shape */}
            <div
              aria-hidden
              className="absolute inset-0 rounded-full blur-lg opacity-60 transition-opacity duration-200 group-hover:opacity-90"
              style={{ background: "radial-gradient(circle, hsl(var(--hue) 85% 55% / 0.4), transparent 70%)" }}
            />
            {/* Glossy top highlight — simulates a light source for depth */}
            <div
              aria-hidden
              className="absolute top-1 inset-x-2.5 h-1/2 rounded-full blur-md opacity-35 pointer-events-none"
              style={{ background: "radial-gradient(ellipse, white, transparent 72%)" }}
            />
            <item.icon
              strokeWidth={1.6}
              className="relative h-14 w-14 sm:h-16 sm:w-16 transition-transform duration-200 group-hover:scale-110 group-hover:-translate-y-0.5"
              style={{
                color: "hsl(var(--hue) 90% 70%)",
                filter:
                  "drop-shadow(0 2px 3px hsl(var(--hue) 85% 30% / 0.6)) drop-shadow(0 10px 20px hsl(var(--hue) 85% 45% / 0.5))",
              }}
            />
          </div>
          <span className="text-[13px] sm:text-sm font-bold text-center text-white/95 leading-tight line-clamp-2" title={item.label}>
            {item.label}
          </span>
        </Link>
      ))}
    </div>
  );
}
