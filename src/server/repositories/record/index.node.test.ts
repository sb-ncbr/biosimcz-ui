import { beforeEach, describe, expect, it } from "vitest";
import { MDPOSIT_CAPABILITIES, MDREPO_CAPABILITIES } from "@/entities/record";
import { loadEnv } from "@/server/config/env";
import { setTestEnv } from "@/test/serverEnv";
import { getRecordRepository } from "./index";

const ENV = {
  APP_ORIGIN: "http://localhost:3000",
  MDPOSIT_BASE_URL: "http://mdposit.test/api/rest/v1",
  MDREPO_BASE_URL: "http://mdrepo.test",
  AUTH_SECRET: "test-secret-test-secret-test-secret-0123",
  AUTH_URL: "http://localhost:3000",
  AUTH_OIDC_ISSUER: "http://idp.test/oidc/",
  AUTH_OIDC_CLIENT_ID: "c",
  AUTH_OIDC_CLIENT_SECRET: "s",
};

beforeEach(() => setTestEnv());

describe("getRecordRepository", () => {
  it("defaults to MDposit", () => {
    expect(getRecordRepository().capabilities).toBe(MDPOSIT_CAPABILITIES);
  });

  it("RECORDS_SOURCE=mdrepo selects MDRepo, and the instance is reused for the same source", () => {
    setTestEnv({ RECORDS_SOURCE: "mdrepo" });
    const repository = getRecordRepository();
    expect(repository.capabilities).toBe(MDREPO_CAPABILITIES);
    expect(getRecordRepository()).toBe(repository);
  });

  it("fails env parsing for an unknown source, naming the key only", () => {
    expect(() => loadEnv({ ...ENV, RECORDS_SOURCE: "elastic" })).toThrow("Invalid environment configuration: RECORDS_SOURCE");
    expect(loadEnv(ENV).recordsSource).toBe("mdposit");
  });
});
