"use client";

import { useDraft } from "@/features/draft";
import { useRunActions } from "../model/useRunActions";
import { AddRunMenu } from "./AddRunMenu";

// Header action of the runs table page. With no runs the empty state carries the menu instead.
const AddRunButton = () => {
  const { draft } = useDraft();
  const { addRun } = useRunActions();
  if (draft.runs.length === 0) return null;
  return <AddRunMenu onAdd={addRun} className="max-md:w-full" />;
};

export { AddRunButton };
