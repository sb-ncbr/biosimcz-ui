"use client";

import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Badge,
  Button,
} from "@e-infra/design-system";
import { CircleAlert, Sparkles, TriangleAlert, X } from "lucide-react";
import { useState } from "react";
import { fieldAnchor } from "@/entities/deposition";
import type { UploadItem } from "@/features/upload";
import { uniqueLabels, type PrefillChange, type PrefillGroup } from "../lib/prefill";
import type { PrefillReport } from "../model/useSystemUploads";

type PrefillCalloutsProps = {
  items: readonly UploadItem[];
  reports: readonly PrefillReport[];
  onDismiss: (id: string) => void;
  onApplyKept: (id: string) => void;
  onGoTo: (anchor: string) => void;
};

const plural = (count: number, one: string): string => `${count} ${one}${count === 1 ? "" : "s"}`;

const listOf = (labels: readonly string[]): string => labels.join(", ").replace(/, ([^,]*)$/, " and $1");

const showValue = (value: unknown): string => {
  if (Array.isArray(value)) return plural(value.length, "item");
  if (typeof value === "object" && value !== null) {
    const record = value as { title?: string; id?: string };
    return [record.title, record.id].filter(Boolean).join(" ") || "set";
  }
  return String(value ?? "empty");
};

// A pill that jumps to its field ("Go to field"); values without an input stay plain.
const FieldPill = ({ group, onGoTo, tone }: { group: PrefillGroup; onGoTo: (anchor: string) => void; tone: "success" | "warning" }) => {
  const anchor = group.anchor;
  if (!anchor) return <Badge variant="outline">{group.label}</Badge>;
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-tone={tone}
      className="h-6 rounded-full px-2.5 text-[11px]"
      onClick={() => onGoTo(anchor)}
    >
      {group.label}
    </Button>
  );
};

const DismissButton = ({ label, onClick }: { label: string; onClick: () => void }) => (
  <Button type="button" variant="ghost" size="icon-sm" aria-label={label} onClick={onClick} className="-mt-1 -mr-2">
    <X className="size-4" aria-hidden="true" />
  </Button>
);

const KeptNotice = ({ report, onApply }: { report: PrefillReport; onApply: () => void }) => {
  const [open, setOpen] = useState(false);
  const labels = uniqueLabels(report.kept).map((group) => group.label);
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
      <span>
        Kept your value for {listOf(labels)}. {report.file} has {report.kept.length === 1 ? "a different one" : "different ones"}.
      </span>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <Button type="button" variant="link" size="sm" className="h-auto p-0" onClick={() => setOpen(true)}>
          Use values from {report.file}
        </Button>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              Replace {plural(labels.length, "value")} with the ones from {report.file}?
            </AlertDialogTitle>
            <AlertDialogDescription>This overwrites what you entered. You can change the fields again afterwards.</AlertDialogDescription>
          </AlertDialogHeader>
          <ul className="text-sm">
            {report.kept.map((change: PrefillChange) => (
              <li key={change.path} className="flex flex-wrap gap-x-2 py-0.5">
                <span className="font-medium">{change.label}</span>
                <span className="text-text-muted">
                  {showValue(change.current)} to {showValue(change.value)}
                </span>
              </li>
            ))}
          </ul>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep my values</AlertDialogCancel>
            <AlertDialogAction onClick={onApply}>Replace values</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

// The three callouts of the approved states: success (120:266), no topology (120:414), could not read (120:536).
const PrefillCallouts = ({ items, reports, onDismiss, onApplyKept, onGoTo }: PrefillCalloutsProps) => {
  const stored = items.filter((item) => item.status === "done");
  const unreadable = stored.filter((item) => item.parse?.status === "unreadable");
  const noTopology =
    stored.length > 0 &&
    !stored.some((item) => (item.role === "topology" || item.role === "run_input") && item.parse?.status !== "unreadable");
  const anyBusy = items.some(
    (item) =>
      item.status === "queued" ||
      item.status === "initiating" ||
      item.status === "uploading" ||
      item.status === "committing" ||
      item.status === "parsing",
  );

  return (
    <div className="flex flex-col gap-2">
      {reports.map((report) => (
        <Alert key={report.id} variant="success" className="[&>svg]:mt-0.5" data-testid="prefill-callout">
          <Sparkles aria-hidden="true" />
          <AlertDescription className="text-text flex flex-col gap-2">
            <div className="flex items-start justify-between gap-2">
              <p>
                {report.filled.length > 0 ? (
                  <>
                    <strong>
                      {plural(report.filled.length, "field")} filled in from {report.file}.
                    </strong>{" "}
                    Check them below and change anything that does not match.
                  </>
                ) : (
                  <strong>Nothing new to fill in from {report.file}.</strong>
                )}
              </p>
              <DismissButton label={`Dismiss message about ${report.file}`} onClick={() => onDismiss(report.id)} />
            </div>
            {report.filled.length > 0 ? (
              <ul aria-label="Filled in fields" className="flex flex-wrap gap-1.5">
                {report.filled.map((group) => (
                  <li key={group.label}>
                    <FieldPill group={group} onGoTo={onGoTo} tone="success" />
                  </li>
                ))}
              </ul>
            ) : null}
            {report.kept.length > 0 ? <KeptNotice report={report} onApply={() => onApplyKept(report.id)} /> : null}
          </AlertDescription>
        </Alert>
      ))}

      {unreadable.map((item) => (
        <Alert key={item.id} variant="error" data-testid="unreadable-callout">
          <CircleAlert aria-hidden="true" />
          <AlertDescription className="text-text">
            <p>
              <strong>We could not read {item.name}.</strong> The file is stored with your deposition, it just needs the molecules and force
              field entered by hand below.
            </p>
          </AlertDescription>
        </Alert>
      ))}

      {noTopology && !anyBusy ? (
        <Alert variant="warning" data-testid="no-topology-callout">
          <TriangleAlert aria-hidden="true" />
          <AlertDescription className="text-text flex flex-col gap-2">
            <p>
              <strong>No topology file yet.</strong> Add a .top, .tpr or .prmtop and we can also fill in the molecules and force field.
              Without it you can enter them by hand.
            </p>
            <ul aria-label="Fields to enter by hand" className="flex flex-wrap gap-1.5">
              {[
                {
                  label: "System size",
                  anchor: fieldAnchor("dimensions", "systemSize"),
                },
                {
                  label: "Box shape",
                  anchor: fieldAnchor("dimensions", "box.shape"),
                },
                {
                  label: "Box vectors",
                  anchor: fieldAnchor("dimensions", "box.vectors"),
                },
              ].map((group) => (
                <li key={group.label}>
                  <FieldPill group={group} onGoTo={onGoTo} tone="warning" />
                </li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      ) : null}
    </div>
  );
};

export { PrefillCallouts };
export type { PrefillCalloutsProps };
