"use client";

import { ChevronDown } from "lucide-react";
import type { SessionUser } from "@/entities/session";
import { SignOutItem } from "@/features/auth";
import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/shared/ui";
import { initialsOf } from "./navigation";

const AccountMenu = ({ user }: { user: SessionUser }) => {
  const label = user.displayName ?? user.email ?? "Account";
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="text-text-muted max-w-56 rounded-full pl-1" aria-label={`Account: ${label}`}>
          <Avatar className="size-7">
            <AvatarFallback className="text-xs">{initialsOf(label)}</AvatarFallback>
          </Avatar>
          <span className="truncate">{label}</span>
          <ChevronDown aria-hidden className="size-4 shrink-0" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-48">
        {user.email && <DropdownMenuLabel className="truncate">{user.email}</DropdownMenuLabel>}
        <DropdownMenuSeparator />
        <SignOutItem variant="menu" />
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export { AccountMenu };
