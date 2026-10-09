import { z } from "zod";

const SELECTION_MAX_LENGTH = 300;
const FRAMES_MAX_LENGTH = 40;
const FRAMES_FORMAT_MESSAGE = "Use start:end:stride, for example 1:1000:10. Frames are numbered from 1.";
const FRAMES_PATTERN = /^(\d+)(?::(\d+)(?::(\d+))?)?$/;

const framesSchema = z.string().max(FRAMES_MAX_LENGTH, FRAMES_FORMAT_MESSAGE).superRefine((value, ctx) => {
  const match = FRAMES_PATTERN.exec(value);
  if (!match) {
    ctx.addIssue({ code: "custom", message: FRAMES_FORMAT_MESSAGE });
    return;
  }
  const start = Number(match[1]);
  const end = match[2] === undefined ? undefined : Number(match[2]);
  const stride = match[3] === undefined ? undefined : Number(match[3]);
  // Digit strings past 2^53 lose precision, which would make the comparisons below meaningless.
  if ([start, end, stride].some((part) => part !== undefined && !Number.isSafeInteger(part))) {
    ctx.addIssue({ code: "custom", message: FRAMES_FORMAT_MESSAGE });
    return;
  }
  if (start < 1 || (end !== undefined && end < 1)) {
    ctx.addIssue({ code: "custom", message: "Frames are numbered from 1, so 0 is not allowed." });
  } else if (end !== undefined && end < start) {
    ctx.addIssue({ code: "custom", message: "The end frame must not be smaller than the start frame." });
  }
  if (stride !== undefined && stride < 1) {
    ctx.addIssue({ code: "custom", message: "The stride must be at least 1." });
  }
});

// Printable ASCII only: the value is forwarded to the upstream query string.
const selectionSchema = z
  .string()
  .max(SELECTION_MAX_LENGTH, `Selection must be at most ${SELECTION_MAX_LENGTH} characters.`)
  .regex(/^[\x20-\x7E]*$/, "Selection must contain printable ASCII characters only.");

const trajectoryRequestSchema = z.object({
  frames: framesSchema.optional(),
  selection: selectionSchema.optional(),
});

export { framesSchema, selectionSchema, trajectoryRequestSchema };
