export class RateLimiter {
  private hits = new Map<string, number[]>();

  constructor(private now: () => number = Date.now) {}

  allow(key: string, limit: number, windowMs: number): boolean {
    const now = this.now();
    const kept = (this.hits.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
    if (kept.length >= limit) {
      this.hits.set(key, kept);
      return false;
    }
    kept.push(now);
    this.hits.set(key, kept);
    return true;
  }
}
