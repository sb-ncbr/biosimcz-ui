import Link from "next/link";
import type { ReactNode } from "react";
import { DefinitionList } from "@/entities/deposition/ui";
import { recordsHref, type RecordDetail } from "@/entities/record";
import { replicaHref } from "@/entities/replica";
import { doiUrl, orcidUrl } from "@/shared/lib";
import { Badge, Muted } from "@/shared/ui";
import { count, licenseText, pdbUrl, present, splitEmails, uniprotUrl } from "../lib/format";
import { CopyButton } from "./CopyButton";
import { RecordSection } from "./RecordSection";

// Every section renders nothing when the record carries no data for it.

const LINK = "underline underline-offset-2 hover:text-text-muted break-words";

const External = ({ href, children }: { href: string; children: ReactNode }) => (
  <a href={href} rel="noopener noreferrer" target="_blank" className={LINK}>
    {children}
  </a>
);

const Chips = ({ values, mono = false }: { values: ReactNode[]; mono?: boolean }) => (
  <span className="flex flex-wrap gap-1.5">
    {values.map((value, index) => (
      <Badge key={index} variant="secondary" className={mono ? "px-2 py-1 font-mono text-xs font-normal" : "px-2 py-1 text-xs font-normal"}>
        {value}
      </Badge>
    ))}
  </span>
);

const SimulationSection = ({ record }: { record: RecordDetail }) => {
  const facts = record.simulation;
  const items = present([
    { term: "Program", description: record.engine ?? undefined },
    { term: "Method", description: facts?.method ?? undefined },
    { term: "Ensemble", description: facts?.ensemble ?? undefined },
    { term: "Force field", description: facts?.forceFields },
    { term: "Water model", description: facts?.waterModel ?? undefined },
    { term: "Temperature", description: facts?.temperature == null ? undefined : `${facts.temperature} K` },
    { term: "Timestep", description: facts?.timestep == null ? undefined : `${facts.timestep} fs` },
    { term: "Length", description: facts?.lengthNs == null ? undefined : `${facts.lengthNs.toLocaleString("en")} ns` },
    { term: "Atoms", description: count(facts?.atoms ?? null) },
    { term: "Frames", description: count(facts?.frames ?? null) },
    { term: "Replicas", description: count(facts?.replicas ?? null) },
  ]);
  if (items.length === 0) return null;
  return (
    <RecordSection id="simulation" title="Simulation details">
      <DefinitionList items={items} />
    </RecordSection>
  );
};

const Contact = ({ text }: { text: string }) => (
  <span className="whitespace-pre-line">
    {splitEmails(text).map((part, index) =>
      index % 2 === 1 ? (
        <a key={index} href={`mailto:${part}`} className={LINK}>
          {part}
        </a>
      ) : (
        part
      ),
    )}
  </span>
);

const ContributorsSection = ({ record }: { record: RecordDetail }) => {
  // MDposit lists bare names, often a dozen: one flowing line reads better than a tall column.
  const namesOnly = record.authors.every((author) => !author.orcid && author.affiliations.length === 0);
  const items = present([
    {
      term: "Authors",
      description: namesOnly
        ? record.authors.length > 0
          ? <span className="leading-relaxed">{record.authors.map((author) => author.name).join(", ")}</span>
          : undefined
        : record.authors.map((author, index) => {
        const orcid = orcidUrl(author.orcid);
        return (
          <span key={`${author.name}-${index}`} className="flex flex-wrap items-baseline gap-x-2">
            <span className="font-medium">{author.name}</span>
            {orcid ? (
              <a href={orcid} rel="noopener noreferrer" target="_blank" className="text-text-muted text-xs underline underline-offset-2" aria-label={`ORCID of ${author.name}`}>
                ORCID
              </a>
            ) : null}
            {author.affiliations.length > 0 ? <span className="text-text-muted text-xs">{author.affiliations.join("; ")}</span> : null}
          </span>
        );
      }),
    },
    { term: "Research groups", description: record.groups.length > 0 ? <Chips values={record.groups} /> : undefined },
    { term: "Communities", description: record.communities.length > 0 ? <Chips values={record.communities.map((community) => community.label)} /> : undefined },
    { term: "Contact", description: record.contact ? <Contact text={record.contact} /> : undefined },
  ]);
  if (items.length === 0) return null;
  return (
    <RecordSection id="contributors" title="Contributors">
      <DefinitionList items={items} />
    </RecordSection>
  );
};

