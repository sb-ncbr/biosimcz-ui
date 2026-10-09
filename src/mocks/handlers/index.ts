import type { HttpHandler } from "msw";
import { mdpositHandlers } from "./mdposit";
import { mdrepoHandlers } from "./mdrepo";
import { myDepositionsHandlers } from "./myDepositions";
import { oidcHandlers } from "./oidc";
import { proposedHandlers } from "./proposed";
import { recordsHandlers } from "./records";
import { createMockState, type MockOptions, type MockState } from "./state";

type MockBackend = { handlers: HttpHandler[]; state: MockState };

// Handlers use "*" hosts, so the same set serves Vitest (setupServer) and the standalone mock server.
const createMockBackend = (options: MockOptions = {}): MockBackend => {
  const state = createMockState(options);
  return {
    state,
    handlers: [
      ...oidcHandlers(state),
      ...mdrepoHandlers(state),
      ...myDepositionsHandlers(state),
      ...recordsHandlers(state),
      ...proposedHandlers(state),
      ...mdpositHandlers(),
    ],
  };
};

export { createMockBackend };
export type { MockBackend, MockOptions, MockState };
