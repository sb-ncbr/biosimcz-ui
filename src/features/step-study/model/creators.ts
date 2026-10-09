import type { Creator } from "@/entities/deposition";

const ROLES = ["Principal investigator", "Researcher", "Data curator", "Project member", "Supervisor"] as const;

const isOrganisation = (creator: Creator): boolean => creator.kind === "organization";

const displayName = (creator: Creator): string => {
  if (isOrganisation(creator)) return creator.name?.trim() ?? "";
  return [creator.givenName, creator.familyName]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
};

const initials = (creator: Creator): string =>
  [creator.givenName, creator.familyName].map((part) => part?.trim().charAt(0).toUpperCase() ?? "").join("");

// "Principal investigator - Masaryk University, CEITEC" (the frame uses a middle dot).
const subtitle = (creator: Creator): string => {
  if (isOrganisation(creator)) {
    const ror = creator.rorId?.replace("https://ror.org/", "");
    return ror ? `Organization · ROR ${ror}` : "Organization";
  }
  const affiliations = creator.affiliations.map((item) => item.name).join(", ");
  return [creator.role, affiliations].filter(Boolean).join(" · ") || "No role or affiliation";
};

const move = <T,>(items: readonly T[], from: number, to: number): T[] => {
  if (to < 0 || to >= items.length || from === to) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item as T);
  return next;
};

export { displayName, initials, isOrganisation, move, ROLES, subtitle };
