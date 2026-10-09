"use client";

import Link from "next/link";
import { useSelectedLayoutSegments } from "next/navigation";
import { Fragment } from "react";
import { labelOf } from "@/entities/analysis";
import { experimentsHref, replicaHref } from "@/entities/replica";
import { recordHref } from "@/entities/record/lib/href";
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/shared/ui";
import { isTab } from "../model/targetHref";

const TAB_LABELS = { overview: "Overview", trajectory: "Trajectory", analyses: "Analyses" } as const;

type ReplicaBreadcrumbProps = { accession: string; recordTitle: string; replicaName: string };

type Crumb = { label: string; href: string | null };

const ReplicaBreadcrumb = ({ accession, recordTitle, replicaName }: ReplicaBreadcrumbProps) => {
  const segments = useSelectedLayoutSegments();
  const tab = isTab(segments[0]) ? segments[0] : null;
  const analysis = tab === "analyses" ? segments[1] : undefined;

  const crumbs: Crumb[] = [
    { label: "Records", href: "/records" },
    { label: recordTitle, href: recordHref(accession) },
    { label: "Experiments", href: experimentsHref(accession) },
    { label: replicaName, href: replicaHref(accession, replicaName, "overview") },
  ];
  if (tab) crumbs.push({ label: TAB_LABELS[tab], href: analysis ? replicaHref(accession, replicaName, tab) : null });
  if (analysis) crumbs.push({ label: labelOf(analysis), href: null });
  const last = crumbs.length - 1;

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, index) => (
          <Fragment key={`${index}-${crumb.label}`}>
            {index > 0 ? <BreadcrumbSeparator /> : null}
            <BreadcrumbItem className="min-w-0">
              {index === last || !crumb.href ? (
                <BreadcrumbPage className="block max-w-40 truncate sm:max-w-64">{crumb.label}</BreadcrumbPage>
              ) : (
                <BreadcrumbLink asChild>
                  <Link href={crumb.href} className="block max-w-32 truncate sm:max-w-56">
                    {crumb.label}
                  </Link>
                </BreadcrumbLink>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  );
};

export { ReplicaBreadcrumb };
