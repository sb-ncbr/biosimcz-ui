"use client";

import { useCallback, useSyncExternalStore } from "react";

// "Show required" mode (missing-states 3.1): after "Go to field", Review or Publish, empty required fields say so.
// Kept per draft in session storage; storage can be blocked, then it lives only for the current page view.

const EVENT = "mdrepo:show-required";
const keyFor = (draftId: string): string => `mdrepo:show-required:${draftId}`;
const fallback = new Set<string>();

const read = (draftId: string): boolean => {
  try {
    return window.sessionStorage.getItem(keyFor(draftId)) === "1";
  } catch {
    return fallback.has(draftId);
  }
};

// Called by Review, Publish and "Go to field"; safe from any client code.
const enableShowRequired = (draftId: string): void => {
  try {
    window.sessionStorage.setItem(keyFor(draftId), "1");
  } catch {
    fallback.add(draftId);
  }
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { draftId } }));
};

const subscribe = (notify: () => void): (() => void) => {
  window.addEventListener(EVENT, notify);
  window.addEventListener("storage", notify);
  return () => {
    window.removeEventListener(EVENT, notify);
    window.removeEventListener("storage", notify);
  };
};

const useShowRequired = (draftId: string): [boolean, () => void] => {
  const value = useSyncExternalStore(
    subscribe,
    () => read(draftId),
    () => false,
  );
  const enable = useCallback(() => enableShowRequired(draftId), [draftId]);
  return [value, enable];
};

export { enableShowRequired, useShowRequired };
