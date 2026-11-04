const base = "http://localhost:3001/api";
const email = `smoke${Date.now()}@karaoke.local`;
const authRes = await fetch(`${base}/auth/register`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ email, password: "password123", displayName: "Smoke" }),
});
const auth = await authRes.json();
if (!auth.token) {
  console.log("auth failed", auth);
  process.exit(1);
}
const roomRes = await fetch(`${base}/rooms`, {
  method: "POST",
  headers: { Authorization: `Bearer ${auth.token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ name: "Smoke Room" }),
});
const room = await roomRes.json();
const { Client } = await import("colyseus.js");
const client = new Client("ws://localhost:3001");
const joined = await client.joinOrCreate("karaoke", { token: auth.token, roomCode: room.id });
await new Promise((resolve) => setTimeout(resolve, 800));
const state = joined.state;
console.log(JSON.stringify({
  dbRoom: room,
  colyseusRoomId: joined.roomId,
  roomName: state.roomName,
  hostId: state.hostId,
  playbackState: state.playbackState,
  skipThreshold: state.skipThreshold,
  revision: state.revision,
  playerCount: state.players?.size ?? Object.keys(state.players ?? {}).length,
  json: state.toJSON?.(),
}, null, 2));
await joined.leave();
process.exit(0);
