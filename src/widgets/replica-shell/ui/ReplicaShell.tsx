import Link from "next/link";
import type { ReactNode } from "react";
import { recordHref } from "@/entities/record/lib/href";
import { ReplicaBreadcrumb, ReplicaRail, ReplicaSwitcher, ReplicaTabs, type ReplicaNavItem } from "@/features/replica-nav";
import { Badge } from "@/shared/ui";

type ReplicaShellProps = {
  accession: string;
  recordTitle: string;
  replicaName: string;
  replicas: readonly ReplicaNavItem[];
  // Extra controls rendered in the same wrapping row as the section buttons.
  toolbar?: ReactNode;
  children: ReactNode;
};

// Composition lives in a widget because features must not import each other.
const ReplicaShell = ({ accession, recordTitle, replicaName, replicas, toolbar, children }: ReplicaShellProps) => (
  <div className="mx-auto flex w-full max-w-screen-2xl flex-col gap-6 px-4 py-6 md:px-6">
    <header className="flex flex-col gap-3">
      <ReplicaBreadcrumb accession={accession} recordTitle={recordTitle} replicaName={replicaName} />
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="px-2 py-0.5 font-mono text-xs font-medium">
          {accession}
        </Badge>
      </div>
      <h1 className="text-2xl leading-tight font-semibold tracking-tight break-words md:text-3xl">{recordTitle}</h1>
      <Link href={recordHref(accession)} className="text-primary w-fit text-sm underline-offset-2 hover:underline">
        Back to record
      </Link>
    </header>
    <div className="grid min-w-0 gap-6 lg:grid-cols-[16rem_minmax(0,1fr)]">
      <aside className="min-w-0">
        <ReplicaSwitcher accession={accession} replicas={replicas} current={replicaName} className="min-h-11 w-full lg:hidden" />
        <ReplicaRail accession={accession} replicas={replicas} current={replicaName} className="max-lg:hidden" />
      </aside>
      <div className="flex min-w-0 flex-col gap-6">
        <div className="flex flex-wrap items-center gap-2">
          <ReplicaTabs accession={accession} replicaName={replicaName} className="contents" />
          {toolbar}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  </div>
);

export { ReplicaShell };
