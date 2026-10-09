import type { Quantity } from "../model/types";

const BYTES_PER_COORDINATE_ATOM = 12;

// Frames the request selects; an open end means "to the last frame" (upper bound).
const selectedFrameCount = (frames: string | undefined, totalFrames: number): number => {
  if (!frames) return totalFrames;
  const [startText, endText, strideText] = frames.split(":");
  const start = Number(startText);
  const end = Math.min(endText === undefined ? totalFrames : Number(endText), totalFrames);
  const stride = strideText === undefined ? 1 : Number(strideText);
  if (![start, end, stride].every(Number.isFinite) || start < 1 || stride < 1 || end < start) return 0;
  return Math.floor((end - start) / stride) + 1;
};

// Upper bound (uncompressed float32 xyz); real XTC files are smaller.
const estimateTrajectoryBytes = (frames: string | undefined, atoms: Quantity, totalFrames: Quantity): number | null => {
  if (atoms === null || totalFrames === null) return null;
  return selectedFrameCount(frames, totalFrames) * atoms * BYTES_PER_COORDINATE_ATOM;
};

export { estimateTrajectoryBytes };
