import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { accessLabel, formatDay } from "@/entities/deposition";
import { DefinitionList } from "@/entities/deposition/ui";
import type { RecordDetail } from "@/entities/record";
import { replicaHref } from "@/entities/replica";
import { doiUrl } from "@/shared/lib";
import { Button, Card } from "@/shared/ui";
import { formatFileSize } from "../lib/formatFileSize";
import { present } from "../lib/format";
import { CopyButton } from "./CopyButton";
import { StructurePanel } from "./StructurePanel";

const day = (iso: string | null): string | undefined => (iso ? formatDay(iso) || undefined : undefined);

// Side panel: the structure first (MDposit projects only, the viewer reads MDposit files), then the facts people cite.
const RecordAside = ({ record, title }: { record: RecordDetail; title: string }) => {
  // MDposit has no publication date, only the project creation; MDRepo publishedAt is the publication.
  const mdposit = record.accession !== null;
  const doiHref = doiUrl(record.doi);
  const firstReplica = record.replicaNames[0];
  const items = present([
    {
      term: "Accession",
      description: record.accession ? (
        <span className="flex items-center justify-between gap-2">
          <span className="font-mono">{record.accession}</span>
          <CopyButton text={record.accession} what="accession" className="-my-1.5" />
        </span>
      ) : undefined,
    },
    {
      term: "DOI",
      description: record.doi ? (
        <span className="flex items-center justify-between gap-2">
          {doiHref ? (
            <a href={doiHref} rel="noopener noreferrer" target="_blank" className="min-w-0 break-all underline underline-offset-2">
              {record.doi}
            </a>
          ) : (
            <span className="min-w-0 break-all">{record.doi}</span>
          )}
          <CopyButton text={record.doi} what="DOI" className="-my-1.5" />
        </span>
      ) : undefined,
    },
    { term: mdposit ? "Created" : "Published", description: day(record.publishedAt) },
    { term: "Updated", description: day(record.updatedAt) },
    { term: "Version", description: record.version === null ? undefined : `v${record.version}` },
    { term: "Access", description: accessLabel(record) ?? undefined },
    { term: "Total size", description: record.totalSize === null ? undefined : formatFileSize(record.totalSize) },
  ]);

  return (
    <aside aria-labelledby="record-facts-heading">
      <Card className="border-border gap-0 overflow-hidden rounded-xl border py-0 drop-shadow-none">
        {record.accession && firstReplica ? (
          <div className="border-border border-b p-3">
            <Button asChild className="w-full max-md:min-h-11">
              <Link href={replicaHref(record.accession, firstReplica, "overview")}>
                <FlaskConical className="size-4" aria-hidden />
                Open experiment details
              </Link>
            </Button>
          </div>
        ) : null}
        {record.accession ? <StructurePanel recordId={record.accession} title={title} className="border-border border-b" /> : null}
        <div className="flex flex-col gap-3 p-4">
          <h2 id="record-facts-heading" className="text-[15px] font-semibold">
            Record
          </h2>
          <DefinitionList items={items} className="sm:grid-cols-[88px_1fr] sm:gap-y-2.5" />
          {record.citation ? <CopyButton text={record.citation} what="citation" label="Copy citation" variant="outline" className="mt-1 w-full" /> : null}
        </div>
      </Card>
    </aside>
  );
};

export { RecordAside };
