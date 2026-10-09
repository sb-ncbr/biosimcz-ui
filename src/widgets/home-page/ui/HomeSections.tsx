import { ArrowRight, FileText, Search, Share2, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { loginHref } from "@/entities/session";
import { cn } from "@/shared/lib";
import { Button, Card, H2, H3, P } from "@/shared/ui";
import { SHELL } from "../model/types";
import { NetworkIllustration } from "./NetworkIllustration";
import { TrajectoryIllustration } from "./TrajectoryIllustration";

const ExploreSection = () => (
  <section aria-labelledby="explore-title" className="bg-surface">
    <div className={cn(SHELL, "grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24")}>
      <div className="md:order-last">
        <H2 id="explore-title" className="text-2xl text-balance md:text-3xl">
          Explore data through interactive simulations
        </H2>
        <P className="text-text-muted mt-4 max-w-xl">
          Dive into a rich library of chemistry experiments presented as dynamic, easy-to-read graphs. Analyze trends and gain
          real insights. Our tools help researchers, students, and educators make sense of complex data through clear
          visualizations, all accessible from your browser.
        </P>
        <Button asChild variant="outline" className="mt-8 max-md:min-h-11">
          <Link href="/records">
            Browse simulations
            <ArrowRight aria-hidden />
          </Link>
        </Button>
      </div>
      <TrajectoryIllustration className="w-full max-w-xl md:justify-self-start" />
    </div>
  </section>
);

type AboutCard = { title: string; text: string; href: string; icon: LucideIcon };

const aboutCards = (signedIn: boolean): AboutCard[] => [
  { title: "Explore", text: "Browse and explore our data.", href: "/records", icon: Search },
  { title: "Share", text: "Share your data with others.", href: signedIn ? "/depositions" : loginHref("/depositions"), icon: Share2 },
  // No public documentation URL exists yet; the records are the closest place to start using the data.
  { title: "Use", text: "Use data for your purpose.", href: "/records", icon: FileText },
];

const AboutSection = ({ signedIn }: { signedIn: boolean }) => (
  <section aria-labelledby="about-title">
    <div className={cn(SHELL, "py-16 md:py-24")}>
      <div className="max-w-3xl">
        <H2 id="about-title" className="text-2xl md:text-3xl">
          About MDRepo
        </H2>
        <P className="text-text-muted mt-4">
          Our mission is to make computational chemistry data accessible and easy to explore. This platform brings together a
          wide range of experiments from trusted institutions, offering detailed metadata, simulation tools, and interactive
          visualizations. The repository helps you analyze and build upon existing chemical data, all in one place.
        </P>
      </div>
      <ul className="mt-10 grid gap-4 md:grid-cols-3">
        {aboutCards(signedIn).map(({ title, text, href, icon: Icon }) => (
          <li key={title}>
            <Card className="border-border bg-background hover:bg-surface focus-within:ring-border-focus/50 relative h-full justify-start gap-0 rounded-xl border p-6 drop-shadow-none transition-colors focus-within:ring-[3px] hover:drop-shadow-none">
              <span className="bg-base-100 inline-flex size-10 items-center justify-center rounded-lg">
                <Icon className="size-5" aria-hidden />
              </span>
              <H3 className="mt-6 text-lg">
                {/* The link covers the card, so the whole tile is one target with one name. */}
                <Link href={href} className="outline-none after:absolute after:inset-0 after:rounded-xl">
                  {title}
                </Link>
              </H3>
              <P className="text-text-muted mt-1 text-sm leading-6">{text}</P>
              <ArrowRight className="text-text-muted absolute top-6 right-6 size-4" aria-hidden />
            </Card>
          </li>
        ))}
      </ul>
    </div>
  </section>
);

const CommunitySection = () => (
  <section aria-labelledby="community-title" className="bg-surface">
    <div className={cn(SHELL, "grid items-center gap-10 py-16 md:grid-cols-2 md:gap-16 md:py-24")}>
      <div>
        <H2 id="community-title" className="text-2xl md:text-3xl">
          Community
        </H2>
        <P className="text-text-muted mt-4 max-w-xl">
          Join our growing network of people working with computational chemistry data. Share insights, discuss experiments,
          and collaborate on new ideas. Whether you are contributing datasets, helping improve simulations, or just exploring,
          your voice adds value to the community.
        </P>
        <Button asChild className="mt-8 max-md:min-h-11">
          <Link href="/communities">Join community</Link>
        </Button>
      </div>
      <NetworkIllustration className="mx-auto max-w-sm" />
    </div>
  </section>
);

export { AboutSection, CommunitySection, ExploreSection };
