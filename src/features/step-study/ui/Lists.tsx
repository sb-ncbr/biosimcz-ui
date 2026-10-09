"use client";

import {
  Avatar,
  AvatarFallback,
  Badge,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@e-infra/design-system";
import { Ellipsis, Plus } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { useFieldArray } from "react-hook-form";
import { toast } from "sonner";
import { isValidOrcid } from "@/entities/deposition";
import { cn } from "@/shared/lib";
import { Icon } from "@/shared/ui";
import { displayName, initials, isOrganisation, subtitle } from "../model/creators";
import { formatMessage } from "../model/messages";
import { labelOf, RELATIONS, SCHEMES, type Funding, type RelatedWork } from "../model/lists";
import { CreatorEditor } from "./CreatorEditor";
import { useStudy } from "./context";
import { Field } from "./Field";
import { FundingEditor, RelatedWorkEditor } from "./ListEditors";

type RowActionsProps = {
  // Names the row for assistive tech: "More actions for Jana Novakova".
  name: string;
  onEdit: () => void;
  onUp?: (() => void) | undefined;
  onDown?: (() => void) | undefined;
  onRemove: () => void;
};

const RowActions = ({ name, onEdit, onUp, onDown, onRemove }: RowActionsProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" variant="ghost" size="icon-sm" aria-label={`More actions for ${name}`}>
        <Ellipsis className="size-4" aria-hidden="true" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuItem onSelect={onEdit}>Edit</DropdownMenuItem>
      {onUp || onDown ? (
        <>
          <DropdownMenuItem disabled={!onUp} onSelect={() => onUp?.()}>
            Move up
          </DropdownMenuItem>
          <DropdownMenuItem disabled={!onDown} onSelect={() => onDown?.()}>
            Move down
          </DropdownMenuItem>
        </>
      ) : null}
      <DropdownMenuSeparator />
      <DropdownMenuItem variant="error" onSelect={onRemove}>
        Remove
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>
);

// "Jana removed. Undo": a local undo that is autosaved like any other edit. Cleared after a few seconds.
const UNDO_MS = 8000;

const UndoNotice = ({ text, onUndo, onExpire }: { text: string; onUndo: () => void; onExpire: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onExpire, UNDO_MS);
    return () => clearTimeout(timer);
  }, [text, onExpire]);
  return (
    <p role="status" className="text-text-muted flex items-center gap-2 text-xs">
      {text}
      <Button type="button" variant="link" size="sm" className="h-auto p-0 text-xs" onClick={onUndo}>
        Undo
      </Button>
    </p>
  );
};

type CreatorListProps = {
  name: "authors" | "contributors";
  label: string;
  note: string;
  addLabel: string;
  required?: boolean;
  empty?: string;
  hint?: string;
};

