"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import type { SessionUser } from "@/entities/session";
import { SignOutItem } from "@/features/auth";
import { cn } from "@/shared/lib";
import { Button, Separator, Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from "@/shared/ui";
import { isActive, LOGIN_HREF, NAV_LINKS } from "./navigation";

const MobileMenu = ({ user, pathname }: { user: SessionUser | null; pathname: string }) => (
  <Sheet>
    <SheetTrigger asChild>
      <Button variant="ghost" size="icon" aria-label="Open menu" className="size-11 lg:hidden">
        <Menu aria-hidden />
      </Button>
    </SheetTrigger>
    <SheetContent side="right" className="w-72 gap-0">
      <SheetHeader>
        <SheetTitle>Menu</SheetTitle>
        <SheetDescription className="sr-only">Site navigation and account</SheetDescription>
      </SheetHeader>
      <nav aria-label="Main" className="flex flex-col gap-1 px-4">
        {NAV_LINKS.map(({ href, label }) => {
          const active = isActive(pathname, href);
          return (
            <SheetClose asChild key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn("hover:bg-tertiary rounded-md px-3 py-3 text-sm font-medium focus-visible:ring-border-focus/50 outline-none focus-visible:ring-[3px]", active && "bg-tertiary font-bold")}
              >
                {label}
              </Link>
            </SheetClose>
          );
        })}
      </nav>
      <Separator className="my-4" />
      <div className="flex flex-col gap-3 px-4">
        <p className="text-text-muted text-sm">Language: English</p>
        {user ? (
          <div className="flex flex-col gap-3">
            <p className="truncate text-sm">{user.displayName ?? user.email ?? "Account"}</p>
            <SignOutItem variant="button" />
          </div>
        ) : (
          <SheetClose asChild>
            <Button asChild variant="outline" size="sm">
              <Link href={LOGIN_HREF}>Log in</Link>
            </Button>
          </SheetClose>
        )}
      </div>
    </SheetContent>
  </Sheet>
);

export { MobileMenu };
