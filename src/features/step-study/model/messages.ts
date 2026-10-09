// Copy from plans/design/figma/missing-states.md 3.2. Keys are the registry paths of the study step.
const REQUIRED_MESSAGES: Record<string, string> = {
  title: "Add a title.",
  description: "Describe what was simulated and why.",
  authors: "Add at least one author.",
  communityId: "Choose a community.",
  access: "Choose who can access the data.",
  "embargo.until": "Choose the date the files open.",
  license: "Choose a license.",
};

const FORMAT_MESSAGES: Record<string, string> = {
  invalid_doi: "This is not a DOI. It looks like 10.1234/abcd.",
  invalid_orcid: "ORCID is not valid. It looks like 0000-0002-1825-0097.",
  invalid_ror: "This is not a ROR id. It looks like https://ror.org/02j46qs45.",
  invalid_date: "Use the format YYYY-MM-DD.",
  date_not_future: "Choose a date after today.",
};

const requiredMessage = (path: string): string => REQUIRED_MESSAGES[path] ?? "This field is required.";

const formatMessage = (code: string | undefined): string | null => (code === undefined ? null : (FORMAT_MESSAGES[code] ?? "This value is not valid."));

export { formatMessage, requiredMessage };
