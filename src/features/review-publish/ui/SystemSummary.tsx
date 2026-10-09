"use client";

import { BOX_SHAPES_WITH_ANGLES, draftHref, type StepResult, type System } from "@/entities/deposition";
import { StepSummary, type SummaryGroup } from "@/entities/deposition/ui";
import { ROLE_LABEL, roleFromName } from "@/features/upload";
import { BOX_SHAPE_LABELS, describeMolecule, MOLECULE_ICONS } from "@/features/step-system";
import type { MissingLookup } from "../model/problems";
import { ItemRow, orMissing, Secondary, Token } from "./values";

type SystemSummaryProps = { draftId: string; system: System; result: StepResult; find: MissingLookup };

const count = (value: number): string => value.toLocaleString("en-US");

const SystemSummary = ({ draftId, system, result, find }: SystemSummaryProps) => {
  const missing = (path: string) => find("system", path);
  const box = system.box;
  const hasAngles = box?.shape !== undefined && BOX_SHAPES_WITH_ANGLES.includes(box.shape);
  const vectors =
    box?.a !== undefined && box.b !== undefined && box.c !== undefined ? `${box.a} × ${box.b} × ${box.c} nm` : undefined;
  const angles =
    box?.alpha !== undefined && box.beta !== undefined && box.gamma !== undefined ? `${box.alpha}° · ${box.beta}° · ${box.gamma}°` : undefined;
  const structure = system.startingStructure;
  const engine = system.engine;

  const groups: SummaryGroup[] = [
    {
      title: "Engine",
      items: [
        {
          term: "Engine",
          description: orMissing(
            draftId,
            missing("engine.name") ?? missing("engine.version"),
            engine?.name ? (
              <span>
                <span>{[engine.name, engine.version].filter(Boolean).join(" ")}</span>
                {engine.build ? <Secondary>{engine.build}</Secondary> : null}
              </span>
            ) : undefined,
          ),
        },
      ],
    },
    {
      title: "Composition",
      items: [
        {
          term: "Starting structure",
          description: orMissing(
            draftId,
            missing("startingStructure"),
            structure && (structure.id || structure.source === "custom") ? (
              <Token
                icon="mol-thumb-22"
                name={structure.title?.trim() || (structure.source === "custom" ? "Custom structure" : (structure.id ?? ""))}
                note={structure.source === "custom" ? undefined : `${structure.source === "alphafold" ? "AlphaFold" : "PDB"} ${structure.id}`}
              />
            ) : undefined,
          ),
        },
        { term: "Force field", description: orMissing(draftId, missing("forceField"), system.forceField?.trim() || undefined) },
        {
          term: "Molecules",
          description: system.molecules.map((molecule, index) => {
            const { title, sub } = describeMolecule(molecule);
            return <ItemRow key={index} icon={molecule.type ? MOLECULE_ICONS[molecule.type] : "mol-thumb-22"} title={title} sub={sub} />;
          }),
        },
      ],
    },
    {
      title: "Dimensions",
      items: [
        {
          term: "Box shape",
          description: box?.shape ? (
            <Token icon={box.shape === "triclinic" ? "shape-triclinic-22" : undefined} name={BOX_SHAPE_LABELS[box.shape]} />
          ) : undefined,
        },
        {
          term: "System size",
          description: orMissing(draftId, missing("systemSize"), system.systemSize !== undefined ? `${count(system.systemSize)} atoms` : undefined),
        },
        { term: "Box vectors", description: orMissing(draftId, missing("box.vectors"), vectors) },
        ...(hasAngles ? [{ term: "Box angles", description: orMissing(draftId, missing("box.angles"), angles) }] : []),
      ],
    },
    {
      title: "Files",
      items: [
        {
          term: "System files",
          description: orMissing(
            draftId,
            missing("fileKeys"),
            system.fileKeys.map((key) => <ItemRow key={key} title={key} sub={ROLE_LABEL[roleFromName(key)]} />),
          ),
        },
      ],
    },
  ];

  return (
    <StepSummary
      id="review-system"
      title={result.title}
      status={result.status}
      requiredLeft={result.requiredLeft}
      toFix={result.toFix}
      editHref={draftHref(draftId, "system")}
      groups={groups}
    />
  );
};

export { SystemSummary };