const CreatorList = ({ name, label, note, addLabel, required, empty, hint }: CreatorListProps) => {
  const { form } = useStudy();
  const { fields, append, update, remove, move, insert } = useFieldArray({ control: form.control, name });
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const focusId = useRef<string | null>(null);
  const dragFrom = useRef<number | null>(null);
  const group = name === "authors" ? "author" : "contributor";

  // A moved row is re-inserted by the browser, which drops focus; put it back on the same grip.
  useEffect(() => {
    if (focusId.current === null) return;
    document.querySelector<HTMLElement>(`[data-grip="${focusId.current}"]`)?.focus();
    focusId.current = null;
  }, [fields]);

  const shift = (index: number, to: number) => {
    const id = fields[index]?.id;
    if (to < 0 || to >= fields.length || id === undefined) return;
    move(index, to);
    focusId.current = id;
  };

  const onGripKey = (event: KeyboardEvent, index: number) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      shift(index, index - 1);
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      shift(index, index + 1);
    }
  };

  const removeAt = (index: number) => {
    const item = form.getValues(name)[index];
    if (!item) return;
    remove(index);
    // The Toaster is mounted in app/providers.tsx. Undo re-reads the list, which may have changed meanwhile.
    toast(`${displayName(item) || "Entry"} removed.`, {
      duration: UNDO_MS,
      action: { label: "Undo", onClick: () => insert(Math.min(index, form.getValues(name).length), item) },
    });
  };

  const current = editing?.index === null || editing === null ? null : (form.getValues(name)[editing.index] ?? null);

  return (
    <Field sectionId="credits" path={name} label={label} required={required} note={note} hint={hint} kind="group">
      {() => (
        <>
          {fields.length === 0 && empty ? <p className="text-text-muted text-sm">{empty}</p> : null}
          {fields.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {fields.map((item, index) => {
                const creator = form.getValues(name)[index] ?? item;
                const title = displayName(creator) || "Unnamed";
                const orcidBad = !isOrganisation(creator) && Boolean(creator.orcid) && !isValidOrcid(creator.orcid ?? "");
                return (
                  <li
                    key={item.id}
                    draggable
                    onDragStart={() => (dragFrom.current = index)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => {
                      if (dragFrom.current !== null) move(dragFrom.current, index);
                      dragFrom.current = null;
                    }}
                    className="bg-background border-border rounded-lg border px-3 py-2.5"
                  >
                    <div className="flex items-center gap-2.5">
                      <button
                        type="button"
                        data-grip={item.id}
                        aria-label={`Reorder ${title}. Use the up and down arrow keys.`}
                        onKeyDown={(event) => onGripKey(event, index)}
                        className="text-text-muted focus-visible:ring-border-focus flex size-6 shrink-0 cursor-grab items-center justify-center rounded outline-none focus-visible:ring-2"
                      >
                        <Icon name="grip" className="h-2 w-1 shrink-0" />
                      </button>
                      {isOrganisation(creator) ? (
                        <span className="bg-surface border-border flex size-7 shrink-0 items-center justify-center rounded" aria-hidden="true">
                          <Icon name="account-balance" className="size-3.5" />
                        </span>
                      ) : (
                        <Avatar className="size-7">
                          <AvatarFallback className="text-[10px] font-semibold">{initials(creator) || "?"}</AvatarFallback>
                        </Avatar>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] leading-4 font-semibold">{title}</p>
                        <p className="text-text-muted truncate text-[11px]">{subtitle(creator)}</p>
                      </div>
                      <RowActions
                        name={title}
                        onEdit={() => setEditing({ index })}
                        onUp={index > 0 ? () => shift(index, index - 1) : undefined}
                        onDown={index < fields.length - 1 ? () => shift(index, index + 1) : undefined}
                        onRemove={() => removeAt(index)}
                      />
                    </div>
                    {orcidBad ? <p className="text-error-700 mt-1 pl-9 text-xs">{formatMessage("invalid_orcid")}</p> : null}
                  </li>
                );
              })}
            </ul>
          ) : null}
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ index: null })}>
              <Plus className="size-3.5" aria-hidden="true" />
              {addLabel}
            </Button>
          </div>
          {editing ? (
            <CreatorEditor
              initial={current}
              group={group}
              onClose={() => setEditing(null)}
              onSave={(creator) => {
                if (editing.index === null) append(creator);
                else update(editing.index, creator);
                setEditing(null);
              }}
            />
          ) : null}
        </>
      )}
    </Field>
  );
};

