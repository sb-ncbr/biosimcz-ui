import Link from "next/link";
import { accessLabel, formatDay, licenseLabel } from "@/entities/deposition";
import { Badge, Card, CardContent, CardFooter, DoiChip, MetaItem } from "@/shared/ui";
import { recordHref } from "../lib/href";
import type { RecordSummary } from "../model/types";
import { RecordThumbnail } from "./RecordThumbnail";

const NO_TITLE = "Untitled record";
const MAX_BYLINE_AUTHORS = 3;

const Dot = () => <span aria-hidden className="bg-base-300 size-[3px] shrink-0 rounded-full" />;

const byline = (authors: readonly string[]): string => {
  if (authors.length === 0) return "No authors listed";
  const shown = authors.slice(0, MAX_BYLINE_AUTHORS).join(", ");
  return authors.length > MAX_BYLINE_AUTHORS ? `${shown}, et al.` : shown;
};

// Public result card. The title link covers the whole card; the DOI chip sits above it (z-10) and copies.
const RecordCard = ({ record, headingLevel = "h2" }: { record: RecordSummary; headingLevel?: "h2" | "h3" }) => {
  const Heading = headingLevel;
  const access = accessLabel(record);
  const license = licenseLabel(record.license);
  const published = record.publishedAt ? formatDay(record.publishedAt) : "";
  const communities = record.communities.map((community) => community.label).join(", ");
  // MDposit facts (null or empty for MDRepo records).
  const facts = [
    record.engine,
    record.waterModel,
    record.method,
    record.replicaCount !== null ? `${record.replicaCount} ${record.replicaCount === 1 ? "replica" : "replicas"}` : null,
    record.groups[0] ?? null,
  ].filter((fact): fact is string => fact !== null && fact !== "");

  return (
    <Card
      className="border-border focus-within:ring-border-focus/40 relative gap-0 overflow-hidden rounded-xl border py-0 drop-shadow-none focus-within:ring-2"
      data-testid="record-card"
    >
      <CardContent className="flex items-start gap-3 p-4 pb-3.5">
        <div className="flex min-w-0 flex-1 flex-col gap-2">
          <div className="flex flex-wrap items-start gap-x-3 gap-y-2">
            <div className="min-w-0 flex-1 max-md:basis-full">
              <Heading className="text-[15px] leading-snug font-semibold break-words">
                <Link href={recordHref(record.id)} className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none">
                  {record.title ? record.title : <em className="text-text-muted font-medium">{NO_TITLE}</em>}
                </Link>
              </Heading>
              <p className="text-text-muted mt-0.5 text-xs">{byline(record.authors)}</p>
            </div>
            <div className="flex items-center gap-2">
              {record.accession ? (
                <Badge variant="outline" className="px-2 font-mono">
                  {record.accession}
                </Badge>
              ) : null}
              {record.doi ? <DoiChip doi={record.doi} /> : null}
              {record.version !== null ? (
                <Badge variant="secondary" className="px-2">
                  v{record.version}
                </Badge>
              ) : null}
            </div>
          </div>
          <p className="text-text-muted line-clamp-2 text-xs leading-relaxed">{record.description ?? "No description"}</p>
        </div>
        {record.accession ? <RecordThumbnail accession={record.accession} title={record.title} /> : null}
      </CardContent>
      <CardFooter className="border-border bg-base-50 flex-wrap gap-x-2.5 gap-y-1 border-t px-4 py-2.5 text-xs">
        {communities ? (
          <>
            <span className="text-text min-w-0 break-words">{communities}</span>
            <Dot />
          </>
        ) : null}
        <span className="text-text-muted">{published ? `Published ${published}` : "Published"}</span>
        {access ? (
          <>
            <Dot />
            <MetaItem icon={record.access === "open" ? "access-open" : "access-embargoed"} label={access} muted={false} />
          </>
        ) : null}
        {license ? (
          <>
            <Dot />
            <MetaItem icon="license" label={license} muted={false} />
          </>
        ) : null}
        {facts.map((fact) => (
          <span key={fact} className="flex items-center gap-2.5">
            <Dot />
            <span className="text-text min-w-0 break-words">{fact}</span>
          </span>
        ))}
      </CardFooter>
    </Card>
  );
};

export { RecordCard };
