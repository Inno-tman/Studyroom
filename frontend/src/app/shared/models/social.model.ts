export interface UserSearchResult {
  id: string;
  username: string;
  displayName?: string;
  avatarUrl?: string;
  schoolName?: string;
  relationship: 'None' | 'Friends' | 'RequestSent' | 'RequestReceived';
  relationshipId?: string;
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
