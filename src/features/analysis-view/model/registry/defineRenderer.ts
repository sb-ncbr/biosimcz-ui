import type { RendererEntry } from "./types";

// The cast erases T once, so the registry can hold rows of different payload shapes in one array.
const defineRenderer = <T>(entry: RendererEntry<T>): RendererEntry<unknown> => entry as unknown as RendererEntry<unknown>;

export { defineRenderer };
