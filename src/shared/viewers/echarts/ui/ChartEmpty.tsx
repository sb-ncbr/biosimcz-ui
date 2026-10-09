function ChartEmpty({ reason, height }: { reason: string; height: number }) {
  return (
    <div
      role="status"
      style={{ height }}
      className="border-border bg-surface/40 text-text-muted flex w-full items-center justify-center rounded-lg border border-dashed px-4 text-center text-sm"
    >
      {reason}
    </div>
  );
}

export { ChartEmpty };
