import type { RecordDetail } from "@/entities/record";
import { Content } from "@/shared/ui";
import { capitalize } from "../lib/format";
import { FilesSection } from "./FilesSection";
import { RecordAside } from "./RecordAside";
import { RecordHeader } from "./RecordHeader";
import {
  AcknowledgementsSection,
  ContributorsSection,
  KeywordsSection,
  LicenseSection,
  ReferencesSection,
  SimulationSection,
  TrajectoriesSection,
} from "./RecordSections";
import { SequencesSection } from "./SequencesSection";

const NO_TITLE = "Untitled record";
const BYLINE_AUTHORS = 3;

const Byline = ({ record }: { record: RecordDetail }) => {
  const names = record.authors.map((author) => author.name);
  if (names.length === 0 && !record.engine) return null;
  const shown = names.slice(0, BYLINE_AUTHORS).join(", ");
  const more = names.length > BYLINE_AUTHORS ? ` and ${names.length - BYLINE_AUTHORS} more` : "";
  return (
    <p className="text-text-muted flex flex-wrap items-center gap-x-2 text-sm">
      {names.length > 0 ? <span className="text-text font-medium">{`${shown}${more}`}</span> : null}
      {names.length > 0 && record.engine ? <span aria-hidden>·</span> : null}
      {record.engine ? <span>{record.engine}</span> : null}
    </p>
  );
};

// Public dataset page. Header across the top; below it the facts panel (structure, accession, dates) sits on the right and
// stays in view on desktop, while on phones it follows the header. Sections without data are left out.
const RecordDetailView = ({ record }: { record: RecordDetail }) => {
  const title = record.title ?? NO_TITLE;
  const dataType = record.simulation?.type ? capitalize(record.simulation.type) : null;
  return (
    <Content className="max-w-6xl space-y-0 max-md:px-4">
      <RecordHeader title={title} accession={record.accession} dataType={dataType} lead={record.description} byline={<Byline record={record} />} />
      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_440px] lg:gap-10">
        <div className="lg:sticky lg:top-6 lg:col-start-2 lg:row-start-1 lg:self-start">
          <RecordAside record={record} title={title} />
        </div>
        <div className="flex min-w-0 flex-col gap-8 lg:col-start-1 lg:row-start-1">
          <SimulationSection record={record} />
          <ContributorsSection record={record} />
          <SequencesSection sequences={record.sequences} />
          <TrajectoriesSection record={record} />
          <FilesSection files={record.files} access={record.access} embargoUntil={record.embargoUntil} />
          <ReferencesSection record={record} />
          <LicenseSection record={record} />
          <KeywordsSection record={record} />
          <AcknowledgementsSection record={record} />
        </div>
      </div>
    </Content>
  );
};

export { RecordDetailView };
