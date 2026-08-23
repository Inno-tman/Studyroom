import { Component, inject, OnInit } from '@angular/core';
import { NgFor, NgIf, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { PostService } from '../../core/services/post.service';
import { Post } from '../../shared/models/social.model';
import { LoadingComponent } from '../../shared/components/loading/loading.component';

@Component({
  selector: 'app-post-detail',
  standalone: true,
  imports: [NgFor, NgIf, DatePipe, FormsModule, RouterLink, LoadingComponent],
  template: `
    <div class="post-detail">
      <div class="page-header">
        <a routerLink="/timeline" class="back-link">
          <span class="material-icons">arrow_back</span> Timeline
        </a>
      </div>

      <app-loading [loading]="loading" />

      <div *ngIf="!loading && !post" class="empty">
        <span class="material-icons">article</span>
        Post not found or unavailable.
      </div>

      <div *ngIf="post" class="post">
        <div class="post-header">
          <div class="avatar" [class.has-image]="post.authorAvatar" routerLink="/profile/{{post.authorId}}" style="cursor:pointer">
            <img *ngIf="post.authorAvatar; else initial" [src]="post.authorAvatar" alt="" />
            <ng-template #initial>{{ post.authorName.charAt(0).toUpperCase() }}</ng-template>
          </div>
          <div class="post-meta">
            <span class="post-author">{{ post.authorName }}</span>
            <span class="post-time">{{ post.createdAt | date: 'medium' }}</span>
          </div>
          <button *ngIf="post.isMine" class="delete-btn" (click)="remove()" aria-label="Delete post">
            <span class="material-icons">delete</span>
          </button>
        </div>

        <div class="post-body">
          <p *ngIf="post.sharedFrom" class="share-note">shared a post</p>
          <p>{{ post.content }}</p>
        </div>

        <div *ngIf="post.sharedFrom" class="shared-card" (click)="openShared(post.sharedFrom)"
             role="button" tabindex="0" title="View original post">
          <div class="post-header">
            <div class="avatar sm" [class.has-image]="post.sharedFrom.authorAvatar" routerLink="/profile/{{post.sharedFrom.authorId}}" style="cursor:pointer">
              <img *ngIf="post.sharedFrom.authorAvatar; else sharedInitial" [src]="post.sharedFrom.authorAvatar" alt="" />
              <ng-template #sharedInitial>{{ post.sharedFrom.authorName.charAt(0).toUpperCase() }}</ng-template>
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
          <button class="action-btn" [class.active]="post.likedByMe" (click)="like()">
            <span class="material-icons">{{ post.likedByMe ? 'favorite' : 'favorite_border' }}</span>
            Like
          </button>
          <button class="action-btn" (click)="toggleComments()">
            <span class="material-icons">comment</span>
            Comment
          </button>
          <button class="action-btn" (click)="openShare()">
            <span class="material-icons">share</span>
            Share
          </button>
        </div>

        <div *ngIf="showComments" class="comments-section">
          <div *ngFor="let comment of post.comments" class="comment">
            <div class="avatar sm" [class.has-image]="comment.authorAvatar" routerLink="/profile/{{comment.authorId}}" style="cursor:pointer">
              <img *ngIf="comment.authorAvatar; else commentInitial" [src]="comment.authorAvatar" alt="" />
              <ng-template #commentInitial>{{ comment.authorName.charAt(0).toUpperCase() }}</ng-template>
            </div>
            <div class="comment-body">
              <div class="comment-bubble">
                <span class="comment-author">{{ comment.authorName }}</span>
                <span class="comment-text">{{ comment.content }}</span>
              </div>
              <div class="comment-actions">
                <button class="reply-btn" (click)="toggleReplyInput(comment)">Reply</button>
              </div>

              <div *ngIf="comment.replies?.length" class="replies">
                <div *ngFor="let reply of comment.replies" class="comment reply">
                  <div class="avatar sm" [class.has-image]="reply.authorAvatar" routerLink="/profile/{{reply.authorId}}" style="cursor:pointer">
                    <img *ngIf="reply.authorAvatar; else replyInitial" [src]="reply.authorAvatar" alt="" />
                    <ng-template #replyInitial>{{ reply.authorName.charAt(0).toUpperCase() }}</ng-template>
                  </div>
                  <div class="comment-body">
                    <div class="comment-bubble">
                      <span class="comment-author">{{ reply.authorName }}</span>
                      <span class="comment-text">{{ reply.content }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div *ngIf="replyToCommentId === comment.id" class="comment-input reply-input">
                <input
                  type="text"
                  [(ngModel)]="newComment"
                  placeholder="Write a reply…"
                  (keyup.enter)="reply(comment)"
                />
                <button class="btn-primary small" (click)="reply(comment)" [disabled]="!newComment.trim()">Post</button>
              </div>
            </div>
          </div>
          <div *ngIf="post.comments.length === 0" class="no-comments">No comments yet.</div>

          <div class="comment-input">
            <input
              type="text"
              [(ngModel)]="newComment"
              placeholder="Write a comment…"
              (keyup.enter)="comment()"
            />
            <button class="btn-primary small" (click)="comment()" [disabled]="!newComment.trim()">Post</button>
          </div>
        </div>
      </div>

      <div class="dialog-backdrop" *ngIf="showShareDialog" (click)="closeShare()">
        <div class="dialog" (click)="$event.stopPropagation()">
          <div class="dialog-header">
            <h3>Share post</h3>
            <button class="dialog-close" (click)="closeShare()"><span class="material-icons">close</span></button>
          </div>
          <div class="dialog-body">
            <label class="field">Add a caption
              <textarea
                rows="3"
                [(ngModel)]="shareCaption"
                placeholder="Say something about this post…"
                maxlength="5000"
              ></textarea>
            </label>
            <button class="btn-primary dialog-submit" (click)="confirmShare()" [disabled]="sharing">
              {{ sharing ? 'Sharing…' : 'Share' }}
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .post-detail { max-width: 700px; margin: 0 auto; }

    .back-link {
      display: inline-flex; align-items: center; gap: 6px;
      color: var(--text-muted); font-size: var(--font-14); font-weight: 600;
      text-decoration: none; margin-bottom: 16px; padding: 6px 10px; border-radius: 8px;
    }
    .back-link:hover { color: var(--primary); background: var(--surface-hover); }
    .back-link .material-icons { font-size: var(--font-20); }

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
    .btn-primary.small { padding: 6px 14px; }

    /* ── Share dialog ────────────────────────────────────────── */
    .dialog-backdrop {
      position: fixed; inset: 0; background: rgba(0, 0, 0, 0.5);
      display: flex; align-items: center; justify-content: center; z-index: 1300;
    }
    .dialog {
      width: 440px; max-width: 92vw; max-height: 85vh; background: var(--surface);
      border: 1px solid var(--border); border-radius: 16px; overflow: hidden;
      display: flex; flex-direction: column;
    }
    .dialog-header {
      display: flex; align-items: center; justify-content: space-between;
      padding: 16px; border-bottom: 1px solid var(--border);
    }
    .dialog-header h3 { font-size: var(--font-15); font-weight: 600; color: var(--text-primary); }
    .dialog-close { background: none; border: none; color: var(--text-muted); cursor: pointer; padding: 4px; border-radius: 6px; }
    .dialog-close:hover { color: var(--text-primary); }
    .dialog-body { padding: 16px; display: flex; flex-direction: column; gap: 14px; }
    .field { display: flex; flex-direction: column; gap: 6px; font-size: var(--font-13); font-weight: 600; color: var(--text-secondary); }
    .dialog-body textarea {
      padding: 10px 12px; background: var(--background); border: 1px solid var(--border);
      border-radius: 8px; color: var(--text-primary); font-size: var(--font-14);
      font-family: inherit; resize: none; outline: none;
    }
    .dialog-body textarea:focus { border-color: var(--primary); }
    .dialog-submit { width: 100%; padding: 12px; justify-content: center; }
  `]
})
export class PostDetailComponent implements OnInit {
  auth = inject(AuthService);
  private postService = inject(PostService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  post?: Post;
  loading = true;
  showComments = false;
  newComment = '';
  replyToCommentId?: string;

  showShareDialog = false;
  shareCaption = '';
  sharing = false;

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    try {
      if (id) this.post = await this.postService.getPost(id).toPromise();
    } catch {
      this.post = undefined;
    } finally {
      this.loading = false;
    }
  }

