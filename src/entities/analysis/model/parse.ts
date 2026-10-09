import type { z } from "zod";
import type { ParseResult } from "./types";

const parseWith = <T>(schema: z.ZodType<T>, raw: unknown): ParseResult<T> => {
  const result = schema.safeParse(raw);
  if (result.success) return { ok: true, data: result.data };
  const first = result.error.issues[0];
  return { ok: false, issue: { path: first?.path.join(".") ?? "", message: first?.message ?? "Invalid data" } };
};

export { parseWith };
