export interface ScheduledBroadcast {
  id: string;
  roomId: string;
  roomName?: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  youtubeUrl?: string;
  createdByUsername: string;
  createdAt: string;
  acceptedByMe?: boolean;
  acceptedCount?: number;
}

export interface CreateBroadcastDto {
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  youtubeUrl?: string;
}

export interface UpdateBroadcastDto {
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  youtubeUrl?: string;
}
