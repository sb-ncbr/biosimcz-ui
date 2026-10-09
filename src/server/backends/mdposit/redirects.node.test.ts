import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { fetchFollowingOneRedirect } from "./redirects";

const redirect = (location: string): Response => new HttpResponse(null, { status: 302, headers: { location } });

let hops = 0;
let canonicalCalls = 0;

beforeEach(() => {
  setTestEnv();
  hops = 0;
  canonicalCalls = 0;
});

// Ids are unique per test because the canonical cache lives for the whole process.
const upstreamRedirectsTo = (id: string, location: string): void => {
  server.use(
    http.get(`http://mdposit.test/api/rest/v1/projects/${id}/analyses/rgyr`, () => {
      hops++;
      return redirect(location);
    }),
  );
};

const canonicalServes = (id: string, status = 200): void => {
  server.use(
    http.get(`https://x.mddbr.eu/api/rest/v1/projects/${id}/analyses/rgyr`, () => {
      canonicalCalls++;
      return status === 200 ? HttpResponse.json({ ok: true }) : new HttpResponse(null, { status });
    }),
  );
};

describe("fetchFollowingOneRedirect", () => {
  it("returns a direct 200 without a hop", async () => {
    server.use(http.get("http://mdposit.test/api/rest/v1/projects/direct-1/analyses/rgyr", () => HttpResponse.json({ ok: true })));
    const response = await fetchFollowingOneRedirect(["projects", "direct-1", "analyses", "rgyr"]);
    expect(await response.json()).toEqual({ ok: true });
  });

  it("follows one 302 to an https *.mddbr.eu host", async () => {
    upstreamRedirectsTo("follow-1", "https://x.mddbr.eu/api/rest/v1/projects/follow-1/analyses/rgyr");
    canonicalServes("follow-1");
    const response = await fetchFollowingOneRedirect(["projects", "follow-1", "analyses", "rgyr"]);
    expect(await response.json()).toEqual({ ok: true });
    expect(hops).toBe(1);
  });

  it.each(["https://evil.example.com/x", "http://x.mddbr.eu/x", "https://x.mddbr.eu:8443/x", "https://mddbr.eu.evil.com/x"])(
    "answers 502 bad_redirect for a hop to %s and does not follow it",
    async (location) => {
      let followed = false;
      upstreamRedirectsTo("bad-1", location);
      server.use(
        http.get(location, () => {
          followed = true;
          return HttpResponse.json({});
        }),
      );
      await expect(fetchFollowingOneRedirect(["projects", "bad-1", "analyses", "rgyr"])).rejects.toMatchObject({
        status: 502,
        code: "bad_redirect",
      });
      expect(followed).toBe(false);
    },
  );

  it.each(["https://user@x.mddbr.eu/x", "https://user:pw@x.mddbr.eu/x", "https://:pw@x.mddbr.eu/x"])(
    "answers 502 bad_redirect for a Location with userinfo: %s",
    async (location) => {
      upstreamRedirectsTo("userinfo-1", location);
      await expect(fetchFollowingOneRedirect(["projects", "userinfo-1", "analyses", "rgyr"])).rejects.toMatchObject({
        status: 502,
        code: "bad_redirect",
      });
    },
  );

  it("answers 502 bad_redirect, not a TypeError, for a malformed Location", async () => {
    upstreamRedirectsTo("malformed-1", "https://[::1");
    await expect(fetchFollowingOneRedirect(["projects", "malformed-1", "analyses", "rgyr"])).rejects.toMatchObject({
      status: 502,
      code: "bad_redirect",
    });
  });

  it("does not cache the canonical host when the second hop fails", async () => {
    upstreamRedirectsTo("nocache-1", "https://x.mddbr.eu/api/rest/v1/projects/nocache-1/analyses/rgyr");
    canonicalServes("nocache-1", 500);
    const path = ["projects", "nocache-1", "analyses", "rgyr"];
    await expect(fetchFollowingOneRedirect(path, { retry: false })).rejects.toBeDefined();
    canonicalServes("nocache-1");
    await (await fetchFollowingOneRedirect(path)).arrayBuffer();
    expect(hops).toBe(2);
  });

  it("answers 502 when the allowed host redirects again",async () => {
    upstreamRedirectsTo("twice-1", "https://x.mddbr.eu/api/rest/v1/projects/twice-1/analyses/rgyr");
    server.use(http.get("https://x.mddbr.eu/api/rest/v1/projects/twice-1/analyses/rgyr", () => redirect("https://y.mddbr.eu/loop")));
    await expect(fetchFollowingOneRedirect(["projects", "twice-1", "analyses", "rgyr"])).rejects.toMatchObject({
      status: 502,
      code: "bad_redirect",
    });
  });

  it("skips the hop on the second call for the same project (canonical cache)", async () => {
    upstreamRedirectsTo("cache-1", "https://x.mddbr.eu/api/rest/v1/projects/cache-1/analyses/rgyr");
    canonicalServes("cache-1");
    const path = ["projects", "cache-1", "analyses", "rgyr"];
    await (await fetchFollowingOneRedirect(path)).arrayBuffer();
    await (await fetchFollowingOneRedirect(path)).arrayBuffer();
    expect(hops).toBe(1);
    expect(canonicalCalls).toBe(2);
  });

  it("drops the cache entry and retries once when the cached host answers 404", async () => {
    upstreamRedirectsTo("drop-1", "https://x.mddbr.eu/api/rest/v1/projects/drop-1/analyses/rgyr");
    canonicalServes("drop-1");
    const path = ["projects", "drop-1", "analyses", "rgyr"];
    await (await fetchFollowingOneRedirect(path)).arrayBuffer();
    canonicalServes("drop-1", 404);
    await expect(fetchFollowingOneRedirect(path)).rejects.toMatchObject({ kind: "not_found" });
    // The cached call 404s, then the request goes back through the origin hop and 404s again.
    expect(hops).toBe(2);
    expect(canonicalCalls).toBe(3);
  });

  it("follows the redirect query once, then sends its own query on a cached call", async () => {
    const seen: string[] = [];
    server.use(
      http.get("http://mdposit.test/api/rest/v1/projects/q-1/structure", () =>
        redirect("https://x.mddbr.eu/api/rest/v1/projects/q-1/structure?selection=a"),
      ),
      http.get("https://x.mddbr.eu/api/rest/v1/projects/q-1/structure", ({ request }) => {
        seen.push(new URL(request.url).search);
        return new HttpResponse("ATOM", { headers: { "content-type": "text/plain" } });
      }),
    );
    const path = ["projects", "q-1", "structure"];
    await (await fetchFollowingOneRedirect(path, { query: { selection: "name CA" } })).text();
    await (await fetchFollowingOneRedirect(path, { query: { selection: "name CA" } })).text();
    expect(seen).toEqual(["?selection=a", "?selection=name+CA"]);
  });
});
