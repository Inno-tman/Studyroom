import { Component, inject, OnInit } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { PostService } from '../core/services/post.service';
import { Post } from '../shared/models/social.model';
import { LoadingComponent } from '../shared/components/loading/loading.component';

@Component({
  selector: 'app-timeline',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, LoadingComponent],
  template: `
    <div class="timeline">
      <div class="page-header">
        <h1>Timeline</h1>
      </div>

      <div class="composer">
        <div class="composer-header">
          <div class="avatar" [class.has-image]="auth.currentUser()?.avatarUrl">
            <img *ngIf="auth.currentUser()?.avatarUrl; else composerInitial" [src]="auth.currentUser()?.avatarUrl" alt="" />
            <ng-template #composerInitial>{{ auth.currentUser()?.username?.charAt(0)?.toUpperCase() }}</ng-template>
          </div>
          <textarea
            [(ngModel)]="newPostContent"
            rows="3"
            placeholder="What's on your mind?"
            maxlength="5000"
          ></textarea>
        </div>
        <div class="composer-actions">
          <button class="btn-primary" (click)="publish()" [disabled]="!newPostContent.trim()">
            Post
          </button>
        </div>
      </div>

      <app-loading [loading]="loading" />
      <div *ngIf="!loading && posts.length === 0" class="empty">
        <span class="material-icons">article</span>
        No posts yet. Share something with your friends!
      </div>

      <div class="posts">
        <div *ngFor="let post of posts" class="post">
          <div class="post-header">
            <div class="avatar" [class.has-image]="post.authorAvatar">
              <img *ngIf="post.authorAvatar; else initial" [src]="post.authorAvatar" alt="" />
              <ng-template #initial>{{ post.authorName?.charAt(0)?.toUpperCase() }}</ng-template>
            </div>
            <div class="post-meta">
              <span class="post-author">{{ post.authorName }}</span>
              <span class="post-time">{{ post.createdAt | date: 'medium' }}</span>
            </div>
            <button *ngIf="post.isMine" class="delete-btn" (click)="remove(post)" aria-label="Delete post">
              <span class="material-icons">delete</span>
            </button>
          </div>

          <div class="post-body">
            <p *ngIf="post.sharedFrom" class="share-note">
              shared a post
            </p>
            <p>{{ post.content }}</p>
          </div>

          <div *ngIf="post.sharedFrom" class="shared-card" (click)="openShared(post.sharedFrom)"
               role="button" tabindex="0" title="View original post">
            <div class="post-header">
              <div class="avatar sm" [class.has-image]="post.sharedFrom.authorAvatar">
                <img *ngIf="post.sharedFrom.authorAvatar; else sharedInitial" [src]="post.sharedFrom.authorAvatar" alt="" />
                <ng-template #sharedInitial>{{ post.sharedFrom.authorName?.charAt(0)?.toUpperCase() }}</ng-template>
              </div>
              <div class="post-meta">
                <span class="post-author">{{ post.sharedFrom.authorName }}</span>
                <span class="post-time">{{ post.sharedFrom.createdAt | date: 'medium' }}</span>
              </div>
              <span class="material-icons shared-open">open_in_new</span>
            </div>
            <p>{{ post.sharedFrom.content }}</p>
          </div>

          <div class="post-stats">
            <span *ngIf="post.reactionCount > 0">{{ post.reactionCount }} reactions</span>
            <span *ngIf="post.commentCount > 0">{{ post.commentCount }} comments</span>
          </div>

          <div class="post-actions">
            <button class="action-btn" [class.active]="post.likedByMe" (click)="like(post)">
              <span class="material-icons">{{ post.likedByMe ? 'favorite' : 'favorite_border' }}</span>
              Like
            </button>
            <button class="action-btn" (click)="toggleComments(post)">
              <span class="material-icons">comment</span>
              Comment
            </button>
            <button class="action-btn" (click)="share(post)">
              <span class="material-icons">share</span>
              Share
            </button>
          </div>

          <div *ngIf="post.showComments" class="comments-section">
            <div *ngFor="let comment of post.comments" class="comment">
              <div class="avatar sm" [class.has-image]="comment.authorAvatar">
                <img *ngIf="comment.authorAvatar; else commentInitial" [src]="comment.authorAvatar" alt="" />
                <ng-template #commentInitial>{{ comment.authorName?.charAt(0)?.toUpperCase() }}</ng-template>
              </div>
              <div class="comment-body">
                <div class="comment-bubble">
                  <span class="comment-author">{{ comment.authorName }}</span>
                  <span class="comment-text">{{ comment.content }}</span>
                </div>
                <div class="comment-actions">
                  <button class="reply-btn" (click)="toggleReplyInput(post, comment)">Reply</button>
                </div>

                <div *ngIf="comment.replies?.length" class="replies">
                  <div *ngFor="let reply of comment.replies" class="comment reply">
                    <div class="avatar sm" [class.has-image]="reply.authorAvatar">
                      <img *ngIf="reply.authorAvatar; else replyInitial" [src]="reply.authorAvatar" alt="" />
                      <ng-template #replyInitial>{{ reply.authorName?.charAt(0)?.toUpperCase() }}</ng-template>
                    </div>
                    <div class="comment-body">
                      <div class="comment-bubble">
                        <span class="comment-author">{{ reply.authorName }}</span>
                        <span class="comment-text">{{ reply.content }}</span>
                      </div>
                      <div class="comment-actions">
                        <button class="reply-btn" (click)="toggleReplyInput(post, reply)">Reply</button>
                      </div>
                    </div>
                  </div>
                </div>

                <div *ngIf="post.replyToCommentId === comment.id" class="comment-input reply-input">
                  <input
                    type="text"
                    [(ngModel)]="post.newComment"
                    placeholder="Write a reply…"
                    (keyup.enter)="reply(post)"
                  />
                  <button class="btn-primary small" (click)="reply(post)" [disabled]="!post.newComment?.trim()">Post</button>
                </div>
              </div>
            </div>
            <div *ngIf="post.comments.length === 0" class="no-comments">No comments yet.</div>

            <div class="comment-input">
              <input
                type="text"
                [(ngModel)]="post.newComment"
                placeholder="Write a comment…"
                (keyup.enter)="comment(post)"
              />
              <button class="btn-primary small" (click)="comment(post)" [disabled]="!post.newComment?.trim()">Post</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .timeline { max-width: 700px; margin: 0 auto; }

    .composer {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
      margin-bottom: 20px;
    }

    .composer-header { display: flex; gap: 12px; }

    textarea {
      flex: 1; width: 100%; background: var(--background); border: 1px solid var(--border);
      border-radius: 8px; padding: 12px; color: var(--text-primary); font-size: var(--font-14);
      font-family: inherit; resize: none; box-sizing: border-box;
    }
    textarea:focus { outline: none; border-color: var(--primary); }

    .composer-actions { display: flex; justify-content: flex-end; margin-top: 12px; align-items: center; gap: 8px; }

    .btn-primary.small { padding: 6px 14px; }

    .posts { display: flex; flex-direction: column; gap: 16px; }

    .post {
      background: var(--surface); border: 1px solid var(--border); border-radius: 12px; padding: 16px;
    }

    .post-header { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }

    .post-meta { display: flex; flex-direction: column; flex: 1; }
    .post-author { font-size: var(--font-14); font-weight: 600; color: var(--text-primary); }
    .post-time { font-size: var(--font-12); color: var(--text-muted); }

    .delete-btn { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 6px; border-radius: 6px; }
    .delete-btn:hover { color: var(--error); }

    .post-body p { font-size: var(--font-15); color: var(--text-primary); line-height: 1.6; white-space: pre-wrap; word-wrap: break-word; }
    .share-note { font-size: var(--font-13); color: var(--text-muted); margin-bottom: 4px; }

    .shared-card {
      margin-top: 12px; background: var(--background); border: 1px solid var(--border);
      border-radius: 8px; padding: 12px; cursor: pointer;
      transition: background 0.15s, border-color 0.15s;
    }
    .shared-card:hover { background: var(--surface-hover); border-color: var(--primary); }
    .shared-card p { font-size: var(--font-14); color: var(--text-primary); line-height: 1.5; white-space: pre-wrap; word-wrap: break-word; }
    .shared-open { color: var(--text-muted); font-size: var(--font-18); }

    .post-stats { display: flex; gap: 16px; padding: 10px 0; border-bottom: 1px solid var(--border); font-size: var(--font-13); color: var(--text-muted); }

    .post-actions { display: flex; padding: 4px 0; }
    .action-btn {
      flex: 1; display: flex; align-items: center; justify-content: center; gap: 6px;
      background: none; border: none; color: var(--text-secondary); font-size: var(--font-14);
      font-weight: 500; cursor: pointer; padding: 8px; border-radius: 8px;
    }
    .action-btn:hover { background: var(--surface-hover); }
    .action-btn.active { color: var(--error); }
    .action-btn .material-icons { font-size: var(--font-20); }

    .comments-section { border-top: 1px solid var(--border); padding-top: 12px; }
    .comment { display: flex; gap: 10px; margin-bottom: 10px; }

    .comment-body { flex: 1; min-width: 0; }

    .comment-bubble {
      background: var(--background); border-radius: 8px; padding: 8px 12px; display: flex; flex-direction: column;
    }
    .comment-author { font-size: var(--font-13); font-weight: 600; color: var(--text-primary); }
    .comment-text { font-size: var(--font-14); color: var(--text-secondary); }

    .comment-actions { margin-top: 4px; }
    .reply-btn {
      background: none; border: none; color: var(--text-muted); font-size: var(--font-12);
      font-weight: 600; cursor: pointer; padding: 2px 4px;
    }
    .reply-btn:hover { color: var(--primary); }

    .replies { margin-top: 8px; padding-left: 16px; border-left: 2px solid var(--border); }
    .comment.reply { margin-bottom: 8px; }

    .comment-input.reply-input { margin-top: 6px; }

    .no-comments { font-size: var(--font-13); color: var(--text-muted); margin-bottom: 10px; }

    .comment-input { display: flex; gap: 8px; margin-top: 8px; }
    .comment-input input {
      flex: 1; background: var(--background); border: 1px solid var(--border); border-radius: 8px;
      padding: 8px 12px; color: var(--text-primary); font-size: var(--font-14);
    }
    .comment-input input:focus { outline: none; border-color: var(--primary); }
  `]
})
export class TimelineComponent implements OnInit {
  auth = inject(AuthService);
  private postService = inject(PostService);
  private router = inject(Router);

