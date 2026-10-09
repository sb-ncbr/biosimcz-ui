"use client";

import { createUrlNavigation } from "@/shared/lib/urlNavigation";
import { serializeListQuery } from "../model/urlState";
import type { DepositionListQuery } from "@/entities/deposition";

const { Provider, useUrlNavigation } = createUrlNavigation<DepositionListQuery>(serializeListQuery, "ListNavigation");

const ListNavigationProvider = Provider;
const useListNavigation = useUrlNavigation;

export { ListNavigationProvider, useListNavigation };
