import { cn } from "@/shared/lib";

// People and groups as a small contact graph; three filled nodes are the contributors.
const NODES = [
  { x: 60, y: 70, filled: true },
  { x: 150, y: 40, filled: false },
  { x: 240, y: 80, filled: true },
  { x: 110, y: 140, filled: false },
  { x: 200, y: 160, filled: false },
  { x: 290, y: 170, filled: false },
  { x: 40, y: 190, filled: false },
  { x: 150, y: 220, filled: true },
] as const;

const EDGES: readonly (readonly [number, number])[] = [
  [0, 1], [1, 2], [0, 3], [1, 3], [3, 4], [2, 4], [2, 5], [4, 5], [3, 6], [6, 7], [4, 7], [3, 7],
];

const NetworkIllustration = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 330 260" fill="none" aria-hidden className={cn("h-auto w-full", className)}>
    {EDGES.map(([from, to]) => {
      const a = NODES[from];
      const b = NODES[to];
      return a && b ? <line key={`${from}-${to}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="stroke-base-300" strokeWidth="1.5" /> : null;
    })}
    {NODES.map((node) => (
      <circle
        key={`${node.x}-${node.y}`}
        cx={node.x}
        cy={node.y}
        r={node.filled ? 11 : 8}
        className={node.filled ? "fill-text stroke-text" : "fill-background stroke-base-500"}
        strokeWidth="2"
      />
    ))}
  </svg>
);

export { NetworkIllustration };
