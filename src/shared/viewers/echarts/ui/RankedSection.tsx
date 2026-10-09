import type { ReactNode } from "react";

type RankedRowProps = { label: ReactNode; value: ReactNode };

// One "top items" line: label on the left, monospace value on the right.
function RankedRow({ label, value }: RankedRowProps) {
  return (
    <li className="border-border flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm">
      <span className="text-text min-w-0">{label}</span>
      <span className="text-text-muted font-mono text-xs whitespace-nowrap">{value}</span>
    </li>
  );
}

type RankedSectionProps = { title: string; description?: string; children: ReactNode };

// Bordered section for "most frequent" style lists; children are RankedRow items.
function RankedSection({ title, description, children }: RankedSectionProps) {
  return (
    <section aria-label={title} className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-text text-sm font-medium">{title}</h3>
        {description ? <p className="text-text-muted text-xs">{description}</p> : null}
      </div>
      {children}
    </section>
  );
}

export { RankedRow, RankedSection };
export type { RankedRowProps, RankedSectionProps };
