import { Plus } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { loginHref } from "@/entities/session";
import { NewDepositionButton } from "@/features/deposition-create";
import { RecordSearchForm } from "@/features/record-search";
import { cn } from "@/shared/lib";
import { Button, H1, Lead } from "@/shared/ui";
import { SHELL, type HomeSummary } from "../model/types";
import { HeroSummary, HeroSummaryFallback } from "./HeroSummary";

const DEPOSITIONS_PATH = "/depositions";

// Signed-in users start a draft right away (as the app bar does); visitors sign in first and land on My depositions.
const DepositionAction = ({ signedIn }: { signedIn: boolean }) =>
  signedIn ? (
    <NewDepositionButton label="Deposition" ariaLabel="New deposition" size="lg" variant="outline" className="min-h-12" />
  ) : (
    <Button asChild size="lg" variant="outline" className="min-h-12">
      <Link href={loginHref(DEPOSITIONS_PATH)}>
        <Plus aria-hidden />
        Deposition
      </Link>
    </Button>
  );

// Text first and no imagery above the fold: the heading is the LCP element.
const HomeHero = ({ signedIn, summary }: { signedIn: boolean; summary: Promise<HomeSummary> }) => (
  <section aria-labelledby="home-title" className="border-border border-b">
    <div className={cn(SHELL, "py-14 md:py-20 lg:py-24")}>
      <p className="text-text-muted text-xs font-semibold tracking-wider uppercase">Molecular dynamics data</p>
      <H1 id="home-title" className="mt-3 max-w-3xl text-4xl leading-tight text-balance md:text-5xl">
        Repository of computational chemistry experiments
      </H1>
      <Lead className="text-text-muted mt-4 max-w-2xl text-base leading-7 md:text-lg md:leading-8">
        This repository contains experiments from various organizations. You can run simulations on experiments, download
        metadata, and explore what you need.
      </Lead>
      <div className="mt-8 flex max-w-3xl flex-col gap-3 sm:flex-row sm:items-center">
        <RecordSearchForm size="hero" className="min-w-0 flex-1" />
        <DepositionAction signedIn={signedIn} />
      </div>
      <Suspense fallback={<HeroSummaryFallback />}>
        <HeroSummary summary={summary} />
      </Suspense>
    </div>
  </section>
);

export { HomeHero };
