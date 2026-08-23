export interface Meeting {
  id: string;
  roomId: string;
  roomName?: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  createdByUsername: string;
  createdAt: string;
  acceptedByMe?: boolean;
  acceptedCount?: number;
}

export interface CreateMeetingDto {
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
}

export interface UpdateMeetingDto {
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
}