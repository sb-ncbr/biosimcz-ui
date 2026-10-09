import type { CompositionRow } from "../../lib/rows";
import { OverviewCard } from "./OverviewCard";

const CompositionCard = ({ rows, className }: { rows: readonly CompositionRow[]; className?: string }) => (
  <OverviewCard title="System Composition" className={className}>
    <dl className="grid gap-2 @md:grid-cols-2 @2xl:grid-cols-3">
      {rows.map((row) => (
        <div key={row.label} className="bg-base-100 flex min-w-0 flex-col gap-1.5 rounded-lg px-3 py-2.5">
          <dt className="text-text-muted text-xs">{row.label}</dt>
          <dd className="grid grid-cols-2 gap-2">
            <span className="flex flex-col">
              <span className="text-base font-semibold tabular-nums">{row.atoms}</span>
              <span className="text-text-muted text-xs">atoms</span>
            </span>
            <span className="flex flex-col">
              <span className="text-base font-semibold tabular-nums">{row.residues}</span>
              <span className="text-text-muted text-xs">residues</span>
            </span>
          </dd>
        </div>
      ))}
    </dl>
  </OverviewCard>
);

export { CompositionCard };
