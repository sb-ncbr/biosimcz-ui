"use client";

import type { FacetSpec } from "@/entities/record";
import { FacetBlock, TagInput } from "@/shared/ui";
import { facetValues, setRecordFacet } from "../model/urlState";
import { useRecordNavigation } from "./RecordNavigation";

// Free-text facet (author, group): Enter or comma adds a value, each value is a chip. The server matches it literally.
const TextFacet = ({ spec }: { spec: FacetSpec }) => {
  const { query, navigate } = useRecordNavigation();
  const selected = facetValues(query, spec.name);
  return (
    <FacetBlock title={spec.title} selectedCount={selected.length}>
      <TagInput
        label={spec.title}
        value={[...selected]}
        onChange={(next) => navigate(setRecordFacet(query, spec, next))}
        placeholder={`Add ${spec.title.toLowerCase()}`}
        addLabel={(text) => `Add ${spec.title.toLowerCase()} "${text}"`}
        removeLabel={(tag) => `Remove ${spec.title.toLowerCase()} ${tag}`}
      />
    </FacetBlock>
  );
};

export { TextFacet };
