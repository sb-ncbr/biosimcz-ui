"use client";

import { createContext, useContext } from "react";
import { isValidOrcid } from "@/entities/deposition";

// Lookups behind Step 1: communities, keyword suggestions, DOI reservation (E-D7), ORCID and ROR. The BFF has no routes
// for them yet, so the default implementation is an in-memory mock with realistic latency.
// TODO(backend): swap `mockLookups` for a bffFetch-based implementation once /bff lookup routes exist; the interface
// below is the seam and the UI never imports the mock directly.

type Community = { id: string; name: string; url: string };
type Organisation = { rorId: string; name: string; country?: string };
type OrcidRecord = { orcid: string; givenName: string; familyName: string };

type OrcidResult = { status: "verified"; record: OrcidRecord } | { status: "not_found" };

type StudyLookups = {
  communities: () => Promise<Community[]>;
  keywords: (query: string) => Promise<string[]>;
  generateDoi: (draftId: string) => Promise<string>;
  orcid: (orcid: string) => Promise<OrcidResult>;
  organisations: (query: string) => Promise<Organisation[]>;
  organisationByRor: (rorId: string) => Promise<Organisation | null>;
};

const COMMUNITIES: Community[] = [
  { id: "ceitec", name: "CEITEC", url: "mdrepo.eu/communities/ceitec" },
  { id: "muni-biophysics", name: "Masaryk University Biophysics", url: "mdrepo.eu/communities/muni-biophysics" },
  { id: "iocb-prague", name: "IOCB Prague", url: "mdrepo.eu/communities/iocb-prague" },
];

const ORGANISATIONS: Organisation[] = [
  { rorId: "https://ror.org/02j46qs45", name: "Masaryk University", country: "CZ" },
  { rorId: "https://ror.org/04vhb0j83", name: "CEITEC", country: "CZ" },
  { rorId: "https://ror.org/05x7k3d91", name: "Brno Molecular Simulation Consortium", country: "CZ" },
  { rorId: "https://ror.org/024d6js02", name: "Charles University", country: "CZ" },
  { rorId: "https://ror.org/01pxwe438", name: "Czech Science Foundation", country: "CZ" },
];

const ORCIDS: Record<string, OrcidRecord> = {
  "0000-0002-1825-0097": { orcid: "0000-0002-1825-0097", givenName: "Josiah", familyName: "Carberry" },
};

const KEYWORDS = ["lysozyme", "protein dynamics", "explicit solvent", "membrane protein", "free energy", "GROMACS", "CHARMM36m"];

const normaliseRor = (value: string): string => (value.startsWith("https://ror.org/") ? value : `https://ror.org/${value}`).toLowerCase();

const wait = <T,>(value: T, ms = 120): Promise<T> => new Promise((resolve) => setTimeout(() => resolve(value), ms));

const mockLookups: StudyLookups = {
  communities: () => wait(COMMUNITIES),
  keywords: (query) => wait(KEYWORDS.filter((keyword) => keyword.toLowerCase().includes(query.trim().toLowerCase()))),
  generateDoi: (draftId) => wait(`10.1234/mdrepo.${draftId}`, 400),
  orcid: (orcid) => {
    const record = isValidOrcid(orcid) ? ORCIDS[orcid] : undefined;
    return wait<OrcidResult>(record ? { status: "verified", record } : { status: "not_found" }, 250);
  },
  organisations: (query) => {
    const needle = query.trim().toLowerCase();
    return wait(ORGANISATIONS.filter((org) => needle === "" || org.name.toLowerCase().includes(needle)));
  },
  organisationByRor: (rorId) => wait(ORGANISATIONS.find((org) => org.rorId === normaliseRor(rorId)) ?? null, 250),
};

const LookupsContext = createContext<StudyLookups>(mockLookups);

const useLookups = (): StudyLookups => useContext(LookupsContext);

export { LookupsContext, mockLookups, useLookups };
export type { Community, Organisation, OrcidRecord, OrcidResult, StudyLookups };
