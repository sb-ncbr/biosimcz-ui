type RankedItem = { key: string; label: string; value: string };

// Markup matches RankedSection/RankedRow from the echarts barrel; kept local so panel tests that mock the barrel keep working.
function RankedList({ title, items, emptyText, description }: { title: string; items: readonly RankedItem[]; emptyText: string; description?: string }) {
  return (
    <section aria-label={title} className="border-border flex flex-col gap-3 rounded-lg border p-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-text text-sm font-medium">{title}</h3>
        {description ? <p className="text-text-muted text-xs">{description}</p> : null}
      </div>
      {items.length === 0 ? (
        <p className="text-text-muted text-sm">{emptyText}</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item, rank) => (
            <li key={item.key} className="border-border flex items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm">
              <span className="text-text min-w-0">{`${rank + 1}. ${item.label}`}</span>
              <span className="text-text-muted font-mono text-xs whitespace-nowrap">{item.value}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

export { RankedList };
export type { RankedItem };
