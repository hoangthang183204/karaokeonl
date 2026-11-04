const MAX_TRACKED = 80;

export function acceptRequest(log: Map<string, string[]>, userId: string, requestId: string): boolean {
  if (!requestId || requestId.length < 8 || requestId.length > 80) return false;
  if (!/^[\w.-]+$/.test(requestId)) return false;
  const recent = log.get(userId) ?? [];
  if (recent.includes(requestId)) return false;
  recent.push(requestId);
  if (recent.length > MAX_TRACKED) recent.splice(0, recent.length - MAX_TRACKED);
  log.set(userId, recent);
  return true;
}
