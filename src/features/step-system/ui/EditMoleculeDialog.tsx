"use client";

import { zodResolver } from "@hookform/resolvers/zod";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@e-infra/design-system";
import { Pencil, Trash2 } from "lucide-react";
import { useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { systemSchema, type Molecule, type MoleculeType } from "@/entities/deposition";
import { cn } from "@/shared/lib";
import { AdornedInput } from "@/shared/ui";
import { Icon } from "@/shared/ui/icons";
import { describeMolecule, MOLECULE_ICONS, MOLECULE_LABELS, MOLECULE_TYPES, PARAMETER_SETS } from "../lib/options";
import { cleanNumbers, nullsToUndefined, withCurrent } from "@/shared/lib";
import { FieldFrame } from "@/entities/deposition/ui";
import { NumberInput } from "@/entities/deposition/ui";

// The shared schema decides what a valid molecule looks like; the dialog adds only the "required" rules of each type.
const moleculeSchema = systemSchema.shape.molecules.unwrap().element;

type EditMoleculeDialogProps = {
  open: boolean;
  // The molecule being edited, or undefined when adding one.
  molecule: Molecule | undefined;
  onSave: (molecule: Molecule) => void;
  onRemove?: () => void;
  onClose: () => void;
};

const requiredFor = (type: MoleculeType | undefined): readonly (keyof Molecule)[] => {
  switch (type) {
    case "ligand":
      return ["name", "residueCode", "count", "parameters"];
    default:
      return ["name"];
  }
};

const REQUIRED_TEXT: Partial<Record<keyof Molecule, string>> = {
  name: "Name the molecule.",
  residueCode: "Enter the residue code.",
  count: "Enter the number of copies.",
  parameters: "Choose the parameters.",
};

const isMissing = (value: unknown): boolean =>
  value === undefined || value === null || value === "" || (typeof value === "number" && Number.isNaN(value));

const PROTEIN_LIKE: readonly MoleculeType[] = ["protein", "nucleic"];

// Edit molecule (BC 124:981) as a Dialog: type tiles, identity, parameters. Saving validates in place.
const EditMoleculeDialog = ({ open, molecule, onSave, onRemove, onClose }: EditMoleculeDialogProps) => {
  const form = useForm<Molecule>({
    resolver: ((values: unknown, context: unknown, options: never) =>
      zodResolver(moleculeSchema)(nullsToUndefined(values) as never, context as never, options)) as never,
    defaultValues: molecule ?? { type: "protein" },
    mode: "onBlur",
    reValidateMode: "onChange",
  });
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const { errors, isDirty } = form.formState;
  const type = useWatch({ control: form.control, name: "type" });
  const summary = describeMolecule({
    ...form.getValues(),
    ...(type && { type }),
  });

  const submit = form.handleSubmit((values) => {
    const missing = requiredFor(values.type).filter((key) => isMissing(values[key]));
    if (!values.type) form.setError("type", { message: "Choose the type." });
    for (const key of missing) form.setError(key, { message: REQUIRED_TEXT[key] ?? "Required." });
    if (missing.length > 0 || !values.type) return;
    onSave(cleanNumbers(values));
  });

  const requestClose = () => {
    if (isDirty) setConfirmDiscard(true);
    else onClose();
  };

  const messageOf = (key: keyof Molecule): string | undefined =>
    errors[key]?.message ? (REQUIRED_TEXT[key] ?? "Check this value.") : undefined;
  const showsResidues = type !== undefined && PROTEIN_LIKE.includes(type);

  return (
    <>
      <Dialog open={open} onOpenChange={(next) => (next ? undefined : requestClose())}>
        <DialogContent className="max-h-[90dvh] gap-0 overflow-y-auto p-0 sm:max-w-118">
          <DialogHeader className="border-border border-b px-5 py-4 text-left">
            <p className="text-text-muted flex items-center gap-1.5 text-[11px] font-semibold tracking-wider uppercase">
              <Pencil className="size-3" aria-hidden="true" />
              {molecule ? "Editing molecule" : "New molecule"}
            </p>
            <DialogTitle className="sr-only">{molecule ? "Edit molecule" : "Add molecule"}</DialogTitle>
            <DialogDescription className="sr-only">Type, identity and parameters of one molecule in the system.</DialogDescription>
            <div className="border-border flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
              <Icon name={MOLECULE_ICONS[type ?? "other"]} className="size-7 shrink-0" />
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold">{summary.title}</p>
                <p className="text-text-muted truncate text-[11px]">{summary.sub}</p>
              </div>
            </div>
          </DialogHeader>

          <form onSubmit={submit} noValidate className="flex flex-col gap-4 px-5 py-4">
            <FieldFrame
              sectionId="composition"
              path="molecule-type"
              label="Type"
              required
              group
              error={messageOf("type") && "Choose the type."}
            >
              {() => (
                <Controller
                  control={form.control}
                  name="type"
                  render={({ field }) => (
                    <div role="radiogroup" aria-label="Type" className="grid grid-cols-4 gap-2">
                      {MOLECULE_TYPES.map((option) => (
                        <button
                          key={option}
                          type="button"
                          role="radio"
                          aria-checked={field.value === option}
                          onClick={() => field.onChange(option)}
                          className={cn(
                            "border-border focus-visible:ring-border-focus flex h-14 flex-col items-center justify-center gap-1 rounded-lg border text-[11px] outline-none focus-visible:ring-2",
                            field.value === option && "border-text border-2 font-semibold",
                          )}
                        >
                          <Icon name={MOLECULE_ICONS[option]} className="size-5" />
                          {MOLECULE_LABELS[option]}
                        </button>
                      ))}
                    </div>
                  )}
                />
              )}
            </FieldFrame>

            <FieldFrame sectionId="composition" path="molecule-name" label="Name" required error={messageOf("name")}>
              {(ids) => (
                <Controller
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <Input {...ids} value={field.value ?? ""} onChange={field.onChange} onBlur={field.onBlur} autoComplete="off" />
                  )}
                />
              )}
            </FieldFrame>

            <div className="grid gap-3 sm:grid-cols-2">
              {type === "ligand" ? (
                <FieldFrame sectionId="composition" path="molecule-code" label="Residue code" required error={messageOf("residueCode")}>
                  {(ids) => (
                    <Controller
                      control={form.control}
                      name="residueCode"
                      render={({ field }) => (
                        <Input
                          {...ids}
                          value={field.value ?? ""}
                          onChange={field.onChange}
                          onBlur={field.onBlur}
                          placeholder="e.g. NAG"
                          autoComplete="off"
                        />
                      )}
                    />
                  )}
                </FieldFrame>
              ) : null}
              {showsResidues ? (
                <FieldFrame
                  sectionId="composition"
                  path="molecule-residues"
                  label="Residues"
                  labelNote="Optional"
                  error={messageOf("residues")}
                >
                  {(ids) => (
                    <Controller
                      control={form.control}
                      name="residues"
                      render={({ field }) => (
                        <NumberInput {...ids} integer value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                      )}
                    />
                  )}
                </FieldFrame>
              ) : null}
              {showsResidues ? (
                <FieldFrame
                  sectionId="composition"
                  path="molecule-chains"
                  label="Chains"
                  labelNote="Optional"
                  hint="Separate with commas, e.g. A, B."
                >
                  {(ids) => (
                    <Controller
                      control={form.control}
                      name="chains"
                      render={({ field }) => (
                        <Input
                          {...ids}
                          value={(field.value ?? []).join(", ")}
                          onChange={(event) =>
                            field.onChange(
                              event.target.value
                                .split(",")
                                .map((chain) => chain.trim())
                                .filter(Boolean),
                            )
                          }
                          onBlur={field.onBlur}
                          autoComplete="off"
                        />
                      )}
                    />
                  )}
                </FieldFrame>
              ) : null}
              {type !== undefined && !showsResidues && type !== "ions" ? (
                <FieldFrame
                  sectionId="composition"
                  path="molecule-count"
                  label={type === "water" ? "Molecules" : "Copies"}
                  required={type === "ligand"}
                  labelNote={type === "ligand" ? undefined : "Optional"}
                  error={messageOf("count")}
                >
                  {(ids) => (
                    <Controller
                      control={form.control}
                      name="count"
                      render={({ field }) => (
                        <NumberInput {...ids} integer value={field.value} onChange={field.onChange} onBlur={field.onBlur} />
                      )}
                    />
                  )}
                </FieldFrame>
              ) : null}
              {type === "ions" ? (
                <FieldFrame
                  sectionId="composition"
                  path="molecule-concentration"
                  label="Concentration"
                  labelNote="Optional"
                  error={messageOf("concentrationMM")}
                >
                  {(ids) => (
                    <Controller
                      control={form.control}
                      name="concentrationMM"
                      render={({ field }) => (
                        <NumberInput {...ids} value={field.value} onChange={field.onChange} onBlur={field.onBlur} endAdornment="mM" />
                      )}
                    />
                  )}
                </FieldFrame>
              ) : null}
            </div>

            {type !== undefined ? (
              <>
                <hr className="border-border" />
                <p className="text-text-muted text-[11px] font-semibold tracking-wider uppercase">Parameters</p>
                <FieldFrame
                  sectionId="composition"
                  path="molecule-parameters"
                  label={type === "water" ? "Water model" : "Parameters"}
                  required={type === "ligand"}
                  labelNote={type === "ligand" ? undefined : "Optional"}
                  error={messageOf("parameters")}
                >
                  {(ids) => (
                    <Controller
                      control={form.control}
                      name="parameters"
                      render={({ field }) => (
                        <Select value={field.value ?? ""} onValueChange={(next) => next && field.onChange(next)}>
                          <SelectTrigger {...ids} className="w-full" onBlur={field.onBlur}>
                            <SelectValue placeholder="Choose">{field.value}</SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {withCurrent(type === "water" ? ["TIP3P", "TIP4P", "SPC/E", "OPC"] : PARAMETER_SETS, field.value).map(
                              (option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ),
                            )}
                          </SelectContent>
                        </Select>
                      )}
                    />
                  )}
                </FieldFrame>
                {type === "ligand" ? (
                  <div className="grid gap-3 sm:grid-cols-2">
                    <FieldFrame sectionId="composition" path="molecule-generated" label="Generated with" labelNote="Optional">
                      {(ids) => (
                        <Controller
                          control={form.control}
                          name="generatedWith"
                          render={({ field }) => (
                            <AdornedInput
                              {...ids}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              placeholder="e.g. CGenFF server, ACPYPE"
                            />
                          )}
                        />
                      )}
                    </FieldFrame>
                    <FieldFrame sectionId="composition" path="molecule-charge" label="Charge method" labelNote="Optional">
                      {(ids) => (
                        <Controller
                          control={form.control}
                          name="chargeMethod"
                          render={({ field }) => (
                            <AdornedInput
                              {...ids}
                              value={field.value ?? ""}
                              onChange={field.onChange}
                              onBlur={field.onBlur}
                              placeholder="e.g. AM1-BCC, RESP"
                            />
                          )}
                        />
                      )}
                    </FieldFrame>
                  </div>
                ) : null}
              </>
            ) : null}

            <DialogFooter className="border-border -mx-5 mt-2 flex-row items-center gap-2 border-t px-5 pt-4 sm:justify-between">
              {molecule && onRemove ? (
                <Button type="button" variant="outline" className="text-error-700 border-error-700/40" onClick={onRemove}>
                  <Trash2 className="size-4" aria-hidden="true" />
                  Remove
                </Button>
              ) : (
                <span />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={requestClose}>
                  Cancel
                </Button>
                <Button type="submit">Save molecule</Button>
              </div>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Discard changes to this molecule?</AlertDialogTitle>
            <AlertDialogDescription>Your edits in this window will be lost.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep editing</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setConfirmDiscard(false);
                onClose();
              }}
            >
              Discard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export { EditMoleculeDialog };
export type { EditMoleculeDialogProps };
