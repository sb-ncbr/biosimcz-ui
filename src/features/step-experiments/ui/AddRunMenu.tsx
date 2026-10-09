"use client";

import { ChevronDown, Plus } from "lucide-react";
import type { SimulationType } from "@/entities/deposition";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/shared/ui";
import { TYPE_MENU } from "../lib/options";

type AddRunMenuProps = {
  onAdd: (type: SimulationType) => void;
  variant?: "default" | "outline" | "ghost";
  // Menu alignment against the trigger; the sidebar row opens towards the content.
  align?: "start" | "end";
  chevron?: boolean;
  className?: string;
};

// The type picker behind every "Add run" (186:1099, 197:23). "From files..." is not offered: reading a run from
// .tpr/.mdp needs a parse endpoint that is not specified yet.
const AddRunMenu = ({ onAdd, variant = "default", align = "end", chevron = true, className }: AddRunMenuProps) => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button type="button" size="sm" variant={variant} className={className}>
        <Plus className="size-3.5" aria-hidden="true" />
        Add run
        {chevron ? <ChevronDown className="size-3.5" aria-hidden="true" /> : null}
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align={align} className="w-66">
      {TYPE_MENU.map((item) => (
        <DropdownMenuItem key={item.type} onSelect={() => onAdd(item.type)} className="flex-col items-start gap-0.5 px-2.5 py-2">
          <span className="text-[13px] font-medium">{item.label}</span>
          <span className="text-text-muted text-[11px]">{item.hint}</span>
        </DropdownMenuItem>
      ))}
    </DropdownMenuContent>
  </DropdownMenu>
);

export { AddRunMenu };
export type { AddRunMenuProps };
