import { describe, expect, it } from "vitest";
import { acceptRequest } from "./request-guard";
import { isStaleRevision, nextRevision } from "./revision";

describe("revision and request guards", () => {
  it("rejects mismatched and non-integer revisions", () => {
    expect(isStaleRevision(4, 4, true)).toBe(false);
    expect(isStaleRevision(3, 4, true)).toBe(true);
    expect(isStaleRevision(undefined, 4, true)).toBe(true);
    expect(isStaleRevision(undefined, 4, false)).toBe(false);
    expect(isStaleRevision(1.5, 1, true)).toBe(true);
    expect(nextRevision(4)).toBe(5);
  });

  it("accepts a request id once per user", () => {
    const log = new Map<string, string[]>();
    expect(acceptRequest(log, "user", "req-0001")).toBe(true);
    expect(acceptRequest(log, "user", "req-0001")).toBe(false);
    expect(acceptRequest(log, "other", "req-0001")).toBe(true);
    expect(acceptRequest(log, "user", "bad id")).toBe(false);
    expect(acceptRequest(log, "user", "short")).toBe(false);
  });
});
