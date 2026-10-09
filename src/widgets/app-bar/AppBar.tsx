"use client";

import { Plus } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { SessionUser } from "@/entities/session";
import { NewDepositionButton } from "@/features/deposition-create";
import { RecordSearchForm } from "@/features/record-search";
import { APP_NAME } from "@/shared/config/client";
import { cn } from "@/shared/lib";
import { Button, Header, HeaderContent, HeaderLeft, HeaderRight, Separator } from "@/shared/ui";
import { AccountMenu } from "./AccountMenu";
import { LanguageMenu } from "./LanguageMenu";
import { MobileMenu } from "./MobileMenu";
import { isActive, LOGIN_HREF, NAV_LINKS, newDepositionHref } from "./navigation";

// The search page carries its own bar; every other page (the homepage included) still gets the compact one.
const hasOwnSearch = (pathname: string): boolean => pathname === "/records";

const AppBar = ({ user }: { user: SessionUser | null }) => {
  const pathname = usePathname();
  return (
    <Header className="bg-surface h-17">
      <HeaderContent container={false} className="h-full w-full px-4 md:px-6 xl:px-12">
        <HeaderLeft>
          <Link href="/" className="focus-visible:ring-border-focus/50 rounded-md text-sm font-bold tracking-tight outline-none focus-visible:ring-[3px]">
            {APP_NAME}
          </Link>
        </HeaderLeft>
        <HeaderRight className="gap-1 md:gap-2">
          {hasOwnSearch(pathname) ? null : (
            // The nav, New Deposition and the account chip fill the bar between lg and 2xl (less inside the wizard, which
            // has a sidebar), so the field is hidden there; the Browse link leads to the search page.
            <div className="hidden md:block lg:hidden 2xl:block">
              <RecordSearchForm size="compact" />
            </div>
          )}
          <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
            {NAV_LINKS.map(({ href, label }) => {
              const active = isActive(pathname, href);
              return (
                <Button key={href} asChild variant="ghost" size="sm" className={cn(active && "font-bold")}>
                  <Link href={href} aria-current={active ? "page" : undefined}>
                    {label}
                  </Link>
                </Button>
              );
            })}
          </nav>
          <Separator orientation="vertical" className="mx-2 hidden h-5 lg:block" />
          {user ? (
            <NewDepositionButton label="New Deposition" ariaLabel="New deposition" hideLabelBelowMd className="max-md:size-11 max-md:p-0" />
          ) : (
            <Button asChild size="sm" className="max-md:size-11 max-md:p-0">
              <Link href={newDepositionHref(false)} aria-label="New deposition">
                <Plus aria-hidden />
                <span className="max-md:hidden">New Deposition</span>
              </Link>
            </Button>
          )}
          <div className="hidden items-center gap-1 lg:flex">
            <LanguageMenu />
            {user ? (
              <AccountMenu user={user} />
            ) : (
              <Button asChild variant="outline" size="sm">
                <Link href={LOGIN_HREF}>Log in</Link>
              </Button>
            )}
          </div>
          <MobileMenu user={user} pathname={pathname} />
        </HeaderRight>
      </HeaderContent>
    </Header>
  );
};

export { AppBar };
