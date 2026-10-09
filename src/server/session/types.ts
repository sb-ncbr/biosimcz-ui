import "server-only";

// What an MDRepo client call needs: the headers to send. The transport (server/http) stays auth-agnostic.
type UpstreamAuth = { headers: Record<string, string> };

export type { UpstreamAuth };
