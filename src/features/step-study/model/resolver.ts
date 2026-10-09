import { zodResolver } from "@hookform/resolvers/zod";
import type { FieldErrors, Resolver } from "react-hook-form";
import { isValidIsoDate, studySchema, type Study } from "@/entities/deposition";

// The lenient shared schema for format problems, plus the one format rule that depends on the clock (an embargo must
// end after today). Required-ness is not checked here: it is shown from computeCompleteness once "show required" is on.
const base = zodResolver(studySchema) as unknown as Resolver<Study>;

const todayIso = (now: number): string => new Date(now).toISOString().slice(0, 10);

const createStudyResolver =
  (now: () => number = Date.now): Resolver<Study> =>
  async (values, context, options) => {
    const result = await base(values, context, options);
    const until = values.embargo?.until;
    if (values.access !== "embargoed" || !until || !isValidIsoDate(until) || until > todayIso(now())) return result;
    const errors = { ...(result.errors as FieldErrors<Study>) };
    errors.embargo = { ...errors.embargo, until: { type: "validate", message: "date_not_future" } };
    return { values: {}, errors };
  };

export { createStudyResolver };
