"use client";

import type { MouseEvent } from "react";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from "@e-infra/design-system";

type LinkPaginationProps = {
  page: number;
  pages: number;
  hrefFor: (page: number) => string;
  // Plain clicks go through this (client navigation); modified clicks keep the real link.
  onNavigate?: (page: number) => void;
};

const WINDOW = 2;

// Page numbers to show: first, last and two either side of the current page; null is a gap.
const pageWindow = (page: number, pages: number): (number | null)[] => {
  const around = Array.from({ length: 2 * WINDOW + 1 }, (_, index) => page - WINDOW + index);
  const shown = [...new Set([1, pages, ...around].filter((n) => n >= 1 && n <= pages))].sort((a, b) => a - b);
  return shown.flatMap((n, index) => (index > 0 && n - (shown[index - 1] ?? n) > 1 ? [null, n] : [n]));
};

// Real links (works without JS, right-click and copy), upgraded to client navigation on a plain click.
const LinkPagination = ({ page, pages, hrefFor, onNavigate }: LinkPaginationProps) => {
  if (pages <= 1) return null;
  const current = Math.min(page, pages);
  const go = (target: number) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    onNavigate(target);
  };

  return (
    <Pagination aria-label="Pagination" className="mt-10">
      <PaginationContent>
        {current > 1 ? (
          <PaginationItem>
            <PaginationPrevious href={hrefFor(current - 1)} onClick={go(current - 1)} />
          </PaginationItem>
        ) : null}
        {pageWindow(current, pages).map((entry, index) =>
          entry === null ? (
            <PaginationItem key={`gap-${index}`}>
              <span aria-hidden className="px-2">
                ...
              </span>
            </PaginationItem>
          ) : (
            <PaginationItem key={entry}>
              <PaginationLink href={hrefFor(entry)} isActive={entry === current} onClick={go(entry)}>
                {entry}
              </PaginationLink>
            </PaginationItem>
          ),
        )}
        {current < pages ? (
          <PaginationItem>
            <PaginationNext href={hrefFor(current + 1)} onClick={go(current + 1)} />
          </PaginationItem>
        ) : null}
      </PaginationContent>
    </Pagination>
  );
};

export { LinkPagination, pageWindow };
export type { LinkPaginationProps };
