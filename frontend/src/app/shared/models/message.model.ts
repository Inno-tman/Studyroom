export interface Message {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  avatarUrl?: string;
  content: string;
  createdAt: string;
}
