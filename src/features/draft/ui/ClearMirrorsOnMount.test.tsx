import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const clearAllMirrors = vi.hoisted(() => vi.fn(async () => undefined));
vi.mock("../model/mirror", () => ({ clearAllMirrors }));

import { ClearMirrorsOnMount } from "./ClearMirrorsOnMount";

describe("ClearMirrorsOnMount", () => {
  it("wipes the local draft mirror when it mounts (login page)", () => {
    render(<ClearMirrorsOnMount />);
    expect(clearAllMirrors).toHaveBeenCalledOnce();
  });
});
