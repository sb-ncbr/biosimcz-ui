"use client";

import { LogOut } from "lucide-react";
import { useTransition } from "react";
import { clearAllMirrors } from "@/features/draft";
import { Button, DropdownMenuItem } from "@/shared/ui";
import { logout } from "../actions";
import { hardNavigate } from "../lib/navigate";

type SignOutItemProps = { variant: "menu" | "button" };

// One handler for the account dropdown and the mobile sheet. Local drafts are wiped first (before the action can
// fail or the page unloads), then the server ends the session and says where to go (IdP end-session or /login).
const SignOutItem = ({ variant }: SignOutItemProps) => {
  const [pending, startTransition] = useTransition();
  const signOut = () =>
    startTransition(async () => {
      await clearAllMirrors();
      const { redirectTo } = await logout();
      hardNavigate(redirectTo);
    });

  if (variant === "menu") {
    return (
      <DropdownMenuItem disabled={pending} onSelect={signOut}>
        <LogOut aria-hidden />
        Sign out
      </DropdownMenuItem>
    );
  }
  return (
    <Button type="button" variant="outline" size="sm" disabled={pending} onClick={signOut}>
      Sign out
    </Button>
  );
};

export { SignOutItem };
