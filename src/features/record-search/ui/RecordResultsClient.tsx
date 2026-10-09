"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/shared/lib";
import { LinkPagination } from "@/shared/ui";
import { serializeRecordQuery, setRecordPage } from "../model/urlState";
import { useRecordNavigation } from "./RecordNavigation";

// Keeps the previous cards on screen while a filter change loads (no skeleton flash) and tells assistive tech how many
// simulations there are. After a PAGE change it scrolls here and moves focus to the count; filter changes keep the position.
const RecordResultsRegion = ({
  total,
  children,
}: {
  total: number;
  children: ReactNode;
}) => {
  const { pending, query } = useRecordNavigation();
  const region = useRef<HTMLDivElement>(null);
  const status = useRef<HTMLParagraphElement>(null);
  const settledPage = useRef(query.page);

  useEffect(() => {
    if (pending || settledPage.current === query.page) return;
    settledPage.current = query.page;
    region.current?.scrollIntoView({ block: "start" });
    status.current?.focus({ preventScroll: true });
  }, [pending, query.page]);

  return (
    <div
      ref={region}
      aria-busy={pending}
      className={cn(
        "mt-4 scroll-mt-20 transition-opacity",
        pending && "opacity-60",
      )}
    >
      <p ref={status} role="status" tabIndex={-1} className="sr-only">
        {total === 0
          ? "No simulations match"
          : `${total.toLocaleString("en")} ${total === 1 ? "simulation" : "simulations"}`}
      </p>
      {children}
    </div>
  );
};

const RecordPagination = ({ total, size }: { total: number; size: number }) => {
  const { query, navigate } = useRecordNavigation();
  const pathname = usePathname();
  return (
    <LinkPagination
      page={query.page}
      pages={Math.max(1, Math.ceil(total / size))}
      hrefFor={(page) =>
        `${pathname}${serializeRecordQuery(setRecordPage(query, page))}`
      }
      onNavigate={(page) => navigate(setRecordPage(query, page))}
    />
  );
};

export { RecordPagination, RecordResultsRegion };
