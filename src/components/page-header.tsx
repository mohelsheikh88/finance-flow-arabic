import type { ReactNode } from "react";

type Props = {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

/**
 * Professional page header used across the app.
 * - Hero-grade title with gold→navy accent bar
 * - Optional subtitle and right-aligned actions
 */
export function PageHeader({ title, subtitle, actions, className = "" }: Props) {
  return (
    <header className={`page-header ${className}`}>
      <div className="page-header-text">
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 flex-wrap">{actions}</div>}
    </header>
  );
}
