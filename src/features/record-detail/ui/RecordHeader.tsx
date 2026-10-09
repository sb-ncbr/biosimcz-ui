import Link from "next/link";
import type { ReactNode } from "react";
import {
  Badge,
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/shared/ui";

const RecordBreadcrumb = ({ current }: { current: string }) => (
  <Breadcrumb>
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink asChild>
          <Link href="/">Home</Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem>
        <BreadcrumbLink asChild>
          <Link href="/records">Search</Link>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      <BreadcrumbItem className="min-w-0">
        <BreadcrumbPage className="block max-w-48 truncate sm:max-w-80">{current}</BreadcrumbPage>
      </BreadcrumbItem>
    </BreadcrumbList>
  </Breadcrumb>
);

type RecordHeaderProps = {
  title: string;
  accession: string | null;
  dataType: string | null;
  // Shown under the title; a long description stays in the lead, the page has no second copy of it.
  lead: string | null;
  byline: ReactNode;
};

// Every record on this page is public, hence the fixed "Published" badge.
const RecordHeader = ({ title, accession, dataType, lead, byline }: RecordHeaderProps) => (
  <header className="flex flex-col gap-4">
    <RecordBreadcrumb current={title} />
    <div className="flex flex-wrap items-center gap-2">
      {accession ? (
        <Badge variant="outline" className="px-2 py-0.5 font-mono text-xs font-medium">
          {accession}
        </Badge>
      ) : null}
      {dataType ? (
        <Badge variant="secondary" className="px-2 py-0.5 text-xs font-medium">
          {dataType}
        </Badge>
      ) : null}
      <Badge variant="secondary" className="px-2 py-0.5 text-xs font-medium">
        Published
      </Badge>
    </div>
    <h1 className="text-2xl leading-tight font-semibold tracking-tight break-words md:text-3xl">{title}</h1>
    {byline}
    {lead ? <p className="text-text max-w-3xl text-[15px] leading-relaxed whitespace-pre-line md:text-[17px]">{lead}</p> : null}
  </header>
);

export { RecordBreadcrumb, RecordHeader };
