"use client";

import { Loader2 } from "lucide-react";
import { useId, useState, type FormEvent } from "react";
import { estimateTrajectoryBytes, trajectoryRequestSchema } from "@/entities/replica";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  Button,
  Input,
  Label,
} from "@/shared/ui";
import { formatBytes } from "../model/formatBytes";
import type { TrajectoryInputs } from "../model/useTrajectoryRequest";

// Above this estimate the browser may struggle to hold the frames, so the user confirms first (experiment-details T8).
const SIZE_WARNING_BYTES = 250_000_000;
const FRAMES_PLACEHOLDER = "1:1000:10";

type FieldName = keyof TrajectoryInputs;
type FieldErrors = Partial<Record<FieldName, string>>;

type TrajectoryFormProps = {
  initialValues: TrajectoryInputs;
  atoms: number | null;
  totalFrames: number | null;
  busy: boolean;
  onSubmit: (inputs: TrajectoryInputs) => void;
  onCancel: () => void;
  // Messages for fields the server rejected; hidden again once that field is edited.
  serverFieldErrors?: FieldErrors;
};

const validate = ({ frames, selection }: TrajectoryInputs): FieldErrors => {
  const result = trajectoryRequestSchema.safeParse({
    frames: frames === "" ? undefined : frames,
    selection: selection === "" ? undefined : selection,
  });
  if (result.success) return {};
  const errors: FieldErrors = {};
  for (const issue of result.error.issues) {
    const field = issue.path[0];
    if ((field === "frames" || field === "selection") && errors[field] === undefined) errors[field] = issue.message;
  }
  return errors;
};

const FieldMessage = ({ id, error, hint }: { id: string; error: string | undefined; hint: string }) =>
  error ? (
    <p id={id} role="alert" className="text-error-700 text-xs">
      {error}
    </p>
  ) : (
    <p id={id} className="text-text-muted text-xs">
      {hint}
    </p>
  );

const TrajectoryForm = ({ initialValues, atoms, totalFrames, busy, onSubmit, onCancel, serverFieldErrors }: TrajectoryFormProps) => {
  const [frames, setFrames] = useState(initialValues.frames);
  const [selection, setSelection] = useState(initialValues.selection);
  const [clientErrors, setClientErrors] = useState<FieldErrors>({});
  const [edited, setEdited] = useState<Partial<Record<FieldName, boolean>>>({});
  const [pending, setPending] = useState<{ inputs: TrajectoryInputs; bytes: number } | null>(null);
  const framesId = useId();
  const selectionId = useId();

  const errors: FieldErrors = {
    frames: clientErrors.frames ?? (edited.frames ? undefined : serverFieldErrors?.frames),
    selection: clientErrors.selection ?? (edited.selection ? undefined : serverFieldErrors?.selection),
  };

  const edit = (field: FieldName, value: string) => {
    if (field === "frames") setFrames(value);
    else setSelection(value);
    setClientErrors((current) => ({ ...current, [field]: undefined }));
    setEdited((current) => ({ ...current, [field]: true }));
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (busy) return;
    const inputs = { frames: frames.trim(), selection: selection.trim() };
    const found = validate(inputs);
    setClientErrors(found);
    setEdited({});
    if (found.frames || found.selection) return;
    const bytes = estimateTrajectoryBytes(inputs.frames === "" ? undefined : inputs.frames, atoms, totalFrames);
    if (bytes !== null && bytes > SIZE_WARNING_BYTES) {
      setPending({ inputs, bytes });
      return;
    }
    onSubmit(inputs);
  };

  return (
    <>
      <form onSubmit={submit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={framesId}>Frame window</Label>
            <Input
              id={framesId}
              value={frames}
              placeholder={FRAMES_PLACEHOLDER}
              inputMode="numeric"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              aria-invalid={errors.frames ? true : undefined}
              aria-describedby={`${framesId}-hint`}
              className="max-md:h-11"
              onChange={(event) => edit("frames", event.target.value)}
            />
            <FieldMessage id={`${framesId}-hint`} error={errors.frames} hint="start:end:stride, counted from 1. Empty loads every frame." />
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor={selectionId}>Selection (optional)</Label>
            <Input
              id={selectionId}
              value={selection}
              placeholder="protein and name CA"
              autoComplete="off"
              spellCheck={false}
              disabled={busy}
              aria-invalid={errors.selection ? true : undefined}
              aria-describedby={`${selectionId}-hint`}
              className="max-md:h-11"
              onChange={(event) => edit("selection", event.target.value)}
            />
            <FieldMessage id={`${selectionId}-hint`} error={errors.selection} hint="MDAnalysis syntax. Applies to the structure and the frames." />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {busy ? (
            <>
              <Button key="cancel" type="button" variant="outline" className="max-md:min-h-11" onClick={onCancel}>
                Cancel
              </Button>
              <span role="status" className="text-text-muted inline-flex items-center gap-2 text-sm">
                <Loader2 aria-hidden className="size-4 animate-spin" />
                Loading trajectory
              </span>
            </>
          ) : (
            <Button key="submit" type="submit" className="max-md:min-h-11">
              Load trajectory
            </Button>
          )}
        </div>
      </form>
      <AlertDialog open={pending !== null} onOpenChange={(open) => (open ? undefined : setPending(null))}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Large download</AlertDialogTitle>
            <AlertDialogDescription>
              This request may transfer up to {pending ? formatBytes(pending.bytes) : ""} and is held in your browser memory while it plays. A
              stride or a shorter frame window keeps it small.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Change the request</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (pending) onSubmit(pending.inputs);
                setPending(null);
              }}
            >
              Download anyway
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export { TrajectoryForm };
export type { TrajectoryFormProps };
