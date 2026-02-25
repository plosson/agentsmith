export interface Room {
  id: string;
  name: string;
  created_by: string;
  created_at: number;
}

export interface RoomMember {
  user_id: string;
  display_name: string;
  joined_at: number;
}

export interface RoomWithMembers extends Room {
  members: RoomMember[];
}

export interface RoomListItem extends Room {
  member_count: number;
}
