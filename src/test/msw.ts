import { setupServer } from "msw/node";

// Handlers are added per test until mocks/handlers exists (Phase 1).
const server = setupServer();

export { server };
