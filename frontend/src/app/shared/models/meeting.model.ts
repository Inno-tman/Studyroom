export interface Meeting {
  id: string;
  roomId: string;
  title: string;
  description?: string;
  scheduledAt: string;
  durationMinutes: number;
  createdByUsername: string;
  createdAt: string;
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