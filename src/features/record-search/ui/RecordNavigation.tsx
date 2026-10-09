"use client";

import type { RecordSearchQuery } from "@/entities/record";
import { createUrlNavigation } from "@/shared/lib/urlNavigation";
import { serializeRecordQuery } from "../model/urlState";

const { Provider, useUrlNavigation } = createUrlNavigation<RecordSearchQuery>(
  serializeRecordQuery,
  "RecordNavigation",
);

const RecordNavigationProvider = Provider;
const useRecordNavigation = useUrlNavigation;

export { RecordNavigationProvider, useRecordNavigation };
