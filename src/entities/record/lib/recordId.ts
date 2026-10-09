// Ids of public records: MDposit accessions ("MD-A00001", "MD-A00001.2" for a replica) and MDRepo ids. A superset of the
// draft id alphabet that also allows ".", so route params are checked before they reach a backend path or an href.
const RECORD_ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/;

const isRecordId = (value: unknown): value is string =>
  typeof value === "string" && RECORD_ID_PATTERN.test(value) && !value.includes("..");

export { isRecordId };
