import type { Study } from "@/entities/deposition";
import { labelOf, LICENSES } from "@/features/step-study";

const DATE = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

// "2027-03-01" -> "1 Mar 2027". Anything that is not an ISO date is shown as typed.
const formatDate = (iso: string): string => {
  const date = new Date(`${iso}T00:00:00Z`);
  return Number.isNaN(date.getTime()) ? iso : DATE.format(date);
};

const licenseLabel = (study: Study): string => labelOf(LICENSES, study.license) || "no license chosen";

const ACCESS_LABEL = { open: "Open", restricted: "Restricted", embargoed: "Embargoed" } as const;

const accessLabel = (study: Study): string => (study.access ? ACCESS_LABEL[study.access] : "");

// Secondary text after the access value; the embargo date is shown, as missing-states 5.5 proposes.
const accessNote = (study: Study): string => {
  switch (study.access) {
    case "open":
      return "Anyone can view and download the files";
    case "restricted":
      return "Files are available on request";
    case "embargoed": {
      const until = study.embargo?.until;
      const base = until ? `Files open on ${formatDate(until)}` : "Files open on a date not set yet";
      const reason = study.embargo?.reason?.trim();
      return reason ? `${base} - ${reason}` : base;
    }
    default:
      return "";
  }
};

// The access sentence of the confirm dialog (missing-states 6.2).
const accessSentence = (study: Study): string => {
  const until = study.embargo?.until;
  switch (study.access) {
    case "open":
      return "Anyone can view and download the files.";
    case "restricted":
      return "Anyone can see the description. Files are available on request.";
    case "embargoed":
      return until ? `Anyone can see the description. Files open on ${formatDate(until)}.` : "Anyone can see the description. Files open later.";
    default:
      return "";
  }
};

export { accessLabel, accessNote, accessSentence, formatDate, licenseLabel };