  openShared(original: Post): void {
    if (original?.id) this.router.navigate(['/posts', original.id]);
  }

  toggleComments(): void {
    this.showComments = !this.showComments;
  }

  toggleReplyInput(comment: any): void {
    this.replyToCommentId = this.replyToCommentId === comment.id ? undefined : comment.id;
    this.newComment = '';
  }

  async like(): Promise<void> {
    if (!this.post) return;
    await this.postService.toggleLike(this.post.id).toPromise();
    await this.reload();
  }

  async comment(): Promise<void> {
    const content = this.newComment.trim();
    if (!content || !this.post) return;
    await this.postService.addComment(this.post.id, content).toPromise();
    this.newComment = '';
    this.replyToCommentId = undefined;
    await this.reload();
  }

  async reply(comment: any): Promise<void> {
    const content = this.newComment.trim();
    if (!content || !this.post || !comment?.id) return;
    await this.postService.addComment(this.post.id, content, comment.id).toPromise();
    this.newComment = '';
    this.replyToCommentId = undefined;
    await this.reload();
  }

  openShare(): void {
    this.showShareDialog = true;
    this.shareCaption = '';
  }

  closeShare(): void {
    this.showShareDialog = false;
    this.shareCaption = '';
  }

  async confirmShare(): Promise<void> {
    if (!this.post) return;
    this.sharing = true;
    try {
      await this.postService.createPost(this.shareCaption.trim(), undefined, this.post.id).toPromise();
    } finally {
      this.sharing = false;
      this.showShareDialog = false;
      this.shareCaption = '';
    }
  }

  async remove(): Promise<void> {
    if (!this.post) return;
    await this.postService.deletePost(this.post.id).toPromise();
    this.router.navigate(['/timeline']);
  }

  private async reload(): Promise<void> {
    if (!this.post) return;
    const id = this.post.id;
    this.post = await this.postService.getPost(id).toPromise();
  }
}