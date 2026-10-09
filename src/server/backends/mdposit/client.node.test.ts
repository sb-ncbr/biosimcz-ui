import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockBackend } from "@/mocks/handlers";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import * as mdposit from "./client";

beforeEach(() => {
  setTestEnv();
  server.use(...createMockBackend().handlers);
});

describe("MDposit client (#1-#6, S1-S4)", () => {
  it("#1 lists projects, sending sort as JSON like the old UI", async () => {
    let sort: string | null = null;
    server.use(
      http.get("*/api/rest/v1/projects", ({ request }) => {
        sort = new URL(request.url).searchParams.get("sort");
        return HttpResponse.json({ projects: [], filteredCount: 0, totalCount: 0 });
      }),
    );
    await mdposit.listProjects({ search: "lyso", sort: { _id: -1 } });
    expect(sort).toBe('{"_id":-1}');
    server.resetHandlers(...createMockBackend().handlers);
    const found = (await mdposit.listProjects({ search: "lysozyme" })) as unknown as { projects: unknown[] };
    expect(found.projects).toHaveLength(1);
  });

  it("#2 project by accession or replica id, 404 becomes not_found", async () => {
    expect(await mdposit.getProject("MD-A00001")).toMatchObject({ accession: "MD-A00001" });
    expect(await mdposit.getProject("MD-A00001.2")).toMatchObject({ accession: "MD-A00001" });
    await expect(mdposit.getProject("MD-A99999")).rejects.toMatchObject({ kind: "not_found", backend: "mdposit" });
  });

  it("S1, #3 and #3b analyses, S2, S3, S4", async () => {
    expect(await mdposit.listAnalyses("MD-A00001")).toContain("rgyr");
    expect(await mdposit.getAnalysis("MD-A00001.1", "rgyr")).toBeTruthy();
    await expect(mdposit.getAnalysis("MD-A00001.1", "nope")).rejects.toMatchObject({ kind: "not_found" });
    expect(await mdposit.getProjectOptions({ projection: "metadata.PROGRAM" })).toHaveProperty(["metadata.PROGRAM", "GROMACS"]);
    expect(await mdposit.getProjectsSummary()).toMatchObject({ projectsCount: 25 });
    expect(await mdposit.getPdbReference("1aki")).toMatchObject({ id: "1AKI" });
    expect(await mdposit.getTopology("MD-A00001")).toBeTruthy();
    expect(await mdposit.getReferences("MD-A00001")).toEqual([]);
  });

  it("encodes path parameters", async () => {
    let path = "";
    server.use(
      http.get("*/api/rest/v1/projects/:id", ({ request }) => {
        path = new URL(request.url).pathname;
        return HttpResponse.json({});
      }),
    );
    await mdposit.getProject("a/b c");
    expect(path).toBe("/api/rest/v1/projects/a%2Fb%20c");
  });

  it("#4-#6 binary endpoints come back as unconsumed responses", async () => {
    const structure = await mdposit.getStructure("MD-A00001", "protein");
    expect(await structure.text()).toContain("ATOM");
    const trajectory = await mdposit.getTrajectory("MD-A00001.1", { format: "xtc", frames: "1:10" });
    expect((await trajectory.arrayBuffer()).byteLength).toBe(4);
    const screenshot = await mdposit.getScreenshot("MD-A00001");
    expect(screenshot.headers.get("content-type")).toBe("image/png");
    await screenshot.arrayBuffer();
    await expect(mdposit.getScreenshot("MD-A99999")).rejects.toMatchObject({ kind: "not_found" });
  });

  it.each([
    "https://x.mddbr.eu:8443/shot.jpg",
    "http://x.mddbr.eu/shot.jpg",
    "https://mddbr.eu.evil.com/shot.jpg",
    "https://evil-mddbr.eu/shot.jpg",
  ])("#6 refuses the redirect to %s without following it", async (location) => {
    let followed = false;
    server.use(
      http.get("*/api/rest/v1/projects/:id/files/screenshot.jpg", () => new HttpResponse(null, { status: 302, headers: { location } })),
      http.get(location, () => {
        followed = true;
        return new HttpResponse(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } });
      }),
    );
    await expect(mdposit.getScreenshot("MD-A00001")).rejects.toMatchObject({ code: "bad_redirect" });
    expect(followed).toBe(false);
  });

  it("#6 follows one redirect to an https *.mddbr.eu host on the default port", async () => {
    const location = "https://x.mddbr.eu:443/shot.jpg";
    server.use(
      http.get("*/api/rest/v1/projects/:id/files/screenshot.jpg", () => new HttpResponse(null, { status: 302, headers: { location } })),
      http.get("https://x.mddbr.eu/shot.jpg", () => new HttpResponse(new Uint8Array([1]), { headers: { "content-type": "image/jpeg" } })),
    );
    const response = await mdposit.getScreenshot("MD-A00001");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
    await response.arrayBuffer();
  });

  it("retries transient 503s on reads", async () => {
    let calls = 0;
    server.use(
      http.get("*/api/rest/v1/projects/:id", () => {
        calls++;
        return calls < 2 ? new HttpResponse(null, { status: 503 }) : HttpResponse.json({ accession: "MD-A00001" });
      }),
    );
    expect(await mdposit.getProject("MD-A00001")).toMatchObject({ accession: "MD-A00001" });
    expect(calls).toBe(2);
  });
});
