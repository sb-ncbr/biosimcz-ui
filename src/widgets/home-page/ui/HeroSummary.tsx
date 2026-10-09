import Link from "next/link";
import { recordsHref } from "@/entities/record";
import type { HomeSummary } from "../model/types";

// Reserves the row's height so the streamed counts do not shift the page.
const HeroSummaryFallback = () => <div className="mt-6 min-h-8" aria-hidden />;

const HeroSummary = async ({ summary }: { summary: Promise<HomeSummary> }) => {
  const data = await summary;
  if (!data || (data.total === null && data.engines.length === 0)) return <HeroSummaryFallback />;
  return (
    <div className="mt-6 flex min-h-8 flex-wrap items-center gap-x-6 gap-y-3 text-sm">
      {data.total === null ? null : (
        <p className="text-text-muted">
          <span className="text-text font-semibold tabular-nums">{data.total.toLocaleString("en")}</span> published simulations
        </p>
      )}
      {data.engines.length === 0 ? null : (
        <div className="flex flex-wrap items-center gap-2">
          <span id="home-engines" className="text-text-muted">
            Popular engines:
          </span>
          <ul aria-labelledby="home-engines" className="flex flex-wrap gap-2">
            {data.engines.map((engine) => (
              <li key={engine.key}>
                <Link
                  href={recordsHref({ facets: { software: [engine.key] } })}
                  className="border-border bg-background hover:bg-surface focus-visible:ring-border-focus/50 inline-flex min-h-8 items-center gap-1.5 rounded-full border px-3 outline-none focus-visible:ring-[3px]"
                >
                  {engine.label}
                  {engine.count === null ? null : <span className="text-text-muted tabular-nums">{engine.count}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export { HeroSummary, HeroSummaryFallback };
