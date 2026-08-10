export interface UserSearchResult {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  schoolName?: string;
  location?: string;
  relationship: 'None' | 'Friends' | 'RequestSent' | 'RequestReceived';
  relationshipId?: string;
  mutualCount?: number;
  sharedRoomCount?: number;
  reason?: string;
}

export interface Friend {
  id: string;
  userId: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  schoolName?: string;
  createdAt: string;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  parentCommentId?: string;
  replies: Comment[];
}

export interface Post {
  id: string;
  content: string;
  authorId: string;
  authorName: string;
  authorAvatar?: string;
  createdAt: string;
  commentCount: number;
  reactionCount: number;
  likedByMe: boolean;
  isMine: boolean;
  sharedFrom?: Post;
  comments: Comment[];
}

export interface DirectMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatar?: string;
  receiverId: string;
  content: string;
  createdAt: string;
}

export interface Conversation {
  userId: string;
  displayName: string;
  username: string;
  avatarUrl?: string;
  lastMessage: string;
  lastMessageAt: string;
}

export interface RoomInvitation {
  id: string;
  roomId: string;
  roomName: string;
  roomSubject?: string;
  inviterName: string;
  inviterId: string;
  createdAt: string;
}
