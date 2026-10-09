import type { AxisSpec, TooltipRow } from "../types";

const ESCAPES: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

const escapeHtml = (text: string): string => text.replace(/[&<>"']/g, (c) => ESCAPES[c]!);

// Class names are design-token utilities, so the tooltip follows light and dark mode without hex values.
const tooltipHtml = (rows: readonly TooltipRow[], heading?: string): string => {
  const head = heading ? `<div class="text-text mb-1 font-semibold">${escapeHtml(heading)}</div>` : "";
  const body = rows
    .map(
      (row) =>
        `<div class="flex justify-between gap-4"><span class="text-text-muted">${escapeHtml(row.label)}</span><span class="text-text font-medium">${escapeHtml(row.value)}</span></div>`,
    )
    .join("");
  return head + body;
};

// Unconfirmed units (plan Q5) are flagged with a trailing question mark.
const axisTitle = (axis: AxisSpec): string => {
  if (!axis.unit) return axis.label;
  return `${axis.label} (${axis.unit.text}${axis.unit.confirmed ? "" : "?"})`;
};

const formatValue = (value: number): string => (Number.isFinite(value) ? new Intl.NumberFormat("en", { maximumFractionDigits: 3 }).format(value) : "-");

export { axisTitle, escapeHtml, formatValue, tooltipHtml };
