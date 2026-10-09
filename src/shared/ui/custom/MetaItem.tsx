import { cn } from "@/shared/lib";
import { Icon } from "../icons";

type MetaIcon = "structure" | "access-open" | "access-embargoed" | "license";

// One footer fact of a card: icon plus text, muted when the value is missing.
const MetaItem = ({ icon, label, muted }: { icon: MetaIcon; label: string; muted: boolean }) => (
  <span className={cn("flex items-center gap-1.5", muted ? "text-text-muted" : "text-text")}>
    <Icon name={icon} className="size-3.5 shrink-0" />
    {label}
  </span>
);

export { MetaItem };
