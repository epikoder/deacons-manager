import { ReactNode } from "react";
import { SearchIcon } from "./Icons";

/** Shared page furniture, so list, detail and form pages read as one app. */

export const primaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-zinc-300";
export const secondaryButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-zinc-300 bg-white px-4 py-2 text-sm font-medium text-zinc-700 shadow-sm transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-60";
export const dangerButton =
  "inline-flex items-center justify-center gap-2 rounded-lg border border-red-300 bg-white px-4 py-2 text-sm font-medium text-red-600 shadow-sm transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50";
/** Compact secondary, for actions inside a card. */
export const smallButton =
  "inline-flex items-center justify-center gap-1.5 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition-colors hover:bg-zinc-50";

export const selectClass =
  "rounded-lg border border-zinc-300 bg-white px-2.5 py-1.5 text-sm text-zinc-900 outline-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20";

export function PageHeader(
  { title, subtitle, back, actions }: {
    title: ReactNode;
    subtitle?: ReactNode;
    back?: { href: string; label: string };
    actions?: ReactNode;
  },
) {
  return (
    <div>
      {back && (
        <a href={back.href} className="text-sm text-zinc-500 hover:text-zinc-800">
          ← {back.label}
        </a>
      )}
      <div
        className={`flex flex-wrap items-end justify-between gap-3 ${
          back ? "mt-1" : ""
        }`}
      >
        <div className="min-w-0">
          <h1 className="text-xl font-semibold text-zinc-900">{title}</h1>
          {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function Card(
  { title, description, children, tone, actions, bodyClass }: {
    title: ReactNode;
    description?: ReactNode;
    children?: ReactNode;
    tone?: "danger";
    actions?: ReactNode;
    bodyClass?: string;
  },
) {
  // A card can be header-only (a collapsed section): no body, no divider.
  const hasBody = children != null && children !== false;
  return (
    <section
      className={`rounded-xl border bg-white shadow-sm ${
        tone === "danger" ? "border-red-200" : "border-zinc-200"
      }`}
    >
      <div
        className={`flex flex-wrap items-center justify-between gap-3 px-5 py-4 ${
          hasBody ? "border-b border-zinc-100" : ""
        }`}
      >
        <div className="min-w-0">
          <h2
            className={`text-sm font-semibold ${
              tone === "danger" ? "text-red-700" : "text-zinc-900"
            }`}
          >
            {title}
          </h2>
          {description && (
            <p className="mt-0.5 text-xs text-zinc-500">{description}</p>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {hasBody && <div className={bodyClass ?? "px-5 py-4"}>{children}</div>}
    </section>
  );
}

export function StatTile(
  { label, value, hint }: { label: ReactNode; value?: ReactNode; hint?: ReactNode },
) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-sm">
      <div className="text-xs text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums text-zinc-900">
        {value ?? (
          <span className="inline-block h-7 w-16 animate-pulse rounded bg-zinc-100" />
        )}
      </div>
      {hint && <div className="text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export function SearchField(
  { value, onChange, placeholder, className }: {
    value: string;
    onChange: (v: string) => void;
    placeholder: string;
    className?: string;
  },
) {
  return (
    <div className={`relative w-full ${className ?? "sm:max-w-xs"}`}>
      <SearchIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-zinc-400" />
      <input
        type="search"
        value={value}
        onChange={(ev) => onChange(ev.target.value)}
        placeholder={placeholder}
        className="w-full rounded-lg border border-zinc-300 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-zinc-400 focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
      />
    </div>
  );
}

export function EmptyState(
  { title, hint }: { title: ReactNode; hint?: ReactNode },
) {
  return (
    <div className="rounded-xl border border-dashed border-zinc-300 bg-white py-14 text-center">
      <div className="text-sm font-medium text-zinc-700">{title}</div>
      {hint && <div className="mt-1 text-xs text-zinc-500">{hint}</div>}
    </div>
  );
}

export const Avatar = (
  { name, size = "md" }: { name: string; size?: "md" | "lg" },
) => {
  const parts = (name || "?").trim().split(/\s+/);
  const initials = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")) || "?";
  return (
    <span
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full bg-green-100 font-semibold uppercase text-green-800 ${
        size === "lg" ? "size-14 text-lg" : "size-10 text-sm"
      }`}
    >
      {initials}
    </span>
  );
};

/** The scrolling page body every section page renders into. */
export function PageBody(
  { children, width = "max-w-5xl" }: { children: ReactNode; width?: string },
) {
  return (
    <div className="h-full overflow-y-auto">
      <div className={`mx-auto flex w-full ${width} flex-col gap-5 px-6 py-6`}>
        {children}
      </div>
    </div>
  );
}

export const fmtCount = (n: number) => Intl.NumberFormat().format(n);

/** Header for a person's page: back link, avatar, name, contact line, actions. */
export function ProfileHeader(
  { back, name, nameExtra, meta, actions }: {
    back: { href: string; label: string };
    name: string;
    nameExtra?: ReactNode;
    meta?: ReactNode;
    actions?: ReactNode;
  },
) {
  return (
    <div>
      <a href={back.href} className="text-sm text-zinc-500 hover:text-zinc-800">
        ← {back.label}
      </a>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar name={name} size="lg" />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-semibold text-zinc-900">{name}</h1>
              {nameExtra}
            </div>
            {meta && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-zinc-500">
                {meta}
              </div>
            )}
          </div>
        </div>
        {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
      </div>
    </div>
  );
}

export function NotFound(
  { what, back }: { what: string; back: { href: string; label: string } },
) {
  return (
    <PageBody width="max-w-3xl">
      <div className="rounded-xl border border-zinc-200 bg-white p-10 text-center shadow-sm">
        <h1 className="text-base font-semibold text-zinc-900">
          {what} not found
        </h1>
        <a
          href={back.href}
          className="mt-2 inline-block text-sm text-green-700 hover:underline"
        >
          Back to {back.label.toLowerCase()}
        </a>
      </div>
    </PageBody>
  );
}
