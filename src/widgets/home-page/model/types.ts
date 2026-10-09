// What the homepage shows of the live repository. null = the repository could not be asked; the hero stays usable.
type HomeEngine = { key: string; label: string; count: number | null };

type HomeSummary = { total: number | null; engines: HomeEngine[] } | null;

const SHELL = "mx-auto w-full max-w-screen-2xl px-4 md:px-6 xl:px-12";

export { SHELL };
export type { HomeSummary };
