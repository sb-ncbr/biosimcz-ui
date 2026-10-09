"use client";

import { ChevronDown } from "lucide-react";
import { Button, DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "@/shared/ui";

// Locale list is UNKNOWN (batch-a 1.1); English is the only active locale until next-intl lands.
const LanguageMenu = () => (
  <DropdownMenu>
    <DropdownMenuTrigger asChild>
      <Button variant="ghost" size="sm" aria-label="Language: English" className="text-text-muted">
        EN
        <ChevronDown aria-hidden className="size-4" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end">
      <DropdownMenuRadioGroup value="en">
        <DropdownMenuRadioItem value="en">English</DropdownMenuRadioItem>
        <DropdownMenuRadioItem value="cs" disabled>
          Čeština
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
    </DropdownMenuContent>
  </DropdownMenu>
);

export { LanguageMenu };
