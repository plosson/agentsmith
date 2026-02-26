import { Hono } from "hono";
import { RoomList } from "../components/RoomList";
import { api } from "../lib/api-client";

export const partials = new Hono();

partials.get("/rooms", async (c) => {
  const { rooms } = await api.listRooms();
  return c.html(<RoomList rooms={rooms} />);
});
