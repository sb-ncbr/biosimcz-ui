import { UPLOAD_LIMITS } from "@/shared/config/client";

const MAX_KEY_LENGTH = 200;
// Path separators, NUL and other control characters, and Windows-reserved punctuation never belong in a file key.
const FORBIDDEN_KEY_CHARS = /[\u0000-\u001f\u007f/\\:*?"<>|]/;
const DRAFT_ID = /^[A-Za-z0-9_-]{1,64}$/;

const ALL_EXTENSIONS: readonly string[] = [...new Set([...UPLOAD_LIMITS.systemExtensions, ...UPLOAD_LIMITS.experimentExtensions])];

const extensionOf = (name: string): string => {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? name.slice(dot).toLowerCase() : "";
};

type KeyProblem = "empty" | "too_long" | "forbidden_chars" | "dot_segment" | "extension";

// Returns the problem, or null when the key is safe to send upstream. Spaces, "#", "%" and unicode are legal:
// the HTTP core percent-encodes every path segment, so they cannot alter the URL structure.
const fileKeyProblem = (key: string, allowed: readonly string[] = ALL_EXTENSIONS): KeyProblem | null => {
  if (key.length === 0 || key.trim().length === 0) return "empty";
  if (key.length > MAX_KEY_LENGTH) return "too_long";
  if (FORBIDDEN_KEY_CHARS.test(key)) return "forbidden_chars";
  if (key.startsWith(".") || key.endsWith(".") || key.includes("..") || key !== key.trim()) return "dot_segment";
  if (!allowed.includes(extensionOf(key))) return "extension";
  return null;
};

const isValidDraftId = (value: string): boolean => DRAFT_ID.test(value);

export { ALL_EXTENSIONS, extensionOf, fileKeyProblem, isValidDraftId, MAX_KEY_LENGTH };
export type { KeyProblem };
