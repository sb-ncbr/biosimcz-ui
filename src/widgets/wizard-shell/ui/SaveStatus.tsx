import { AlertCircle, CloudOff, Loader2, Lock } from "lucide-react";
import { Icon } from "@/shared/ui";
import { cn } from "@/shared/lib";
import type { SaveState } from "../model/types";

const COPY: Record<Exclude<SaveState["kind"], "saved">, string> = {
  saving: "Saving...",
  retrying: "Not saved - retrying",
  failed: "Not saved",
  offline: "Offline - kept on this device",
  "session-expired": "Not saved - log in again",
  conflict: "Newer version on server",
};

const glyph = (save: SaveState) => {
  switch (save.kind) {
    case "saved":
      return <Icon name="cloud-upload-12" className="size-3" />;
    case "saving":
      return <Loader2 className="size-3 motion-safe:animate-spin" aria-hidden="true" />;
    case "offline":
      return <CloudOff className="size-3" aria-hidden="true" />;
    case "session-expired":
      return <Lock className="size-3" aria-hidden="true" />;
    default:
      return <AlertCircle className="size-3" aria-hidden="true" />;
  }
};

const tone = (save: SaveState) => {
  if (save.kind === "saved" || save.kind === "saving") return "text-text-muted";
  return save.kind === "offline" ? "text-warning-700" : "text-error-700";
};

// Icon plus text so the state never depends on colour alone. Announcements live in the shell's live region.
const SaveStatus = ({ save, className }: { save: SaveState; className?: string }) => (
  <p className={cn("flex items-center gap-1 text-[10px] leading-3 font-medium", tone(save), className)}>
    {glyph(save)}
    <span>{save.kind === "saved" ? save.label : COPY[save.kind]}</span>
  </p>
);

const SAVE_ANNOUNCEMENTS: Partial<Record<SaveState["kind"], string>> = {
  failed: "Not saved",
  offline: "Offline",
  "session-expired": "Not saved, log in again",
  conflict: "A newer version exists on the server",
};

// Routine autosaves stay silent; only states that need attention are announced.
const saveAnnouncement = (save: SaveState): string => SAVE_ANNOUNCEMENTS[save.kind] ?? "";

export { SaveStatus, saveAnnouncement };
