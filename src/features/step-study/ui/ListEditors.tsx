"use client";

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
} from "@e-infra/design-system";
import { useState, type FormEvent } from "react";
import { formatMessage } from "../model/messages";
import { RELATIONS, SCHEMES, type Funding, type RelatedWork } from "../model/lists";
import { EditorField } from "./EditorField";
import { OrganisationPicker, type Picked } from "./OrganisationPicker";

type FundingEditorProps = {
  initial: Funding | null;
  onSave: (funding: Funding) => void;
  onClose: () => void;
};

const blank = (value: string | undefined): boolean => (value ?? "").trim() === "";

const FundingEditor = ({ initial, onSave, onClose }: FundingEditorProps) => {
  const [funder, setFunder] = useState<Picked[]>(initial?.funderName ? [{ name: initial.funderName, rorId: initial.funderRorId }] : []);
  const [award, setAward] = useState(initial?.awardNumber ?? "");
  const [title, setTitle] = useState(initial?.awardTitle ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    const chosen = funder[0];
    if (!chosen) {
      setError("Choose or enter the funder.");
      return;
    }
    onSave({
      funderName: chosen.name,
      ...(chosen.rorId ? { funderRorId: chosen.rorId } : {}),
      ...(blank(award) ? {} : { awardNumber: award.trim() }),
      ...(blank(title) ? {} : { awardTitle: title.trim() }),
    });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit funding" : "Add funding"}</DialogTitle>
          <DialogDescription>Funder and award number, as they should appear in acknowledgements.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <EditorField label="Funder" required error={error}>
            {({ id, describedBy, invalid }) => (
              <OrganisationPicker
                id={id}
                label="Funder"
                placeholder="Search funders"
                value={funder}
                onChange={(next) => {
                  setFunder(next);
                  setError(null);
                }}
                aria-describedby={describedBy}
                aria-invalid={invalid}
              />
            )}
          </EditorField>
          <div className="grid gap-4 sm:grid-cols-2">
            <EditorField label="Award number">
              {({ id }) => <Input id={id} value={award} onChange={(event) => setAward(event.target.value)} />}
            </EditorField>
            <EditorField label="Award title">
              {({ id }) => <Input id={id} value={title} onChange={(event) => setTitle(event.target.value)} />}
            </EditorField>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{initial ? "Save" : "Add funding"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

type RelatedWorkEditorProps = {
  initial: RelatedWork | null;
  onSave: (work: RelatedWork) => void;
  onClose: () => void;
};

const RelatedWorkEditor = ({ initial, onSave, onClose }: RelatedWorkEditorProps) => {
  const [relation, setRelation] = useState(initial?.relation ?? "supplement_to");
  const [scheme, setScheme] = useState(initial?.scheme ?? "publication");
  const [identifier, setIdentifier] = useState(initial?.identifier ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (blank(identifier)) {
      setError("Enter the identifier, for example a DOI or a PDB id.");
      return;
    }
    onSave({ relation, scheme, identifier: identifier.trim() });
  };

  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit related work" : "Add related work"}</DialogTitle>
          <DialogDescription>Connect this dataset to a paper, a structure or another dataset.</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} noValidate className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <EditorField label="This dataset is">
              {({ id }) => (
                <Select value={relation} onValueChange={setRelation}>
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {RELATIONS.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </EditorField>
            <EditorField label="Type of work">
              {({ id }) => (
                <Select value={scheme} onValueChange={setScheme}>
                  <SelectTrigger id={id} className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {SCHEMES.map((item) => (
                      <SelectItem key={item.value} value={item.value}>
                        {item.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </EditorField>
          </div>
          <EditorField label="Identifier" required error={error ? (formatMessage(error) ?? error) : null}>
            {({ id, describedBy, invalid }) => (
              <Input
                id={id}
                value={identifier}
                aria-describedby={describedBy}
                aria-invalid={invalid}
                placeholder="10.1021/acs.jcim.4c00123 or PDB 1AKI"
                onChange={(event) => {
                  setIdentifier(event.target.value);
                  setError(null);
                }}
              />
            )}
          </EditorField>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button type="submit">{initial ? "Save" : "Add work"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export { FundingEditor, RelatedWorkEditor };
