"use client";

import { useState } from "react";
import { DefinitionList, SegmentedProgress, StepStatusIcon, type StepStatus } from "@/entities/deposition/ui";
import { AdornedInput, Button, CountBadge, FacetHistogram, GhostSection, GhostSectionList, Icon, iconNames, StatusPill, TagInput } from "@/shared/ui";
import { StructureViewer, structureUrlFor } from "@/shared/viewers/molstar";

const STATUSES: StepStatus[] = ["done", "partial", "todo", "error"];

const Block = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-border flex flex-col gap-3 border-b pb-6">
    <h2 className="text-sm font-semibold">{title}</h2>
    {children}
  </section>
);

const PrimitivesPreview = () => {
  const [tags, setTags] = useState(["lysozyme", "protein dynamics"]);
  const [year, setYear] = useState<string | null>("2025");
  const [ghosts, setGhosts] = useState(["Related work"]);

  return (
    <main className="mx-auto flex max-w-160 flex-col gap-6 px-4 py-8">
      <h1 className="text-2xl font-bold">Primitives preview</h1>

      <Block title="StructureViewer (MD-A00001, live MDposit)">
        <StructureViewer structureUrl={structureUrlFor("MD-A00001")} title="MD-A00001" height={360} />
      </Block>

      <Block title="StepStatusIcon (14 / 16)">
        <ul className="flex flex-wrap gap-4 text-sm">
          {STATUSES.map((status) => (
            <li key={status} className="flex items-center gap-2">
              <StepStatusIcon status={status} />
              <StepStatusIcon status={status} size={16} />
              {status}
            </li>
          ))}
        </ul>
      </Block>

      <Block title="SegmentedProgress (focus a segment for the tooltip)">
        <SegmentedProgress
          aria-label="Deposition progress"
          segments={[
            { id: "study", label: "Study details", value: 1, tooltip: "11 of 11 required fields - 100%" },
            { id: "system", label: "Molecular system", value: 0.64, tooltip: "5 of 8 required fields - 64%" },
            { id: "runs", label: "Experiments", value: 0, tooltip: "0 of 4 required fields - 0%" },
          ]}
        />
      </Block>

      <Block title="CountBadge and StatusPill">
        <div className="flex flex-wrap items-center gap-3">
          <CountBadge count={2} />
          <CountBadge count={3} variant="optional" />
          <CountBadge count={22} variant="count" />
          <StatusPill status="draft" />
          <StatusPill status="published" />
          <StatusPill status="embargoed" />
          <StatusPill status="changes_requested" />
        </div>
      </Block>

      <Block title="TagInput">
        <TagInput
          label="Keywords"
          value={tags}
          onChange={setTags}
          suggestions={["molecular dynamics", "membrane", "lysozyme", "GROMACS"]}
          placeholder="Search or add keywords"
        />
      </Block>

      <Block title="AdornedInput">
        <div className="grid grid-cols-3 gap-3">
          <AdornedInput aria-label="Box X" startAdornment="X" endAdornment="nm" defaultValue="6.82" />
          <AdornedInput aria-label="Box Y" startAdornment="Y" endAdornment="nm" defaultValue="7.14" />
          <AdornedInput aria-label="Box Z" startAdornment="Z" endAdornment="nm" defaultValue="6.55" />
        </div>
        <AdornedInput
          aria-label="DOI"
          placeholder="Enter existing or generate a new one."
          trailing={
            <Button type="button" variant="secondary" size="sm" className="h-6 px-2 text-xs">
              Generate DOI
            </Button>
          }
        />
      </Block>

      <Block title="GhostSection">
        <GhostSectionList>
          {ghosts.map((title) => (
            <GhostSection
              key={title}
              title={title}
              description="Connect this dataset to papers, structures, and funding."
              onAdd={() => setGhosts((current) => current.filter((g) => g !== title))}
            />
          ))}
        </GhostSectionList>
        {ghosts.length === 0 ? <p className="text-text-muted text-sm">Added (reload to reset).</p> : null}
      </Block>

      <Block title="FacetHistogram">
        <FacetHistogram
          aria-label="Depositions by year"
          onBarClick={(key) => setYear((current) => (current === key ? null : key))}
          bars={[
            { key: "2022", label: "22", value: 2, selected: year === "2022" },
            { key: "2023", label: "23", value: 5, selected: year === "2023" },
            { key: "2024", label: "24", value: 9, selected: year === "2024" },
            { key: "2025", label: "25", value: 14, selected: year === "2025" },
            { key: "2026", label: "26", value: 6, selected: year === "2026" },
          ]}
        />
      </Block>

      <Block title="DefinitionList">
        <DefinitionList
          items={[
            { term: "Title", description: "Lysozyme in water" },
            { term: "Keywords", description: ["lysozyme", "protein dynamics"] },
            { term: "Experiment files" },
          ]}
        />
      </Block>

      <Block title={`Icons (${iconNames.length})`}>
        <ul className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-3">
          {iconNames.map((name) => (
            <li key={name} className="flex items-center gap-2">
              <Icon name={name} className="text-text" />
              {name}
            </li>
          ))}
        </ul>
      </Block>
    </main>
  );
};

export { PrimitivesPreview };
