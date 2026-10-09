const rangeLabels = (ranges: readonly [number, number][], start: number, step: number, prefix: string): string[] =>
  ranges.map(([first, last]) => {
    const a = start + first * step;
    const b = start + last * step;
    return a === b ? `${prefix}${a}` : `${prefix}${a}-${b}`;
  });

export { rangeLabels };
