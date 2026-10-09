"use client";

// A click on a blocked Publish button sends the user to Review and asks the missing-fields box to take focus and
// announce itself (missing-states 2.4, 3.4). The request lives outside React because the click happens in the shell
// while the box may not be mounted yet (navigation from another step).

const EVENT = "mdrepo:review-focus";
let pending = false;

const requestReviewFocus = (): void => {
  pending = true;
  window.dispatchEvent(new Event(EVENT));
};

// Returns true once per request.
const takeReviewFocus = (): boolean => {
  const was = pending;
  pending = false;
  return was;
};

const onReviewFocusRequest = (listener: () => void): (() => void) => {
  window.addEventListener(EVENT, listener);
  return () => window.removeEventListener(EVENT, listener);
};

export { onReviewFocusRequest, requestReviewFocus, takeReviewFocus };
