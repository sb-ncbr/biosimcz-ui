import type { ReactNode } from "react";
import type { SimulationType } from "@/entities/deposition";
import { cn } from "@/shared/lib";
import type { PublishModel, WizardNavModel } from "../model/types";
import { saveAnnouncement } from "./SaveStatus";
import { ActionBar } from "./ActionBar";
import { WizardSidebar } from "./WizardSidebar";
import { WizardTopBar } from "./WizardTopBar";

const MAIN_ID = "wizard-main";

type WizardShellProps = {
  nav: WizardNavModel;
  publish: PublishModel;
  // Site app bar for >= lg (owned by the site widgets); the lg- top bar carries its own menu slot.
  appBar?: ReactNode;
  mobileMenu?: ReactNode;
  helpdeskHref?: string;
  onPublish?: () => void;
  onBlockedPublish?: () => void;
  // Adds a run of the chosen type and opens it (sidebar "Add run", same logic as the Step 3 menu).
  onAddRun?: (type: SimulationType) => void;
  children: ReactNode;
};

// Sidebar 240/268 + app bar + content + sticky action bar. Below lg the sidebar becomes the top bar's Steps sheet.
const WizardShell = ({ nav, publish, appBar, mobileMenu, helpdeskHref, onPublish, onBlockedPublish, onAddRun, children }: WizardShellProps) => (
  <div className="bg-background flex min-h-screen">
    <a
      href={`#${MAIN_ID}`}
      className="bg-surface text-text focus-visible:ring-border-focus sr-only z-50 rounded-md px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus-visible:ring-2"
    >
      Skip to content
    </a>
    <aside
      aria-label="Deposition sidebar"
      className="border-border sticky top-0 hidden h-screen w-60 shrink-0 border-r lg:block xl:w-[268px]"
    >
      <WizardSidebar nav={nav} helpdeskHref={helpdeskHref} onAddRun={onAddRun} />
    </aside>
    <div className="flex min-w-0 flex-1 flex-col">
      <WizardTopBar nav={nav} helpdeskHref={helpdeskHref} menu={mobileMenu} onAddRun={onAddRun} className="lg:hidden" />
      {appBar ? <div className="hidden lg:block">{appBar}</div> : null}
      <main id={MAIN_ID} tabIndex={-1} className={cn("flex-1 px-4 pt-8 pb-12 outline-none md:px-6 lg:px-12")}>
        {children}
      </main>
      <ActionBar publish={publish} onPublish={onPublish} onBlocked={onBlockedPublish} />
      <div role="status" aria-live="polite" className="sr-only">
        {saveAnnouncement(nav.draft.save)}
      </div>
    </div>
  </div>
);

export { WizardShell };
export type { WizardShellProps };
