export interface Room {
  id: string;
  name: string;
  description?: string;
  subject?: string;
  isPrivate: boolean;
  joinCode?: string;
  createdByUsername: string;
  memberCount: number;
  createdAt: string;
}

export interface CreateRoomDto {
  name: string;
  description?: string;
  subject?: string;
  isPrivate: boolean;
}

export interface UpdateRoomDto {
  name: string;
  description?: string;
  subject?: string;
  isPrivate: boolean;
}
