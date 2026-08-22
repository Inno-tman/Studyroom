using Microsoft.AspNetCore.SignalR;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Primitives;
using StudyRoom.API.DTOs.Social;
using StudyRoom.API.Hubs;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class PostService : IPostService
{
    private readonly IPostRepository _postRepo;
    private readonly IPostStatsRepository _statsRepo;
    private readonly IFriendshipRepository _friendRepo;
    private readonly IRoomRepository _roomRepo;
    private readonly IUserRepository _userRepo;
    private readonly INotificationService _notificationService;
    private readonly IHubContext<StudyRoomHub> _hub;
    private readonly IMemoryCache _cache;

    // Read-model cache is invalidated as a group via this change token.
    private CancellationTokenSource _feedTokenSource = new();

    public PostService(
        IPostRepository postRepo,
        IPostStatsRepository statsRepo,
        IFriendshipRepository friendRepo,
        IRoomRepository roomRepo,
        IUserRepository userRepo,
        INotificationService notificationService,
        IHubContext<StudyRoomHub> hub,
        IMemoryCache cache)
    {
        _postRepo = postRepo;
        _statsRepo = statsRepo;
        _friendRepo = friendRepo;
        _roomRepo = roomRepo;
        _userRepo = userRepo;
        _notificationService = notificationService;
        _hub = hub;
        _cache = cache;
    }

    // ── Read side (cached projection from the PostStats read model) ──────────

    public async Task<List<PostDto>> GetTimelineAsync(Guid userId)
    {
        return await GetCachedFeedAsync($"feed:timeline:{userId}", async () =>
        {
            var friendIds = await GetFriendIdsAsync(userId);
            var posts = await _postRepo.GetTimelineAsync(friendIds, userId);
            return await ProjectAsync(posts, userId);
        });
    }

    public async Task<PostDto> GetPostAsync(Guid postId, Guid viewerId)
    {
        var post = await _postRepo.GetByIdAsync(postId)
            ?? throw new KeyNotFoundException("Post not found.");
        return await ProjectSingleAsync(post, viewerId);
    }

    public async Task<List<PostDto>> GetRoomPostsAsync(Guid roomId, Guid userId)
    {
        if (!await _roomRepo.IsMemberAsync(roomId, userId))
            throw new UnauthorizedAccessException("Not a member of this room.");

        return await GetCachedFeedAsync($"feed:room:{roomId}:{userId}", async () =>
        {
            var posts = await _postRepo.GetRoomPostsAsync(roomId);
            return await ProjectAsync(posts, userId);
        });
    }

    public async Task<List<PostDto>> GetUserPostsAsync(Guid userId, Guid viewerId)
    {
        return await GetCachedFeedAsync($"feed:user:{userId}:{viewerId}", async () =>
        {
            var posts = await _postRepo.GetUserPostsAsync(userId);
            return await ProjectAsync(posts, viewerId);
        });
    }

    private async Task<List<PostDto>> ProjectAsync(List<Post> posts, Guid viewerId)
    {
        var ids = posts.Select(p => p.Id).ToList();
        var counts = await _statsRepo.GetCountsAsync(ids);
        var liked = await _postRepo.GetLikedPostIdsAsync(viewerId, ids);

        return posts.Select(p =>
        {
            counts.TryGetValue(p.Id, out var c);
            return MapToDto(p, viewerId, c.Comments, c.Reactions, liked.Contains(p.Id));
        }).ToList();
    }

    private async Task<PostDto> ProjectSingleAsync(Post post, Guid viewerId)
    {
        var counts = await _statsRepo.GetCountsAsync(new List<Guid> { post.Id });
        var liked = await _postRepo.GetLikedPostIdsAsync(viewerId, new List<Guid> { post.Id });
        counts.TryGetValue(post.Id, out var c);
        return MapToDto(post, viewerId, c.Comments, c.Reactions, liked.Contains(post.Id));
    }

    // ── Write side (commands update the PostStats read model) ────────────────

    public async Task<PostDto> CreatePostAsync(CreatePostDto dto, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(dto.Content) && !dto.SharedPostId.HasValue)
            throw new InvalidOperationException("Post content is required.");

        if (dto.RoomId.HasValue && !await _roomRepo.IsMemberAsync(dto.RoomId.Value, userId))
            throw new UnauthorizedAccessException("Not a member of this room.");

        var post = new Post
        {
            UserId = userId,
            Content = dto.Content.Trim(),
            RoomId = dto.RoomId,
            SharedPostId = dto.SharedPostId
        };

        await _postRepo.AddAsync(post);
        InvalidateFeed();

        var created = (await _postRepo.GetByIdAsync(post.Id))!;
        var result = MapToDto(created, userId, 0, 0, false);
        await NotifyCreatedAsync(created, result);
        return result;
    }

    public async Task DeletePostAsync(Guid postId, Guid userId)
    {
        var post = await _postRepo.GetByIdAsync(postId)
            ?? throw new KeyNotFoundException("Post not found.");

        if (post.UserId != userId)
            throw new UnauthorizedAccessException("Only the author can delete.");

        await _postRepo.DeleteAsync(post);
        await _statsRepo.DeleteAsync(postId);
        InvalidateFeed();
        await NotifyDeletedAsync(post);
    }

    public async Task<PostDto> ToggleLikeAsync(Guid postId, Guid userId)
    {
        var post = await _postRepo.GetByIdAsync(postId)
            ?? throw new KeyNotFoundException("Post not found.");

        var existing = await _postRepo.GetReactionAsync(postId, userId);
        bool liked;
        if (existing != null)
        {
            await _postRepo.DeleteReactionAsync(existing);
            await _statsRepo.IncrementReactionsAsync(postId, -1);
            liked = false;
        }
        else
        {
            await _postRepo.AddReactionAsync(new PostReaction
            {
                PostId = postId,
                UserId = userId,
                Type = "like"
            });
            await _statsRepo.IncrementReactionsAsync(postId, 1);
            liked = true;
        }

        InvalidateFeed();
        var counts = await _statsRepo.GetCountsAsync(new List<Guid> { postId });
        counts.TryGetValue(postId, out var c);
        var result = MapToDto(post, userId, c.Comments, c.Reactions, liked);
        await NotifyStatsAsync(post, new PostStatsDto
        {
            PostId = postId,
            ReactionCount = c.Reactions,
            CommentCount = c.Comments
        });
        return result;
    }

    public async Task<CommentDto> AddCommentAsync(Guid postId, CreateCommentDto dto, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(dto.Content))
            throw new InvalidOperationException("Comment content is required.");

        Guid? parentId = null;
        if (dto.ParentCommentId.HasValue)
        {
            parentId = dto.ParentCommentId.Value;
            var parent = await _postRepo.GetCommentByIdAsync(parentId.Value);
            if (parent == null)
                throw new KeyNotFoundException("Comment not found.");
            if (parent.PostId != postId)
                throw new InvalidOperationException("Cannot reply to a comment on a different post.");
        }

        var post = await _postRepo.GetByIdAsync(postId)
            ?? throw new KeyNotFoundException("Post not found.");

        var comment = await _postRepo.AddCommentAsync(new PostComment
        {
            PostId = postId,
            UserId = userId,
            Content = dto.Content.Trim(),
            ParentCommentId = parentId
        });

        await _statsRepo.IncrementCommentsAsync(postId, 1);
        InvalidateFeed();

        var author = await _userRepo.GetByIdAsync(userId);

        var recipientId = parentId.HasValue
            ? (await _postRepo.GetCommentByIdAsync(parentId.Value))!.UserId
            : post.UserId;
        if (recipientId != userId)
        {
            var recipient = await _userRepo.GetByIdAsync(recipientId);
            var summary = dto.Content.Length > 120 ? dto.Content[..120] + "…" : dto.Content;
            await _notificationService.CreateAsync(
                recipientId,
                "post_comment",
                "New comment",
                $"{BuildDisplayName(author)} commented on your post: \"{summary}\"",
                icon: "comment",
                actorId: userId,
                actorName: BuildDisplayName(author),
                actorAvatarUrl: author?.AvatarUrl,
                link: "/timeline");
        }

        var commentCounts = await _statsRepo.GetCountsAsync(new List<Guid> { postId });
        commentCounts.TryGetValue(postId, out var cc);
        await NotifyStatsAsync(post, new PostStatsDto
        {
            PostId = postId,
            ReactionCount = cc.Reactions,
            CommentCount = cc.Comments
        });

        return new CommentDto
        {
            Id = comment.Id,
            Content = comment.Content,
            AuthorId = userId,
            AuthorName = BuildDisplayName(author),
            AuthorAvatar = author?.AvatarUrl,
            CreatedAt = comment.CreatedAt,
            ParentCommentId = parentId
        };
    }

    // ── Mapping ──────────────────────────────────────────────────────────────

    private static PostDto MapToDto(Post p, Guid viewerId, int commentCount, int reactionCount, bool likedByMe) => new()
    {
        Id = p.Id,
        Content = p.Content,
        AuthorId = p.UserId,
        AuthorName = BuildDisplayName(p.Author),
        AuthorAvatar = p.Author?.AvatarUrl,
        CreatedAt = p.CreatedAt,
        RoomId = p.RoomId,
        CommentCount = commentCount,
        ReactionCount = reactionCount,
        LikedByMe = likedByMe,
        IsMine = p.UserId == viewerId,
        SharedFrom = p.SharedPost != null ? MapToDto(p.SharedPost, viewerId, 0, 0, false) : null,
        Comments = MapComments((p.Comments ?? new List<PostComment>()).ToList())
    };

    private static List<CommentDto> MapComments(List<PostComment> comments)
    {
        var byParent = comments.ToLookup(c => c.ParentCommentId);

        CommentDto Map(PostComment c) => new()
        {
            Id = c.Id,
            Content = c.Content,
            AuthorId = c.UserId,
            AuthorName = BuildDisplayName(c.Author),
            AuthorAvatar = c.Author?.AvatarUrl,
            CreatedAt = c.CreatedAt,
            ParentCommentId = c.ParentCommentId,
            Replies = byParent[c.Id].OrderBy(r => r.CreatedAt).Select(Map).ToList()
        };

        return byParent[null].OrderBy(c => c.CreatedAt).Select(Map).ToList();
    }

    private static string BuildDisplayName(User? u)
    {
        if (u == null) return "Unknown";
        if (string.IsNullOrWhiteSpace(u.FirstName) && string.IsNullOrWhiteSpace(u.LastName))
            return u.Username;
        return $"{u.FirstName} {u.LastName}".Trim();
    }

    // ── Read-model cache helpers ─────────────────────────────────────────────

    private async Task<T> GetCachedFeedAsync<T>(string key, Func<Task<T>> factory)
    {
        if (_cache.TryGetValue(key, out T cached))
            return cached!;

        var value = await factory();
        var options = new MemoryCacheEntryOptions
        {
            AbsoluteExpirationRelativeToNow = TimeSpan.FromMinutes(2),
            SlidingExpiration = TimeSpan.FromMinutes(1)
        };
        options.AddExpirationToken(new CancellationChangeToken(_feedTokenSource.Token));
        _cache.Set(key, value, options);
        return value;
    }

    private void InvalidateFeed()
    {
        _feedTokenSource.Cancel();
        _feedTokenSource = new CancellationTokenSource();
    }

    // ── Event-driven push (read model updated -> notify subscribers) ─────────

    private async Task<List<Guid>> GetFriendIdsAsync(Guid userId)
    {
        var rels = await _friendRepo.GetFriendIdsAsync(userId);
        return rels
            .Select(r => r.RequesterId == userId ? r.AddresseeId : r.RequesterId)
            .ToList();
    }

    private async Task NotifyCreatedAsync(Post post, PostDto dto)
    {
        try
        {
            if (post.RoomId.HasValue)
                await _hub.Clients.Group("room_" + post.RoomId.Value).SendAsync("PostCreated", dto);
            else
                foreach (var fid in await GetFriendIdsAsync(post.UserId))
                    await _hub.Clients.User(fid.ToString()).SendAsync("PostCreated", dto);
        }
        catch { }
    }

    private async Task NotifyStatsAsync(Post post, PostStatsDto stats)
    {
        try
        {
            if (post.RoomId.HasValue)
                await _hub.Clients.Group("room_" + post.RoomId.Value).SendAsync("PostStatsChanged", stats);
            else
                foreach (var fid in await GetFriendIdsAsync(post.UserId))
                    await _hub.Clients.User(fid.ToString()).SendAsync("PostStatsChanged", stats);
        }
        catch { }
    }

    private async Task NotifyDeletedAsync(Post post)
    {
        try
        {
            if (post.RoomId.HasValue)
                await _hub.Clients.Group("room_" + post.RoomId.Value).SendAsync("PostDeleted", post.Id);
            else
                foreach (var fid in await GetFriendIdsAsync(post.UserId))
                    await _hub.Clients.User(fid.ToString()).SendAsync("PostDeleted", post.Id);
        }
        catch { }
    }
}
