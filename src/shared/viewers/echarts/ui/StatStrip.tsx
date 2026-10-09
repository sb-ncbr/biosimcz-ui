import type { StatItem } from "../types";

// Tiles are outlined, not filled: they sit inside a Card and must not read as a second surface.
function StatStrip({ items, label }: { items: readonly StatItem[]; label?: string }) {
  return (
    <dl aria-label={label} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {items.map((item) => (
        <div key={item.label} className="border-border/70 min-w-0 rounded-md border p-3">
          <dt className="text-text-muted text-[11px] tracking-wide uppercase">{item.label}</dt>
          <dd className="text-text truncate text-base font-semibold">
            {item.value}
            {item.unit ? <span className="text-text-muted ml-1 text-sm font-normal">{item.unit}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );
}

export { StatStrip };
