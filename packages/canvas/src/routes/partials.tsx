import { Hono } from "hono";
import { RoomList } from "../components/RoomList";
import { SessionGrid } from "../components/SessionGrid";
import { api } from "../lib/api-client";

export const partials = new Hono();

partials.get("/rooms", async (c) => {
  const { rooms } = await api.listRooms();
  return c.html(<RoomList rooms={rooms} />);
});

partials.get("/rooms/:roomId/presence", async (c) => {
  const roomId = c.req.param("roomId");
  const { sessions } = await api.getRoomPresence(roomId);
  return c.html(<SessionGrid sessions={sessions} />);
});
