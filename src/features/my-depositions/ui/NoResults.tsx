"use client";

import type { ReactNode } from "react";
import { Button, H3, Muted } from "@/shared/ui";
import { clearFilters, hasActiveFilters, setSearch, setStatus } from "../model/urlState";
import { useListNavigation } from "./ListNavigation";

const Panel = ({ title, text, children }: { title: string; text: string; children: ReactNode }) => (
  <div className="flex flex-col items-center gap-3 py-16 text-center">
    <H3>{title}</H3>
    <Muted>{text}</Muted>
    <div className="mt-1 flex flex-wrap justify-center gap-2">{children}</div>
  </div>
);

// The list is empty although the user owns depositions (missing-states 4.2): the copy depends on why.
const NoResults = ({ newDeposition }: { newDeposition: ReactNode }) => {
  const { query, navigate } = useListNavigation();
  const filtered = hasActiveFilters(query);
  const searching = query.q !== "";

  if (filtered || searching) {
    return (
      <Panel title="No depositions match" text="Try removing a filter or changing the search.">
        {filtered ? (
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(clearFilters(query))}>
            Clear all filters
          </Button>
        ) : null}
        {searching ? (
          <Button type="button" variant="outline" size="sm" onClick={() => navigate(setSearch(query, ""), "replace")}>
            Clear search
          </Button>
        ) : null}
      </Panel>
    );
  }
  if (query.status === "published") {
    return (
      <Panel title="Nothing published yet" text="Drafts stay under Draft until you publish them.">
        <Button type="button" variant="link" size="sm" onClick={() => navigate(setStatus(query, "draft"))}>
          Show drafts
        </Button>
      </Panel>
    );
  }
  return (
    <Panel title="No drafts" text="Everything you started is published.">
      {newDeposition}
    </Panel>
  );
};

export { NoResults };
