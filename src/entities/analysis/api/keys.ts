const analysisKeys = {
  all: ["analysis"] as const,
  data: (instanceId: string, name: string) => ["analysis", "data", instanceId, name] as const,
};

export { analysisKeys };
