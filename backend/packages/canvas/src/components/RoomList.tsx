import type { FC } from "hono/jsx";

type RoomItem = {
  id: string;
  name: string;
  member_count: number;
};

export const RoomList: FC<{ rooms: RoomItem[] }> = ({ rooms }) => {
  if (rooms.length === 0) {
    return (
      <div class="text-center py-16 text-gray-400">
        <p class="text-lg">No rooms yet</p>
        <p class="text-sm mt-1">Create a room via the API to get started.</p>
      </div>
    );
  }

  return (
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {rooms.map((room) => (
        <a
          href={`/rooms/${room.id}`}
          class="block bg-white rounded-lg border border-gray-200 p-5 hover:border-gray-400 hover:shadow-sm transition-all"
        >
          <div class="flex items-center justify-between">
            <h3 class="font-medium text-gray-900 font-mono text-sm">{room.name}</h3>
            <span class="text-xs text-gray-400">
              {room.member_count} {room.member_count === 1 ? "member" : "members"}
            </span>
          </div>
        </a>
      ))}
    </div>
  );
};
