"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { cn } from "@/shared/lib";
import { copyText } from "@/shared/lib/copyText";
import { Button } from "@/shared/ui";

type CopyButtonProps = {
  text: string;
  // Lower-case noun for the toast and the accessible name: "citation", "sequence".
  what: string;
  label?: string;
  variant?: "ghost" | "outline";
  className?: string;
};

const RESET_MS = 2000;

// The toast confirms for sighted users; the swapped label is announced by the live region for screen readers.
const CopyButton = ({ text, what, label = "Copy", variant = "ghost", className }: CopyButtonProps) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), RESET_MS);
    return () => window.clearTimeout(timer);
  }, [copied]);

  return (
    <Button
      type="button"
      variant={variant}
      size="sm"
      aria-label={copied ? `${what} copied` : `Copy ${what}`}
      onClick={async () => setCopied(await copyText(text, what))}
      className={cn("h-8 gap-1.5 px-2.5 text-xs font-medium max-md:min-h-11", className)}
    >
      {copied ? <Check className="size-3.5" aria-hidden /> : <Copy className="size-3.5" aria-hidden />}
      <span aria-live="polite">{copied ? "Copied" : label}</span>
    </Button>
  );
};

export { CopyButton };