  posts: (Post & { showComments?: boolean; newComment?: string; replyToCommentId?: string })[] = [];
  newPostContent = '';
  loading = true;

  async ngOnInit() {
    try {
      await this.load();
    } finally {
      this.loading = false;
    }
  }

  async load(): Promise<void> {
    this.posts = (await this.postService.getTimeline().toPromise()) || [];
  }

  openShared(original: Post): void {
    if (original?.id) this.router.navigate(['/posts', original.id]);
  }

  async publish(): Promise<void> {
    if (!this.newPostContent.trim()) return;
    await this.postService.createPost(this.newPostContent.trim()).toPromise();
    this.newPostContent = '';
    await this.load();
  }

  async remove(post: Post): Promise<void> {
    await this.postService.deletePost(post.id).toPromise();
    await this.load();
  }

  async like(post: Post): Promise<void> {
    await this.postService.toggleLike(post.id).toPromise();
    await this.load();
  }

  toggleComments(post: any): void {
    post.showComments = !post.showComments;
    if (post.showComments && !post.commentsLoaded) {
      post.commentsLoaded = true;
    }
  }

  async comment(post: any): Promise<void> {
    const content = post.newComment?.trim();
    if (!content) return;
    await this.postService.addComment(post.id, content).toPromise();
    post.newComment = '';
    post.replyToCommentId = undefined;
    await this.load();
  }

  toggleReplyInput(post: any, comment: any): void {
    post.replyToCommentId = post.replyToCommentId === comment.id ? undefined : comment.id;
    post.newComment = '';
  }

  async reply(post: any): Promise<void> {
    const content = post.newComment?.trim();
    if (!content || !post.replyToCommentId) return;
    await this.postService.addComment(post.id, content, post.replyToCommentId).toPromise();
    post.newComment = '';
    post.replyToCommentId = undefined;
    await this.load();
  }

  async share(post: Post): Promise<void> {
    const confirmed = confirm(`Share this post to your timeline?`);
    if (!confirmed) return;
    const shared = await this.postService.createPost('', undefined, post.id).toPromise();
    await this.load();
  }
}
