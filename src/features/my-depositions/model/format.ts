import { ACCESS_LABELS, accessLabel, formatDay, licenseLabel, type DepositionListItem } from "@/entities/deposition";

// Copy of the cards (102:10726 and missing-states 4.5). Pure, so the server computes every label and the client
// never renders "2 h ago" from its own clock (no hydration mismatch).

// Wrapped so component bodies never call the impure Date.now directly.
const nowMs = (): number => Date.now();

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

// "Edited just now", "Edited 2 h ago", "Edited 3 weeks ago"; older than a month falls back to the date.
const formatEdited = (iso: string, now: number): string => {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const age = Math.max(0, now - then);
  if (age < MINUTE) return "Edited just now";
  if (age < HOUR) return `Edited ${Math.floor(age / MINUTE)} min ago`;
  if (age < DAY) return `Edited ${Math.floor(age / HOUR)} h ago`;
  if (age < 7 * DAY) return `Edited ${Math.floor(age / DAY)} d ago`;
  if (age < 30 * DAY) {
    const weeks = Math.floor(age / (7 * DAY));
    return `Edited ${weeks} ${weeks === 1 ? "week" : "weeks"} ago`;
  }
  return `Edited ${formatDay(iso)}`;
};

const formatPublished = (iso: string | null): string => (iso ? `Published ${formatDay(iso)}` : "Published");

const structureLabel = (structure: DepositionListItem["structure"]): string | null => {
  if (!structure) return null;
  if (structure.source === "custom" || structure.id === null) return "Custom structure";
  if (structure.source === "pdb") return `PDB ${structure.id}`;
  if (structure.source === "alphafold") return `AlphaFold ${structure.id}`;
  return structure.id;
};

const timeLabel = (item: DepositionListItem, now: number): string =>
  item.kind === "published" ? formatPublished(item.publishedAt) : formatEdited(item.updatedAt, now);

export { accessLabel, ACCESS_LABELS, formatDay, formatEdited, formatPublished, licenseLabel, nowMs, structureLabel, timeLabel };
