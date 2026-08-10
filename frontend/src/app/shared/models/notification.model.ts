export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  icon: string;
  actorId?: string;
  actorName: string;
  actorAvatarUrl?: string;
  link?: string;
  isRead: boolean;
  createdAt: string;
}

export interface NotificationList {
  items: NotificationItem[];
  unreadCount: number;
}