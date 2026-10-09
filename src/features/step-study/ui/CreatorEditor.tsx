"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import {
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
  ToggleGroup,
  ToggleGroupItem,
} from "@e-infra/design-system";
import { CircleCheck, LoaderCircle } from "lucide-react";
import { useEffect, useState, type FormEvent } from "react";
import { Controller, useForm, useWatch, type Resolver } from "react-hook-form";
import { isValidOrcid, studySchema, type Creator } from "@/entities/deposition";
import { useLookups } from "../api/lookups";
import { ROLES } from "../model/creators";
import { formatMessage } from "../model/messages";
import { EditorField } from "./EditorField";
import { OrganisationPicker } from "./OrganisationPicker";

const creatorSchema = studySchema.shape.authors.unwrap().element;

type LookupState = "idle" | "checking" | "verified" | "not_found";

type CreatorEditorProps = {
  initial: Creator | null;
  // Wording only: authors are cited, contributors are not.
  group: "author" | "contributor";
  onSave: (creator: Creator) => void;
  onClose: () => void;
};

const isBlank = (value: string | undefined): boolean => (value ?? "").trim() === "";

const blankCreator = (): Creator => creatorSchema.parse({ kind: "person" });

// Author editor (53:623) as a dialog. It validates formats on blur like the page and names on save.
const CreatorEditor = ({ initial, group, onSave, onClose }: CreatorEditorProps) => {
  const lookups = useLookups();
  const form = useForm<Creator>({
    defaultValues: initial ?? blankCreator(),
    resolver: zodResolver(creatorSchema) as unknown as Resolver<Creator>,
    mode: "onTouched",
  });
  const { control, register, setValue, getValues, setError, formState } = form;
  const kind = useWatch({ control, name: "kind" });
  const orcid = useWatch({ control, name: "orcid" }) ?? "";
  const rorId = useWatch({ control, name: "rorId" }) ?? "";
  const errors = formState.errors;

  // Results are keyed by the looked-up value, so the shown state is derived: idle when not eligible, checking until
  // the answer for the current value arrives.
  const [orcidResult, setOrcidResult] = useState<{ value: string; status: LookupState } | null>(null);
  const [rorResult, setRorResult] = useState<{ value: string; status: LookupState } | null>(null);
  const orcidEligible = kind === "person" && isValidOrcid(orcid);
  const rorEligible =
    kind === "organization" && rorId !== "" && formatMessage(errors.rorId?.message) === null && /^(?:https:\/\/ror\.org\/)?0[a-z0-9]{8}$/i.test(rorId);
  const orcidState: LookupState = !orcidEligible ? "idle" : orcidResult?.value === orcid ? orcidResult.status : "checking";
  const rorState: LookupState = !rorEligible ? "idle" : rorResult?.value === rorId ? rorResult.status : "checking";

  useEffect(() => {
    if (!orcidEligible) return;
    let stale = false;
    void lookups.orcid(orcid).then((result) => {
      if (stale) return;
      setOrcidResult({ value: orcid, status: result.status });
      if (result.status !== "verified") return;
      if (isBlank(getValues("givenName"))) setValue("givenName", result.record.givenName);
      if (isBlank(getValues("familyName"))) setValue("familyName", result.record.familyName);
    });
    return () => {
      stale = true;
    };
  }, [orcid, orcidEligible, lookups, getValues, setValue]);

  useEffect(() => {
    if (!rorEligible) return;
    let stale = false;
    void lookups.organisationByRor(rorId).then((org) => {
      if (stale) return;
      setRorResult({ value: rorId, status: org ? "verified" : "not_found" });
      if (org && isBlank(getValues("name"))) setValue("name", org.name);
    });
    return () => {
      stale = true;
    };
  }, [rorId, rorEligible, lookups, getValues, setValue]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    // The editor is portalled but React bubbles its events to the page form; keep the page form out of it.
    event.stopPropagation();
    const valid = await form.trigger();
    const values = getValues();
    let complete = true;
    if (values.kind === "organization") {
      if (isBlank(values.name)) {
        setError("name", { message: "Enter the organization name." });
        complete = false;
      }
    } else {
      if (isBlank(values.givenName)) {
        setError("givenName", { message: "Enter the given name." });
        complete = false;
      }
      if (isBlank(values.familyName)) {
        setError("familyName", { message: "Enter the family name." });
        complete = false;
      }
    }
    if (!valid || !complete) return;
    onSave(
      values.kind === "organization"
        ? { kind: "organization", name: values.name?.trim() ?? "", ...(values.rorId ? { rorId: values.rorId } : {}), affiliations: [] }
        : {
            kind: "person",
            givenName: values.givenName?.trim() ?? "",
            familyName: values.familyName?.trim() ?? "",
            ...(values.role ? { role: values.role } : {}),
            ...(values.orcid ? { orcid: values.orcid } : {}),
            affiliations: values.affiliations,
          },
    );
  };

  const fieldError = (message: string | undefined): string | null =>
    message === undefined ? null : /^[a-z_]+$/.test(message) ? formatMessage(message) : message;
  const noun = group === "author" ? "author" : "contributor";

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? `Edit ${noun}` : `Add ${noun}`}</DialogTitle>
          <DialogDescription>
            {group === "author" ? "Authors are cited in this order." : "Contributors helped but are not part of the citation."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <Controller
            control={control}
            name="kind"
            render={({ field }) => (
              <ToggleGroup
                type="single"
                variant="outline"
                value={field.value}
                onValueChange={(next) => next && field.onChange(next)}
                aria-label={`${noun} type`}
                className="w-full"
              >
                <ToggleGroupItem value="person" className="flex-1">
                  Person
                </ToggleGroupItem>
                <ToggleGroupItem value="organization" className="flex-1">
                  Organization
                </ToggleGroupItem>
              </ToggleGroup>
            )}
          />

          {kind === "organization" ? (
            <>
              <EditorField label="Organization name" required error={fieldError(errors.name?.message)}>
                {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("name")} />}
              </EditorField>
              <EditorField
                label="ROR id"
                hint={rorState === "checking" ? "Checking ROR..." : "Optional. Looks like https://ror.org/02j46qs45."}
                error={fieldError(errors.rorId?.message) ?? (rorState === "not_found" ? "No ROR record found for this ID." : null)}
              >
                {({ id, describedBy, invalid }) => (
                  <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} placeholder="https://ror.org/..." {...register("rorId")} />
                )}
              </EditorField>
            </>
          ) : (
            <>
              <EditorField label="Role" className="sm:w-1/2">
                {({ id }) => (
                  <Controller
                    control={control}
                    name="role"
                    render={({ field }) => (
                      <Select value={field.value ?? ""} onValueChange={field.onChange}>
                        <SelectTrigger id={id} className="w-full">
                          <SelectValue placeholder="Choose a role" />
                        </SelectTrigger>
                        <SelectContent>
                          {ROLES.map((role) => (
                            <SelectItem key={role} value={role}>
                              {role}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                )}
              </EditorField>
              <EditorField
                label="ORCID"
                hint={orcidState === "checking" ? "Checking ORCID..." : "Optional. Looks like 0000-0002-1825-0097."}
                error={fieldError(errors.orcid?.message) ?? (orcidState === "not_found" ? "No ORCID record found for this ID." : null)}
              >
                {({ id, describedBy, invalid }) => (
                  <div className="relative">
                    <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} className="pr-24" {...register("orcid")} />
                    <span className="absolute inset-y-0 right-3 flex items-center gap-1 text-[11px] font-medium">
                      {orcidState === "checking" ? <LoaderCircle className="text-text-muted size-3.5 animate-spin" aria-hidden="true" /> : null}
                      {orcidState === "verified" ? (
                        <span className="text-success-700 flex items-center gap-1">
                          <CircleCheck className="size-3.5" aria-hidden="true" />
                          Verified
                        </span>
                      ) : null}
                    </span>
                  </div>
                )}
              </EditorField>
              <div className="grid gap-4 sm:grid-cols-2">
                <EditorField label="Given name" required error={fieldError(errors.givenName?.message)}>
                  {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("givenName")} />}
                </EditorField>
                <EditorField label="Family name" required error={fieldError(errors.familyName?.message)}>
                  {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} {...register("familyName")} />}
                </EditorField>
              </div>
              <EditorField label="Affiliations">
                {({ id }) => (
                  <Controller
                    control={control}
                    name="affiliations"
                    render={({ field }) => (
                      <OrganisationPicker
                        id={id}
                        label="Affiliations"
                        multiple
                        placeholder="Search organisations"
                        value={field.value}
                        onChange={field.onChange}
                      />
                    )}
                  />
                )}
              </EditorField>
            </>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{initial ? "Save" : `Add ${noun}`}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { CreatorEditor };
export type { CreatorEditorProps };
