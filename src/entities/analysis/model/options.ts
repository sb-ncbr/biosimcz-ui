import { z } from "zod";
import type { AnalysisOption } from "./types";

const analysisOptionsSchema: z.ZodType<AnalysisOption[]> = z.array(z.object({ name: z.string(), analysis: z.string() }));

export { analysisOptionsSchema };
