const DOI_PATTERN = /^10\.\d{4,9}\/\S+$/;
const ORCID_PATTERN = /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/;

// Returns null for anything that is not a well-formed DOI, so callers render plain text instead of a link.
// encodeURI keeps "/" but leaves "?" and "#", which would end the path, so those are escaped too.
const doiUrl = (doi: string | null | undefined): string | null =>
  doi && DOI_PATTERN.test(doi) ? `https://doi.org/${encodeURI(doi).replaceAll("?", "%3F").replaceAll("#", "%23")}` : null;

const orcidUrl = (orcid: string | null | undefined): string | null =>
  orcid && ORCID_PATTERN.test(orcid) ? `https://orcid.org/${orcid}` : null;

export { doiUrl, orcidUrl };
