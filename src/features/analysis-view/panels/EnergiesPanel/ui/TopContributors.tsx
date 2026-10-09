import type { UnitLabel } from "@/entities/analysis";
import { RankedRow, RankedSection } from "@/shared/viewers/echarts";
import { formatValue, unitText } from "../../structuralCommon";
import type { Contributor } from "../model";

function TopContributors({ items, unit }: { items: readonly Contributor[]; unit: UnitLabel | null }) {
  const suffix = unitText(unit);
  return (
    <RankedSection title="Top absolute contributors">
      {items.length === 0 ? (
        <p className="text-text-muted text-xs">Unable to compute contributor ranking for this selection.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((item) => (
            <RankedRow
              key={item.index}
              label={`${item.index + 1}. ${item.label}`}
              value={`${formatValue(item.value, 2)}${suffix ? ` ${suffix}` : ""}`}
            />
          ))}
        </ol>
      )}
    </RankedSection>
  );
}

export { TopContributors };
