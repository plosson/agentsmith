import { Hono } from "hono";
import { Layout } from "../components/Layout";
import { RoomList } from "../components/RoomList";
import { RoomView } from "../components/RoomView";
import { api } from "../lib/api-client";

export const pages = new Hono();

pages.get("/", async (c) => {
  const { rooms } = await api.listRooms();
  return c.html(
    <Layout title="Rooms">
      <div class="flex items-center justify-between mb-6">
        <h1 class="text-xl font-semibold">Rooms</h1>
        <button
          hx-get="/partials/rooms"
          hx-target="#room-list"
          hx-swap="innerHTML"
          class="text-sm text-gray-500 hover:text-gray-700"
        >
          Refresh
        </button>
      </div>
      <div id="room-list">
        <RoomList rooms={rooms} />
      </div>
    </Layout>,
  );
});

pages.get("/rooms/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const { sessions } = await api.getRoomPresence(roomId);

  // Fetch room name (we need it for display)
  const { rooms } = await api.listRooms();
  const room = rooms.find((r) => r.id === roomId);
  const roomName = room?.name ?? roomId;

  return c.html(
    <Layout title={roomName}>
      <RoomView roomId={roomId} roomName={roomName} sessions={sessions} />
    </Layout>,
  );
});
