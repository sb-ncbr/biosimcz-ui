"use client";

import { useEffect } from "react";
import { clearAllMirrors } from "../model/mirror";

// Rendered only where no session exists (the login page).
const ClearMirrorsOnMount = (): null => {
  useEffect(() => {
    void clearAllMirrors();
  }, []);
  return null;
};

export { ClearMirrorsOnMount };