const LicenseSection = ({ record }: { record: RecordDetail }) => {
  const license = licenseText(record.license);
  if (!license) return null;
  return (
    <RecordSection id="license" title="License">
      <div className="flex max-w-prose flex-col gap-2 text-sm leading-relaxed">
        <p>{license}</p>
        {record.licenseUrl ? (
          <p>
            <External href={record.licenseUrl}>View the license text</External>
          </p>
        ) : null}
      </div>
    </RecordSection>
  );
};

const ReferencesSection = ({ record }: { record: RecordDetail }) => {
  const { citation, doi, links, pdbIds, uniprotIds } = record;
  const doiHref = doiUrl(doi);
  const items = present([
    {
      term: "Citation",
      description: citation ? (
        <span className="flex flex-col items-start gap-1.5">
          <span className="max-w-prose leading-relaxed">{citation}</span>
          <CopyButton text={citation} what="citation" label="Copy citation" variant="outline" />
        </span>
      ) : undefined,
    },
    { term: "DOI", description: doi ? (doiHref ? <External href={doiHref}>{doi}</External> : doi) : undefined },
    {
      term: "PDB",
      description:
        pdbIds.length > 0 ? (
          <span className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
            {pdbIds.map((id) => {
              const href = pdbUrl(id);
              return href ? (
                <External key={id} href={href}>
                  {id}
                </External>
              ) : (
                <span key={id}>{id}</span>
              );
            })}
          </span>
        ) : undefined,
    },
    {
      term: "UniProt",
      description:
        uniprotIds.length > 0 ? (
          <span className="flex flex-wrap gap-x-3 gap-y-1 font-mono">
            {uniprotIds.map((id) => {
              const href = uniprotUrl(id);
              return href ? (
                <External key={id} href={href}>
                  {id}
                </External>
              ) : (
                <span key={id}>{id}</span>
              );
            })}
          </span>
        ) : undefined,
    },
    // Links arrive already filtered to http(s) by the mapper.
    { term: "Links", description: links.map((link) => <External key={link.url} href={link.url}>{link.label}</External>) },
  ]);
  if (items.length === 0) return null;
  return (
    <RecordSection id="references" title="References">
      <DefinitionList items={items} />
    </RecordSection>
  );
};

const TrajectoriesSection = ({ record }: { record: RecordDetail }) => {
  const names = record.replicaNames;
  if (names.length === 0) return null;
  // Replica pages exist for MDposit records only; MDRepo records have no accession.
  const accession = record.accession;
  return (
    <RecordSection
      id="trajectories"
      title="MD trajectories"
      count={names.length}
      action={
        accession ? (
          <Link href={replicaHref(accession, names[0]!, "overview")} className={`text-sm font-medium ${LINK}`}>
            Explore experiments
          </Link>
        ) : undefined
      }
    >
      <ol className="divide-border/60 flex flex-col divide-y text-sm">
        {names.map((name, index) => (
          <li key={`${name}-${index}`} className="flex items-baseline gap-4 py-2.5 first:pt-0">
            <span className="text-text-muted w-6 shrink-0 text-right tabular-nums">{index + 1}</span>
            {accession ? (
              <Link href={replicaHref(accession, name)} className={`min-w-0 font-medium ${LINK}`}>
                {name}
              </Link>
            ) : (
              <span className="min-w-0 font-medium break-words">{name}</span>
            )}
          </li>
        ))}
      </ol>
    </RecordSection>
  );
};

const KeywordsSection = ({ record }: { record: RecordDetail }) => {
  if (record.keywords.length === 0) return null;
  return (
    <RecordSection id="keywords" title="Keywords">
      <ul className="flex flex-wrap gap-1.5">
        {record.keywords.map((keyword) => (
          <li key={keyword}>
            <Link
              href={recordsHref({ facets: { keyword: [keyword] } })}
              className="focus-visible:ring-border-focus/50 inline-flex rounded-md outline-none focus-visible:ring-[3px]"
            >
              <Badge variant="secondary" className="px-2 py-1 text-xs font-normal">
                {keyword}
              </Badge>
            </Link>
          </li>
        ))}
      </ul>
    </RecordSection>
  );
};

const AcknowledgementsSection = ({ record }: { record: RecordDetail }) => {
  if (!record.acknowledgements) return null;
  return (
    <RecordSection id="acknowledgements" title="Acknowledgements">
      <Muted className="max-w-prose leading-relaxed break-words whitespace-pre-line">{record.acknowledgements}</Muted>
    </RecordSection>
  );
};

export {
  AcknowledgementsSection,
  ContributorsSection,
  KeywordsSection,
  LicenseSection,
  ReferencesSection,
  SimulationSection,
  TrajectoriesSection,
};
