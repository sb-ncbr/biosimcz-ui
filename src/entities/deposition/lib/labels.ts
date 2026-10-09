import type { AccessValue } from "../model/enums";

// Pure display labels shared by the deposition cards and the public record pages. Computed on the server so the
// client never formats dates from its own clock or locale.

const ACCESS_LABELS: Record<AccessValue, string> = { open: "Open", restricted: "Restricted", embargoed: "Embargoed" };

const dayFormat = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

const formatDay = (iso: string): string => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? "" : dayFormat.format(date);
};

// "cc-by-4.0" -> "CC BY 4.0", "cc0-1.0" -> "CC0 1.0". Unknown ids are still readable.
const licenseLabel = (license: string | null): string | null => {
  const id = license?.trim();
  if (!id) return null;
  return id
    .split("-")
    .map((part) => (/^\d/.test(part) ? part : part.toUpperCase()))
    .join(" ");
};

const accessLabel = (item: { access: AccessValue | null; embargoUntil: string | null }): string | null => {
  if (item.access === null) return null;
  if (item.access === "embargoed" && item.embargoUntil) return `Embargoed until ${formatDay(item.embargoUntil)}`;
  return ACCESS_LABELS[item.access];
};

export { ACCESS_LABELS, accessLabel, formatDay, licenseLabel };
