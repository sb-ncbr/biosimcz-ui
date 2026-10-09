// BFF URLs the viewer loads from; the browser never talks to MDposit (plan 2.1).
const base = (recordId: string, resource: string): string => `/bff/records/${encodeURIComponent(recordId)}/${resource}`;

const withQuery = (path: string, params: Record<string, string | undefined>): string => {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) query.set(key, value);
  const text = query.toString();
  return text === "" ? path : `${path}?${text}`;
};

const structureUrlFor = (recordId: string, selection?: string): string => withQuery(base(recordId, "structure"), { selection });

// `recordId` is the replica instance id ("MD-A007L3.1"); frames are 1-based.
const trajectoryUrlFor = (recordId: string, options: { frames?: string; selection?: string } = {}): string =>
  withQuery(base(recordId, "trajectory"), { frames: options.frames, selection: options.selection });

export { structureUrlFor, trajectoryUrlFor };
