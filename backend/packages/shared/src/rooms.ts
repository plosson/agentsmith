export interface Room {
  id: string;
  created_by: string;
  created_at: number;
  is_public: boolean;
}

export interface RoomMember {
  user_id: string;
  email: string;
  display_name: string;
  joined_at: number;
  last_seen_at: number | null;
}

export interface RoomWithMembers extends Room {
  members: RoomMember[];
}

export interface RoomListItem extends Room {
  member_count: number;
}
