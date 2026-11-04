export function isStaleRevision(expected: number | undefined, current: number, required: boolean): boolean {
  if (expected === undefined || expected === null) return required;
  if (!Number.isInteger(expected) || expected < 0) return true;
  return expected !== current;
}

export function nextRevision(current: number): number {
  return current + 1;
}
