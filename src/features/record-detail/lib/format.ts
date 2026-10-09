import { licenseLabel } from "@/entities/deposition";
import type { DefinitionItem } from "@/entities/deposition/ui";

// Public page: a row without a value is left out instead of saying "Not provided".
const present = (items: DefinitionItem[]): DefinitionItem[] =>
  items.filter((item) => item.description !== undefined && !(Array.isArray(item.description) && item.description.length === 0));

const count = (value: number | null): string | undefined => (value === null ? undefined : value.toLocaleString("en"));

// MDRepo licenses are ids ("cc-by-4.0"); MDposit licenses are sentences that must stay as written.
const licenseText = (license: string | null): string | null => (license !== null && /\s/.test(license) ? license : licenseLabel(license));

// "trajectory" -> "Trajectory".
const capitalize = (value: string): string => value.charAt(0).toUpperCase() + value.slice(1);

// Identifier patterns: anything else renders as plain text, never as a link.
const PDB_ID = /^[0-9][A-Za-z0-9]{3}$/;
const UNIPROT_ID = /^[A-Za-z0-9]{6,10}$/;

const pdbUrl = (id: string): string | null => (PDB_ID.test(id) ? `https://www.rcsb.org/structure/${id.toUpperCase()}` : null);
const uniprotUrl = (id: string): string | null => (UNIPROT_ID.test(id) ? `https://www.uniprot.org/uniprotkb/${id}` : null);

const EMAIL = /([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})/;

// Splits free text into plain parts and e-mail addresses (odd indexes), so addresses can become mailto links.
const splitEmails = (text: string): string[] => text.split(EMAIL);

// "trajectory.bin" -> "BIN"; no extension -> undefined.
const fileType = (name: string): string | undefined => {
  const match = /\.([A-Za-z0-9]{1,8})$/.exec(name);
  return match?.[1]?.toUpperCase();
};

// Blocks of ten residues, the way sequence viewers print them; copying uses the raw string.
const residueBlocks = (sequence: string): string => sequence.replace(/(.{10})(?=.)/g, "$1 ");

export { capitalize, count, fileType, licenseText, pdbUrl, present, residueBlocks, splitEmails, uniprotUrl };
