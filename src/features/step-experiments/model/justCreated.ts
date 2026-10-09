// Run ids created by "Add run" in this page view: the editor focuses and selects the Name input once for them
// (missing-states 5.4) and never for runs opened later.
const created = new Set<string>();

const markJustCreated = (id: string): void => {
  created.add(id);
};

const takeJustCreated = (id: string): boolean => created.delete(id);

export { markJustCreated, takeJustCreated };
