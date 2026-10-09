import type { ReactNode } from "react";
import { Card, H3, Muted } from "@/shared/ui";

// No deposition at all (missing-states 4.1): filters and controls are hidden, one call to action.
const EmptyDepositions = ({ action }: { action: ReactNode }) => (
  <Card className="border-border mx-auto mt-16 w-full max-w-120 items-center gap-3 border p-8 text-center drop-shadow-none">
    <H3>No depositions yet</H3>
    <Muted>Start a deposition to publish your molecular dynamics simulation. Drafts are saved as you go, so you can finish later.</Muted>
    <div className="mt-2">{action}</div>
  </Card>
);

export { EmptyDepositions };
