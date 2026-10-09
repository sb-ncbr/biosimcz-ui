"use client";

import { useState, type FormEvent } from "react";
import type { FacetSpec } from "@/entities/record";
import { Button, FacetBlock, Input } from "@/shared/ui";
import { facetValues, setRecordFacet } from "../model/urlState";
import { useRecordNavigation } from "./RecordNavigation";

// "At least N" facet: a number box and an Apply button, so typing does not trigger a request per digit.
const MinNumberFacet = ({ spec }: { spec: FacetSpec }) => {
  const { query, navigate } = useRecordNavigation();
  const current = facetValues(query, spec.name)[0] ?? "";
  const [draft, setDraft] = useState<string | null>(null);
  const value = draft ?? current;

  const apply = (event: FormEvent) => {
    event.preventDefault();
    navigate(
      setRecordFacet(query, spec, value.trim() === "" ? [] : [value.trim()]),
    );
    setDraft(null);
  };

  return (
    <FacetBlock title={spec.title} selectedCount={current === "" ? 0 : 1}>
      <form onSubmit={apply} className="flex items-center gap-2">
        <Input
          type="number"
          inputMode="numeric"
          min={0}
          step={1}
          value={value}
          onChange={(event) => setDraft(event.target.value)}
          aria-label={spec.title}
          className="h-8 min-w-0 flex-1 text-xs max-md:h-11"
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          className="max-md:min-h-11"
        >
          Apply
        </Button>
      </form>
    </FacetBlock>
  );
};

export { MinNumberFacet };
