// Heading pair at the top of every panel: what the analysis shows, then how to read it.
function PanelIntro({ title, description }: { title: string; description?: string }) {
  return (
    <div className="flex flex-col gap-1">
      <p className="text-text text-sm font-medium">{title}</p>
      {description ? <p className="text-text-muted text-xs">{description}</p> : null}
    </div>
  );
}

export { PanelIntro };
