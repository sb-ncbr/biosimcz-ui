"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import type { Creator, FieldRef } from "@/entities/deposition";
import { displayName, initials, isOrganisation, subtitle, type Funding } from "@/features/step-study";
import { enableShowRequired } from "@/shared/lib/showRequired";
import { Avatar, AvatarFallback, Badge, Icon, type IconName } from "@/shared/ui";
import { refHref } from "../model/problems";

// Small value renderers shared by the three step summaries (batch-d 5.2).

type FieldLookup = (path: string, runId?: string) => FieldRef | undefined;

// Required value that is still empty: "Missing" plus the link that takes the user there (missing-states 5.5).
const MissingValue = ({ draftId, field }: { draftId: string; field: FieldRef }) => (
  <span className="flex flex-wrap items-center gap-x-2">
    <span className="text-error-700 font-medium">Missing</span>
    <Link
      href={refHref(draftId, field)}
      onClick={() => enableShowRequired(draftId)}
      className="text-text focus-visible:ring-border-focus rounded-sm text-xs font-medium underline underline-offset-2 outline-none focus-visible:ring-2"
    >
      Go to field
      <span className="sr-only">: {field.label}</span>
    </Link>
  </span>
);

// A value, or the missing marker when that required field is still empty.
const orMissing = (draftId: string, field: FieldRef | undefined, value: ReactNode | ReactNode[] | undefined): ReactNode | ReactNode[] | undefined =>
  field ? <MissingValue draftId={draftId} field={field} /> : value;

const Secondary = ({ children }: { children: ReactNode }) => <span className="text-text-muted ml-2 text-xs">{children}</span>;

const PersonRow = ({ creator }: { creator: Creator }) => {
  const name = displayName(creator) || "Unnamed";
  return (
    <span className="flex min-w-0 items-center gap-2">
      {isOrganisation(creator) ? (
        <span className="bg-base-200 flex size-5 shrink-0 items-center justify-center rounded-[3px]">
          <Icon name="account-balance" className="size-3.5" />
        </span>
      ) : (
        <Avatar className="size-5 shrink-0">
          <AvatarFallback className="text-[8px] font-semibold">{initials(creator) || "?"}</AvatarFallback>
        </Avatar>
      )}
      <span className="min-w-0 truncate">
        <span className="font-medium">{name}</span>
        <Secondary>{subtitle(creator)}</Secondary>
      </span>
    </span>
  );
};

const FundingRow = ({ funding }: { funding: Funding }) => (
  <span className="flex min-w-0 items-center gap-2">
    <Icon name="bank-16" className="size-4 shrink-0" />
    <span className="min-w-0 truncate">
      <span className="font-medium">{funding.funderName?.trim() || "Unnamed funder"}</span>
      {funding.awardNumber ? <Secondary>Award {funding.awardNumber}</Secondary> : null}
    </span>
  </span>
);

// Icon tile + name + small id, for the starting structure and the box shape (batch-d 5.2 "token").
const Token = ({ icon, name, note }: { icon?: IconName; name: string; note?: string }) => (
  <Badge variant="outline" className="bg-base-100 w-fit gap-1.5 py-0.5 pr-1.5 pl-1">
    {icon ? <Icon name={icon} className="size-[22px]" /> : null}
    <span className="text-xs font-semibold">{name}</span>
    {note ? <span className="text-text-muted text-[11px] font-normal">{note}</span> : null}
  </Badge>
);

const ItemRow = ({ icon, title, sub }: { icon?: IconName; title: ReactNode; sub?: string }) => (
  <span className="flex min-w-0 items-center gap-2">
    {icon ? <Icon name={icon} className="size-[22px] shrink-0" /> : null}
    <span className="min-w-0">
      <span className="font-medium">{title}</span>
      {sub ? <Secondary>{sub}</Secondary> : null}
    </span>
  </span>
);

export { FundingRow, ItemRow, MissingValue, orMissing, PersonRow, Secondary, Token };
export type { FieldLookup };
