import { Hono } from "hono";
import { Layout } from "../components/Layout";
import { RoomList } from "../components/RoomList";
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
