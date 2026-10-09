"use client";

import { usePathname } from "next/navigation";
import { LinkPagination } from "@/shared/ui";
import { serializeListQuery, setPage } from "../model/urlState";
import { useListNavigation } from "./ListNavigation";

type ResultsPaginationProps = { total: number; size: number };

const ResultsPagination = ({ total, size }: ResultsPaginationProps) => {
  const { query, navigate } = useListNavigation();
  const pathname = usePathname();
  return (
    <LinkPagination
      page={query.page}
      pages={Math.max(1, Math.ceil(total / size))}
      hrefFor={(page) => `${pathname}${serializeListQuery(setPage(query, page))}`}
      onNavigate={(page) => navigate(setPage(query, page))}
    />
  );
};

export { ResultsPagination };
