"use client";

import {
  Button,
  Calendar,
  Input,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RadioGroup,
  RadioGroupItem,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@e-infra/design-system";
import { useQuery } from "@tanstack/react-query";
import { CalendarDays, Lock, LoaderCircle } from "lucide-react";
import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import { isValidIsoDate, type AccessValue } from "@/entities/deposition";
import { cn } from "@/shared/lib";
import { AdornedInput, Icon, TagInput } from "@/shared/ui";
import { useLookups } from "../api/lookups";
import { LICENSES } from "../model/lists";
import { CommunityCombobox } from "./CommunityCombobox";
import { useStudy } from "./context";
import { Field } from "./Field";
import { CreatorList, FundingList } from "./Lists";

const BasicsSection = () => {
  const { form, draftId } = useStudy();
  const lookups = useLookups();
  const [generating, setGenerating] = useState(false);
  const [doiError, setDoiError] = useState<string | null>(null);
  const [announce, setAnnounce] = useState("");
  const keywords = useWatch({ control: form.control, name: "keywords" });
  const suggestions = useQuery({ queryKey: ["study", "keywords"], queryFn: () => lookups.keywords("") });

  const generate = async () => {
    setGenerating(true);
    setDoiError(null);
    try {
      const doi = await lookups.generateDoi(draftId);
      form.setValue("doi", doi, { shouldDirty: true, shouldValidate: true });
      setAnnounce("DOI generated");
    } catch {
      setDoiError("We could not generate a DOI. Try again or enter an existing one.");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <Field sectionId="basics" path="title" label="Title" required hint="The main title for this publication.">
        {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} {...form.register("title")} />}
      </Field>

      <Field
        sectionId="basics"
        path="doi"
        label="Digital Object Identifier (DOI)"
        hint="Use an existing DOI or generate a new one."
        error={doiError}
      >
        {({ id, describedBy, invalid }) => (
          <>
            <AdornedInput
              id={id}
              aria-describedby={describedBy}
              aria-invalid={invalid}
              readOnly={generating}
              placeholder="Enter existing or generate a new one."
              {...form.register("doi")}
              trailing={
                <Button type="button" variant="secondary" size="sm" disabled={generating} onClick={() => void generate()} className="h-7">
                  {generating ? <LoaderCircle className="size-3.5 animate-spin" aria-hidden="true" /> : null}
                  {generating ? "Generating..." : "Generate DOI"}
                </Button>
              }
            />
            <span role="status" className="sr-only">
              {announce}
            </span>
          </>
        )}
      </Field>

      <Field sectionId="basics" path="description" label="Description" required hint="What was simulated, why, and what the data is useful for.">
        {({ id, describedBy, invalid }) => (
          <Textarea id={id} rows={3} aria-describedby={describedBy} aria-invalid={invalid} className="min-h-19" {...form.register("description")} />
        )}
      </Field>

      <Field
        sectionId="basics"
        path="keywords"
        label="Keywords"
        kind="group"
        groupRole={null}
        hint="Press Enter to add."
        action={
          keywords.length > 0 ? (
            <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={() => form.setValue("keywords", [], { shouldDirty: true })}>
              Clear all
            </Button>
          ) : null
        }
      >
        {({ describedBy }) => (
          <Controller
            control={form.control}
            name="keywords"
            render={({ field }) => (
              <TagInput
                label="Keywords"
                value={field.value}
                onChange={field.onChange}
                suggestions={suggestions.data ?? []}
                placeholder="Search or add keywords"
                aria-describedby={describedBy}
              />
            )}
          />
        )}
      </Field>
    </div>
  );
};

const CreditsSection = () => (
  <div className="flex flex-col gap-4">
    <CreatorList
      name="authors"
      label="Authors"
      note="In citation order"
      addLabel="Add author"
      required
      empty="No authors yet. The first author is cited first."
    />
    <CreatorList
      name="contributors"
      label="Contributors"
      note="Not in the citation"
      addLabel="Add contributor"
      hint="Optional. People who helped but are not cited."
    />
    <FundingList />
  </div>
);

const ACCESS_OPTIONS: { value: AccessValue; title: string; sub: string }[] = [
  { value: "open", title: "Open", sub: "Anyone can view" },
  { value: "restricted", title: "Restricted", sub: "On request" },
  { value: "embargoed", title: "Embargoed", sub: "Open from a date" },
];

const AccessIcon = ({ value }: { value: AccessValue }) =>
  value === "open" ? (
    <Icon name="access-open" className="size-5 shrink-0" />
  ) : value === "embargoed" ? (
    <Icon name="access-embargoed" className="size-5 shrink-0" />
  ) : (
    <Lock className="size-5 shrink-0" aria-hidden="true" />
  );

const toIso = (date: Date): string =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

const EmbargoFields = () => {
  const { form } = useStudy();
  const [open, setOpen] = useState(false);
  const until = useWatch({ control: form.control, name: "embargo.until" }) ?? "";
  const selected = isValidIsoDate(until) ? new Date(`${until}T00:00:00`) : undefined;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  return (
    <div className="border-text grid gap-3 border-l-2 pt-1.5 pl-3 sm:grid-cols-2">
      <Field
        sectionId="publishing"
        path="embargo.until"
        label="Open on"
        required
        hint="Metadata is public right away. Files open on this date."
      >
        {({ id, describedBy, invalid }) => (
          <AdornedInput
            id={id}
            aria-describedby={describedBy}
            aria-invalid={invalid}
            placeholder="YYYY-MM-DD"
            inputMode="numeric"
            autoComplete="off"
            {...form.register("embargo.until")}
            trailing={
              <Popover open={open} onOpenChange={setOpen}>
                <PopoverTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label="Choose date">
                    <CalendarDays className="size-4" aria-hidden="true" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent align="end" className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={selected}
                    defaultMonth={selected ?? tomorrow}
                    disabled={{ before: tomorrow }}
                    onSelect={(date) => {
                      if (!date) return;
                      form.setValue("embargo.until", toIso(date), { shouldDirty: true, shouldValidate: true });
                      setOpen(false);
                    }}
                  />
                </PopoverContent>
              </Popover>
            }
          />
        )}
      </Field>
      <Field sectionId="publishing" path="embargo.reason" label="Reason" note="Optional">
        {({ id, describedBy }) => (
          <Input id={id} aria-describedby={describedBy} placeholder="e.g. pending publication" {...form.register("embargo.reason")} />
        )}
      </Field>
    </div>
  );
};

const PublishingSection = () => {
  const { form } = useStudy();
  const access = useWatch({ control: form.control, name: "access" });

  return (
    <div className="flex flex-col gap-4">
      <Field sectionId="publishing" path="communityId" label="Community" required hint="Curators of this community review your submission.">
        {({ id, describedBy, invalid }) => (
          <Controller
            control={form.control}
            name="communityId"
            render={({ field }) => (
              <CommunityCombobox
                id={id}
                value={field.value}
                onChange={field.onChange}
                onBlur={field.onBlur}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          />
        )}
      </Field>

      <Field sectionId="publishing" path="access" label="Access" required kind="group" groupRole={null}>
        {({ describedBy }) => (
          <Controller
            control={form.control}
            name="access"
            render={({ field }) => (
              <RadioGroup
                value={field.value ?? ""}
                aria-labelledby="field-publishing-access-label"
                aria-describedby={describedBy}
                onValueChange={(next) => {
                  field.onChange(next);
                  // A date left behind would still be validated and counted; embargo fields exist only while embargoed.
                  if (next !== "embargoed") form.setValue("embargo", undefined, { shouldDirty: true });
                }}
                className="grid grid-cols-1 gap-2 sm:grid-cols-3"
              >
                {ACCESS_OPTIONS.map((option) => (
                  <label
                    key={option.value}
                    className={cn(
                      "bg-background border-border relative flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2.5",
                      "has-[[data-state=checked]]:border-text has-[[data-state=checked]]:border-2 has-[[data-state=checked]]:px-[11px] has-[[data-state=checked]]:py-[9px]",
                      "has-[:focus-visible]:ring-border-focus has-[:focus-visible]:ring-2",
                    )}
                  >
                    <RadioGroupItem value={option.value} className="absolute inset-0 size-full opacity-0" />
                    <AccessIcon value={option.value} />
                    <span className="flex flex-col">
                      <span className="text-xs leading-4 font-semibold">{option.title}</span>
                      <span className="text-text-muted text-[11px]">{option.sub}</span>
                    </span>
                  </label>
                ))}
              </RadioGroup>
            )}
          />
        )}
      </Field>

      {access === "embargoed" ? <EmbargoFields /> : null}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          sectionId="publishing"
          path="license"
          label="License"
          required
          hint={undefined}
        >
          {({ id, describedBy, invalid }) => (
            <>
              <Controller
                control={form.control}
                name="license"
                render={({ field }) => (
                  <Select value={field.value ?? ""} onValueChange={field.onChange} onOpenChange={(open) => !open && field.onBlur()}>
                    <SelectTrigger id={id} aria-describedby={describedBy} aria-invalid={invalid} className="w-full">
                      <SelectValue placeholder="Choose a license" />
                    </SelectTrigger>
                    <SelectContent>
                      {LICENSES.map((license) => (
                        <SelectItem key={license.value} value={license.value}>
                          {license.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              <p className="text-text-muted text-[11px]">
                Reuse with credit.{" "}
                <a
                  href="https://creativecommons.org/share-your-work/cclicenses/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-text font-medium underline"
                >
                  Compare licenses
                </a>
              </p>
            </>
          )}
        </Field>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="study-publisher" className="text-xs font-semibold">
            Publisher
          </label>
          <Input id="study-publisher" value="MDRepo" readOnly aria-describedby="study-publisher-hint" className="border-border bg-surface" />
          <p id="study-publisher-hint" className="text-text-muted text-[11px]">
            Entity responsible for making the resource available.
          </p>
        </div>
      </div>
    </div>
  );
};

export { BasicsSection, CreditsSection, PublishingSection };
