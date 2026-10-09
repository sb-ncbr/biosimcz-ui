import type { HomeSummary } from "../model/types";
import { HomeHero } from "./HomeHero";
import { AboutSection, CommunitySection, ExploreSection } from "./HomeSections";

// Same order as the previous homepage: hero with search, explore, about, community. The footer comes from the layout.
const HomePage = ({ signedIn, summary }: { signedIn: boolean; summary: Promise<HomeSummary> }) => (
  <>
    <HomeHero signedIn={signedIn} summary={summary} />
    <ExploreSection />
    <AboutSection signedIn={signedIn} />
    <CommunitySection />
  </>
);

export { HomePage };
