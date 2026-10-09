"use client";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@e-infra/design-system";
import { Ellipsis, Plus } from "lucide-react";
import { useState } from "react";
import { Controller, useWatch } from "react-hook-form";
import type { Molecule, SectionResult } from "@/entities/deposition";
import { Icon } from "@/shared/ui/icons";
import { withCurrent } from "@/shared/lib";
import { describeMolecule, FORCE_FIELDS, MOLECULE_ICONS } from "../lib/options";
import { REQUIRED_COPY } from "../lib/messages";
import type { SystemForm } from "../model/useSystemForm";
import { EditMoleculeDialog } from "./EditMoleculeDialog";
import { FieldFrame } from "@/entities/deposition/ui";
import { StructureCombobox } from "./StructureCombobox";
import { FormSection } from "@/entities/deposition/ui";

type CompositionSectionProps = {
  form: SystemForm;
  result: SectionResult | undefined;
};

// null = closed, "new" = adding, number = index being edited. The dialog remounts per target so it starts clean.
type EditTarget = null | "new" | number;

const CompositionSection = ({ form, result }: CompositionSectionProps) => {
  const molecules = useWatch({ control: form.control, name: "molecules" }) ?? [];
  const [target, setTarget] = useState<EditTarget>(null);

  const commit = (next: Molecule[]) => form.setValue("molecules", next, { shouldDirty: true, shouldTouch: true });

  const move = (index: number, by: -1 | 1) => {
    const next = [...molecules] as Molecule[];
    const other = index + by;
    if (other < 0 || other >= next.length) return;
    [next[index], next[other]] = [next[other] as Molecule, next[index] as Molecule];
    commit(next);
  };

  const remove = (index: number) => commit((molecules as Molecule[]).filter((_, at) => at !== index));

  return (
    <FormSection
      id="composition"
      title="Composition"
      description="What the system is made of and how it is parametrized."
      result={result}
    >
      <FieldFrame
        sectionId="composition"
        path="startingStructure"
        label="Starting structure"
        required
        requiredMessage={REQUIRED_COPY["startingStructure"]}
        hint="Search by PDB, AlphaFold ID, protein name or type in custom one."
      >
        {(ids) => (
          <Controller
            control={form.control}
            name="startingStructure"
            render={({ field }) => <StructureCombobox {...ids} value={field.value} onChange={field.onChange} onBlur={field.onBlur} />}
          />
        )}
      </FieldFrame>

      <FieldFrame
        sectionId="composition"
        path="forceField"
        label="Force field"
        required
        requiredMessage={REQUIRED_COPY["forceField"]}
        hint="The default for every molecule. A molecule can override it."
      >
        {(ids) => (
          <Controller
            control={form.control}
            name="forceField"
            render={({ field }) => (
              <Select value={field.value ?? ""} onValueChange={(next) => next && field.onChange(next)}>
                <SelectTrigger {...ids} className="w-full" onBlur={field.onBlur}>
                  <SelectValue placeholder="Choose force field">{field.value}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {withCurrent(FORCE_FIELDS, field.value).map((name) => (
                    <SelectItem key={name} value={name}>
                      {name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        )}
      </FieldFrame>

      <FieldFrame sectionId="composition" path="molecules" label="Molecules" hint="Add molecules present in the structure" group>
        {() => (
          <div className="flex flex-col gap-1.5">
            {molecules.length === 0 ? (
              <p className="text-text-muted text-xs">
                No molecules yet. Upload a topology file above and we fill them in, or add them by hand.
              </p>
            ) : (
              <ul aria-label="Molecules" className="flex flex-col gap-1.5">
                {(molecules as Molecule[]).map((molecule, index) => {
                  const { title, sub } = describeMolecule(molecule);
                  return (
                    <li key={`${title}-${index}`} className="border-border flex items-center gap-2.5 rounded-lg border px-2.5 py-2">
                      <Icon name={MOLECULE_ICONS[molecule.type ?? "other"]} className="size-7 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] leading-4 font-semibold">{title}</p>
                        <p className="text-text-muted truncate text-[11px] leading-4">{sub}</p>
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button type="button" variant="ghost" size="icon-sm" aria-label={`More actions for ${title}`}>
                            <Ellipsis className="size-4" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => setTarget(index)}>Edit</DropdownMenuItem>
                          <DropdownMenuItem disabled={index === 0} onSelect={() => move(index, -1)}>
                            Move up
                          </DropdownMenuItem>
                          <DropdownMenuItem disabled={index === molecules.length - 1} onSelect={() => move(index, 1)}>
                            Move down
                          </DropdownMenuItem>
                          <DropdownMenuItem onSelect={() => remove(index)}>Remove</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </li>
                  );
                })}
              </ul>
            )}
            <div>
              <Button type="button" variant="outline" size="sm" onClick={() => setTarget("new")}>
                <Plus className="size-3.5" aria-hidden="true" />
                Add molecule
              </Button>
            </div>
          </div>
        )}
      </FieldFrame>

      {target !== null ? (
        <EditMoleculeDialog
          key={String(target)}
          open
          molecule={target === "new" ? undefined : (molecules as Molecule[])[target]}
          onClose={() => setTarget(null)}
          onSave={(saved) => {
            const list = [...(molecules as Molecule[])];
            if (target === "new") list.push(saved);
            else list[target] = saved;
            commit(list);
            setTarget(null);
          }}
          {...(target !== "new" && {
            onRemove: () => {
              remove(target);
              setTarget(null);
            },
          })}
        />
      ) : null}
    </FormSection>
  );
};

export { CompositionSection };
