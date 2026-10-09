// BFF route that streams the analysis JSON; also the target of the "Download JSON" action.
const analysisDataUrl = (instanceId: string, name: string): string =>
  `/bff/records/${encodeURIComponent(instanceId)}/analyses/${encodeURIComponent(name)}`;

export { analysisDataUrl };
