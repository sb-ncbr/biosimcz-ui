import { HttpResponse, http } from "msw";
import { beforeEach, describe, expect, it } from "vitest";
import { server } from "@/test/msw";
import { setTestEnv } from "@/test/serverEnv";
import { getRecordStructure } from "./structure";

const URL_ = "http://mdposit.test/api/rest/v1/projects/MD-A00001/structure";
const PDB = { "content-type": "chemical/x-pdb" };

beforeEach(() => {
  setTestEnv();
});

describe("getRecordStructure", () => {
  it("forwards the selection to the upstream query", async () => {
    let selection: string | null = null;
    server.use(
      http.get(URL_, ({ request }) => {
        selection = new URL(request.url).searchParams.get("selection");
        return new HttpResponse("ATOM", { headers: PDB });
      }),
    );
    await getRecordStructure("MD-A00001", "name CA");
    expect(selection).toBe("name CA");
  });

  it("forwards Content-Length for an unencoded body", async () => {
    server.use(http.get(URL_, () => new HttpResponse("ATOM", { headers: { ...PDB, "content-length": "4" } })));
    expect((await getRecordStructure("MD-A00001"))?.contentLength).toBe("4");
  });

  it("drops Content-Length when the upstream body is content-encoded", async () => {
    server.use(http.get(URL_, () => new HttpResponse("ATOM", { headers: { ...PDB, "content-length": "4", "content-encoding": "gzip" } })));
    expect((await getRecordStructure("MD-A00001"))?.contentLength).toBeNull();
  });

  it("404 -> null", async () => {
    server.use(http.get(URL_, () => new HttpResponse(null, { status: 404 })));
    expect(await getRecordStructure("MD-A00001")).toBeNull();
  });
});
