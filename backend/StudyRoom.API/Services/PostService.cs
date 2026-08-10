using StudyRoom.API.DTOs.Social;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class PostService : IPostService
{
    private readonly IPostRepository _postRepo;
    private readonly IFriendshipRepository _friendRepo;
    private readonly IRoomRepository _roomRepo;
    private readonly IUserRepository _userRepo;
    private readonly INotificationService _notificationService;

    public PostService(IPostRepository postRepo, IFriendshipRepository friendRepo, IRoomRepository roomRepo, IUserRepository userRepo, INotificationService notificationService)
    {
        _postRepo = postRepo;
        _friendRepo = friendRepo;
        _roomRepo = roomRepo;
        _userRepo = userRepo;
        _notificationService = notificationService;
    }

    public async Task<List<PostDto>> GetTimelineAsync(Guid userId)
    {
        var rels = await _friendRepo.GetFriendIdsAsync(userId);
        var friendIds = rels
            .Select(r => r.RequesterId == userId ? r.AddresseeId : r.RequesterId)
            .ToList();

        var posts = await _postRepo.GetTimelineAsync(friendIds, userId);
        return posts.Select(p => MapToDto(p, userId)).ToList();
    }

    public async Task<List<PostDto>> GetRoomPostsAsync(Guid roomId, Guid userId)
    {
        if (!await _roomRepo.IsMemberAsync(roomId, userId))
            throw new UnauthorizedAccessException("Not a member of this room.");

        var posts = await _postRepo.GetRoomPostsAsync(roomId);
        return posts.Select(p => MapToDto(p, userId)).ToList();
    }

    public async Task<List<PostDto>> GetUserPostsAsync(Guid userId, Guid viewerId)
    {
        var posts = await _postRepo.GetUserPostsAsync(userId);
        return posts.Select(p => MapToDto(p, viewerId)).ToList();
    }

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
        return MapToDto((await _postRepo.GetByIdAsync(post.Id))!, userId);
    }

    public async Task DeletePostAsync(Guid postId, Guid userId)
    {
        var post = await _postRepo.GetByIdAsync(postId)
            ?? throw new KeyNotFoundException("Post not found.");

        if (post.UserId != userId)
            throw new UnauthorizedAccessException("Only the author can delete.");

        await _postRepo.DeleteAsync(post);
    }

    public async Task<PostDto> ToggleLikeAsync(Guid postId, Guid userId)
    {
        var post = await _postRepo.GetByIdAsync(postId)
            ?? throw new KeyNotFoundException("Post not found.");

        var existing = await _postRepo.GetReactionAsync(postId, userId);
        if (existing != null)
            await _postRepo.DeleteReactionAsync(existing);
        else
            await _postRepo.AddReactionAsync(new PostReaction
            {
                PostId = postId,
                UserId = userId,
                Type = "like"
            });

        return MapToDto((await _postRepo.GetByIdAsync(postId))!, userId);
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

    private static PostDto MapToDto(Post p, Guid viewerId) => new()
    {
        Id = p.Id,
        Content = p.Content,
        AuthorId = p.UserId,
        AuthorName = BuildDisplayName(p.Author),
        AuthorAvatar = p.Author?.AvatarUrl,
        CreatedAt = p.CreatedAt,
        CommentCount = p.Comments?.Count ?? 0,
        ReactionCount = p.Reactions?.Count ?? 0,
        LikedByMe = p.Reactions?.Any(r => r.UserId == viewerId) ?? false,
        IsMine = p.UserId == viewerId,
        SharedFrom = p.SharedPost != null ? MapToDto(p.SharedPost, viewerId) : null,
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
}
