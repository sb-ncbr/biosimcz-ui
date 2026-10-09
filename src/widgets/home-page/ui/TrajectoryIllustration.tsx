import { cn } from "@/shared/lib";

// Hand-drawn data, not a real record: it only has to read as "a plot you can explore".
const BACKBONE = "M0 118 L16 92 L32 84 L48 70 L64 74 L80 60 L96 64 L112 52 L128 56 L144 48 L160 54 L176 44 L192 50 L208 42 L224 47 L240 40 L256 45 L272 38 L288 43 L304 39 L320 41";
const LIGAND = "M0 128 L16 120 L32 112 L48 108 L64 100 L80 104 L96 94 L112 98 L128 88 L144 92 L160 86 L176 90 L192 82 L208 88 L224 80 L240 84 L256 78 L272 83 L288 76 L304 80 L320 78";
const GRID = [30, 70, 110, 150];

// Built from tokens only (no raster asset), so it stays crisp and calm next to the app's own panels.
const TrajectoryIllustration = ({ className }: { className?: string }) => (
  <div
    role="img"
    aria-label="Illustration: an interactive plot of a simulation trajectory, with two RMSD curves over 100 nanoseconds"
    className={cn("border-border bg-background rounded-xl border p-5 md:p-6", className)}
  >
    <div className="flex items-center justify-between gap-4 text-xs">
      <span className="font-semibold">RMSD (nm)</span>
      <span className="border-border text-text-muted rounded-full border px-2.5 py-0.5">0 to 100 ns</span>
    </div>
    <svg viewBox="0 0 320 160" className="mt-4 h-auto w-full" fill="none" aria-hidden>
      {GRID.map((y) => (
        <line key={y} x1="0" x2="320" y1={y} y2={y} className="stroke-base-200" strokeWidth="1" />
      ))}
      <path d={LIGAND} className="stroke-base-400" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <path d={BACKBONE} className="stroke-text" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <line x1="208" x2="208" y1="10" y2="160" className="stroke-base-300" strokeWidth="1" strokeDasharray="3 3" />
      <circle cx="208" cy="42" r="4.5" className="fill-background stroke-text" strokeWidth="2" />
    </svg>
    <div className="text-text-muted mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs">
      <span className="inline-flex items-center gap-2">
        <span className="bg-text h-0.5 w-4 rounded-full" />
        Protein backbone
      </span>
      <span className="inline-flex items-center gap-2">
        <span className="bg-base-400 h-0.5 w-4 rounded-full" />
        Ligand
      </span>
      <span className="ml-auto tabular-nums">t = 65 ns, 0.21 nm</span>
    </div>
  </div>
);

export { TrajectoryIllustration };
