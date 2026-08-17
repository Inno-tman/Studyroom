import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Comment, Post } from '../../shared/models/social.model';

@Injectable({ providedIn: 'root' })
export class PostService {
  constructor(private http: HttpClient) {}

  getTimeline(): Observable<Post[]> {
    return this.http.get<Post[]>(`${environment.apiUrl}/posts/timeline`);
  }

  getPost(id: string): Observable<Post> {
    return this.http.get<Post>(`${environment.apiUrl}/posts/${id}`);
  }

  getRoomPosts(roomId: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${environment.apiUrl}/posts/room/${roomId}`);
  }

  getUserPosts(userId: string): Observable<Post[]> {
    return this.http.get<Post[]>(`${environment.apiUrl}/posts/user/${userId}`);
  }

  createPost(content: string, roomId?: string, sharedPostId?: string): Observable<Post> {
    return this.http.post<Post>(`${environment.apiUrl}/posts`, { content, roomId, sharedPostId });
  }

  deletePost(id: string): Observable<void> {
    return this.http.delete<void>(`${environment.apiUrl}/posts/${id}`);
  }

  toggleLike(id: string): Observable<Post> {
    return this.http.post<Post>(`${environment.apiUrl}/posts/${id}/like`, {});
  }

  addComment(id: string, content: string, parentCommentId?: string): Observable<Comment> {
    return this.http.post<Comment>(`${environment.apiUrl}/posts/${id}/comments`, { content, parentCommentId });
  }
}
