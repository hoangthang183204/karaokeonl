const base = "http://localhost:3001/api";
const roomId = process.argv[2];
if (!roomId) {
  console.error("usage: node scripts/smoke-member.mjs <roomCode>");
  process.exit(1);
}
const email = `member${Date.now()}@karaoke.local`;
const authRes = await fetch(`${base}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "password123", displayName: "Khach" }),
});
const auth = await authRes.json();
const joinRes = await fetch(`${base}/rooms/${roomId}/join`, {
  method: "POST",
  headers: { Authorization: `Bearer ${auth.token}` },
});
const joinedRoom = await joinRes.json();
const { Client } = await import("colyseus.js");
const client = new Client("ws://localhost:3001");
const room = await client.joinOrCreate("karaoke", { token: auth.token, roomCode: roomId });
const error = new Promise((resolve) => {
  room.onMessage("tv:error", (message) => resolve(message));
});
await new Promise((resolve) => setTimeout(resolve, 600));
room.send("tv:resume", {
  requestId: `member-${Date.now()}`,
  expectedRevision: room.state.revision,
});
const result = await Promise.race([
  error,
  new Promise((resolve) => setTimeout(() => resolve({ timeout: true, state: room.state.playbackState }), 2500)),
]);
console.log(JSON.stringify({ role: joinedRoom.role, playback: room.state.playbackState, result }, null, 2));
await room.leave();
process.exit(0);
