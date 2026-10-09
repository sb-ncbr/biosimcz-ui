import type { ReactNode } from "react";
import { getCurrentSession } from "@/server/session";
import { AppBar } from "@/widgets/app-bar";
import { SiteFooter } from "@/widgets/footer";

const SiteLayout = async ({ children }: { children: ReactNode }) => {
  const session = await getCurrentSession();
  return (
    <div className="flex min-h-screen flex-col">
      <AppBar user={session?.user ?? null} />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
};

export default SiteLayout;
