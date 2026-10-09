import "server-only";
import type { ZodError } from "zod";
import { ApiError } from "./errors";

// Keys only, like every other browser-facing error: Zod messages never leave the server (the form shows its own client-side text).
const validationError = (error: ZodError): ApiError => {
  const fieldErrors: Record<string, string> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string") fieldErrors[field] = "errors.field.invalid";
  }
  return new ApiError({
    kind: "validation",
    backend: "mdposit",
    status: 422,
    messageKey: "errors.validation",
    ...(Object.keys(fieldErrors).length > 0 && { fieldErrors }),
  });
};

export { validationError };
