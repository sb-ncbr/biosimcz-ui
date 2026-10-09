"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";

type TrajectoryInputs = { frames: string; selection: string };

const FRAMES_PARAM = "frames";
const SELECTION_PARAM = "selection";

const toQuery = ({ frames, selection }: TrajectoryInputs): string => {
  const params = new URLSearchParams();
  if (frames !== "") params.set(FRAMES_PARAM, frames);
  if (selection !== "") params.set(SELECTION_PARAM, selection);
  return params.toString();
};

// The request lives in the URL so a link reproduces the form, but it only prefills: loading frames is always an explicit
// submit, because a shared link must not start a download of hundreds of megabytes.
const useTrajectoryRequest = () => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [committed, setCommitted] = useState<TrajectoryInputs>(() => ({
    frames: searchParams.get(FRAMES_PARAM)?.trim() ?? "",
    selection: searchParams.get(SELECTION_PARAM)?.trim() ?? "",
  }));

  const commit = useCallback(
    (next: TrajectoryInputs) => {
      setCommitted(next);
      const query = toQuery(next);
      router.replace(query === "" ? pathname : `${pathname}?${query}`, { scroll: false });
    },
    [pathname, router],
  );

  return { request: committed, commit };
};

export { useTrajectoryRequest };
export type { TrajectoryInputs };