const FundingList = () => {
  const { form } = useStudy();
  const { fields, append, update, remove, insert } = useFieldArray({ control: form.control, name: "funding" });
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const [undo, setUndo] = useState<{ item: Funding; index: number; text: string } | null>(null);
  const current = editing?.index === null || editing === null ? null : (form.getValues("funding")[editing.index] ?? null);

  return (
    <Field
      sectionId="credits"
      path="funding"
      label="Funding"
      kind="group"
      hint="Funder and award number, as they should appear in acknowledgements."
    >
      {() => (
        <>
          {fields.length > 0 ? (
            <ul className="flex flex-col gap-2">
              {fields.map((item, index) => {
                const funding = form.getValues("funding")[index] ?? item;
                const name = funding.funderName || "Unnamed funder";
                return (
                  <li key={item.id} className="bg-background border-border flex items-center gap-2.5 rounded-lg border px-3 py-2.5">
                    <Icon name="bank-16" className="text-text-muted size-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] leading-4">{name}</p>
                      {funding.awardNumber ? <p className="text-text-muted truncate text-[11px]">Award {funding.awardNumber}</p> : null}
                    </div>
                    <RowActions
                      name={name}
                      onEdit={() => setEditing({ index })}
                      onRemove={() => {
                        remove(index);
                        setUndo({ item: funding, index, text: `${name} removed.` });
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}
          {undo ? (
            <UndoNotice
              text={undo.text}
              onExpire={() => setUndo(null)}
              onUndo={() => {
                insert(Math.min(undo.index, fields.length), undo.item);
                setUndo(null);
              }}
            />
          ) : null}
          <div>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ index: null })}>
              <Plus className="size-3.5" aria-hidden="true" />
              Add funding
            </Button>
          </div>
          {editing ? (
            <FundingEditor
              initial={current}
              onClose={() => setEditing(null)}
              onSave={(funding) => {
                if (editing.index === null) append(funding);
                else update(editing.index, funding);
                setEditing(null);
              }}
            />
          ) : null}
        </>
      )}
    </Field>
  );
};

const RelatedWorkList = () => {
  const { form } = useStudy();
  const { fields, append, update, remove, insert } = useFieldArray({ control: form.control, name: "relatedWorks" });
  const [editing, setEditing] = useState<{ index: number | null } | null>(null);
  const [undo, setUndo] = useState<{ item: RelatedWork; index: number; text: string } | null>(null);
  const current = editing?.index === null || editing === null ? null : (form.getValues("relatedWorks")[editing.index] ?? null);

  return (
    <Field
      sectionId="relatedWork"
      path="relatedWorks"
      label="Links to other works"
      note="This dataset is..."
      kind="group"
      hint="Specify identifiers of related works."
    >
      {() => (
        <>
          {fields.length > 0 ? (
            <ul className="border-border divide-border divide-y rounded-lg border">
              {fields.map((item, index) => {
                const work = form.getValues("relatedWorks")[index] ?? item;
                const name = work.identifier || "Unnamed work";
                return (
                  <li key={item.id} className="flex items-center gap-2 px-3 py-2">
                    <span className="text-text-muted text-xs">{labelOf(RELATIONS, work.relation)}</span>
                    {work.scheme ? (
                      <Badge variant="secondary" className="text-[10px] font-medium">
                        {labelOf(SCHEMES, work.scheme)}
                      </Badge>
                    ) : null}
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{name}</span>
                    <RowActions
                      name={name}
                      onEdit={() => setEditing({ index })}
                      onRemove={() => {
                        remove(index);
                        setUndo({ item: work, index, text: `${name} removed.` });
                      }}
                    />
                  </li>
                );
              })}
            </ul>
          ) : null}
          {undo ? (
            <UndoNotice
              text={undo.text}
              onExpire={() => setUndo(null)}
              onUndo={() => {
                insert(Math.min(undo.index, fields.length), undo.item);
                setUndo(null);
              }}
            />
          ) : null}
          <div className={cn("flex")}>
            <Button type="button" variant="outline" size="sm" onClick={() => setEditing({ index: null })}>
              <Plus className="size-3.5" aria-hidden="true" />
              Add work
            </Button>
          </div>
          {editing ? (
            <RelatedWorkEditor
              initial={current}
              onClose={() => setEditing(null)}
              onSave={(work) => {
                if (editing.index === null) append(work);
                else update(editing.index, work);
                setEditing(null);
              }}
            />
          ) : null}
        </>
      )}
    </Field>
  );
};

export { CreatorList, FundingList, RelatedWorkList };
