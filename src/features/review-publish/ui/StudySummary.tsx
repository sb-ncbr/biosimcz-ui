"use client";

import { draftHref, type StepResult, type Study } from "@/entities/deposition";
import { StepSummary, type SummaryGroup } from "@/entities/deposition/ui";
import { labelOf, RELATIONS, SCHEMES } from "@/features/step-study";
import { Badge } from "@/shared/ui";
import { accessLabel, accessNote, licenseLabel } from "../model/format";
import type { MissingLookup } from "../model/problems";
import { useCommunity } from "../model/useCommunity";
import { FundingRow, orMissing, PersonRow, Secondary } from "./values";

// Review wording of the relations (226:5484 "Supplement to", "Derived from").
const RELATION_TERM: Record<string, string> = {
  supplement_to: "Supplement to",
  derived_from: "Derived from",
  part_of: "Part of",
  cited_by: "Cited by",
  version_of: "New version of",
};

type StudySummaryProps = { draftId: string; study: Study; result: StepResult; find: MissingLookup };

const relatedGroup = (study: Study): SummaryGroup | null => {
  const named = study.relatedWorks.filter((work) => work.identifier?.trim());
  if (named.length === 0) return null;
  const byRelation = new Map<string, typeof named>();
  for (const work of named) {
    const term = RELATION_TERM[work.relation ?? ""] ?? (labelOf(RELATIONS, work.relation) || "Related to");
    byRelation.set(term, [...(byRelation.get(term) ?? []), work]);
  }
  return {
    title: "Related work",
    items: [...byRelation].map(([term, works]) => ({
      term,
      description: works.map((work) => (
        <span key={work.identifier} className="flex flex-wrap items-center gap-2">
          {work.scheme ? (
            <Badge variant="secondary" className="rounded-[4px] px-[7px] py-0.5 text-[10px] font-medium">
              {labelOf(SCHEMES, work.scheme)}
            </Badge>
          ) : null}
          <span className="font-medium">{work.identifier}</span>
        </span>
      )),
    })),
  };
};

const StudySummary = ({ draftId, study, result, find }: StudySummaryProps) => {
  const community = useCommunity(study.communityId);
  const missing = (path: string) => find("study", path);
  const creators = (list: Study["authors"]) => list.filter((creator) => creator.givenName || creator.familyName || creator.name);
  const authors = creators(study.authors);
  const contributors = creators(study.contributors);
  const funding = study.funding.filter((item) => item.funderName?.trim());
  const keywords = study.keywords.filter(Boolean);

  const groups: SummaryGroup[] = [
    {
      title: "Basics",
      items: [
        { term: "Title", description: orMissing(draftId, missing("title"), study.title?.trim() || undefined) },
        { term: "Description", description: orMissing(draftId, missing("description"), study.description?.trim() || undefined) },
        { term: "DOI", description: study.doi?.trim() || undefined },
        {
          term: "Keywords",
          description:
            keywords.length > 0
              ? [
                  <span key="keywords" className="flex flex-wrap gap-1.5">
                    {keywords.map((keyword) => (
                      <Badge key={keyword} variant="secondary" className="px-2 py-1 text-xs font-normal">
                        {keyword}
                      </Badge>
                    ))}
                  </span>,
                ]
              : undefined,
        },
      ],
    },
    {
      title: "Credits",
      items: [
        {
          term: "Authors",
          description: orMissing(
            draftId,
            missing("authors"),
            authors.map((creator, index) => <PersonRow key={index} creator={creator} />),
          ),
        },
        { term: "Contributors", description: contributors.map((creator, index) => <PersonRow key={index} creator={creator} />) },
        { term: "Funding", description: funding.map((item, index) => <FundingRow key={index} funding={item} />) },
      ],
    },
    {
      title: "Publishing",
      items: [
        {
          term: "Community",
          description: orMissing(
            draftId,
            missing("communityId"),
            study.communityId ? (
              <span className="flex items-center gap-2">
                <span aria-hidden="true" className="bg-base-200 flex size-[18px] shrink-0 items-center justify-center rounded-[4px] text-[9px] font-bold">
                  {(community?.name ?? study.communityId).charAt(0).toUpperCase()}
                </span>
                <span className="font-medium">{community?.name ?? study.communityId}</span>
                {community ? <Secondary>{community.url}</Secondary> : null}
              </span>
            ) : undefined,
          ),
        },
        {
          term: "Access",
          description: orMissing(
            draftId,
            missing("access"),
            study.access ? (
              <span>
                <span className="font-medium">{accessLabel(study)}</span>
                <Secondary>{accessNote(study)}</Secondary>
              </span>
            ) : undefined,
          ),
        },
        ...(study.access === "embargoed" && missing("embargo.until")
          ? [{ term: "Open on", description: orMissing(draftId, missing("embargo.until"), undefined) }]
          : []),
        { term: "License", description: orMissing(draftId, missing("license"), study.license ? licenseLabel(study) : undefined) },
        { term: "Publisher", description: "MDRepo" },
      ],
    },
  ];
  const related = relatedGroup(study);
  if (related) groups.push(related);

  return (
    <StepSummary
      id="review-study"
      title={result.title}
      status={result.status}
      requiredLeft={result.requiredLeft}
      toFix={result.toFix}
      editHref={draftHref(draftId, "study")}
      groups={groups}
    />
  );
};

export { StudySummary };
