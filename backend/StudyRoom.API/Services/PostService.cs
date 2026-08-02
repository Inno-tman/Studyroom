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

    public PostService(IPostRepository postRepo, IFriendshipRepository friendRepo, IRoomRepository roomRepo, IUserRepository userRepo)
    {
        _postRepo = postRepo;
        _friendRepo = friendRepo;
        _roomRepo = roomRepo;
        _userRepo = userRepo;
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

    public async Task<CommentDto> AddCommentAsync(Guid postId, string content, Guid userId)
    {
        if (string.IsNullOrWhiteSpace(content))
            throw new InvalidOperationException("Comment content is required.");

        var post = await _postRepo.GetByIdAsync(postId)
            ?? throw new KeyNotFoundException("Post not found.");

        var comment = await _postRepo.AddCommentAsync(new PostComment
        {
            PostId = postId,
            UserId = userId,
            Content = content.Trim()
        });

        var author = await _userRepo.GetByIdAsync(userId);
        return new CommentDto
        {
            Id = comment.Id,
            Content = comment.Content,
            AuthorId = userId,
            AuthorName = BuildDisplayName(author),
            AuthorAvatar = author?.AvatarUrl,
            CreatedAt = comment.CreatedAt
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
        Comments = p.Comments?
            .OrderBy(c => c.CreatedAt)
            .Select(c => new CommentDto
            {
                Id = c.Id,
                Content = c.Content,
                AuthorId = c.UserId,
                AuthorName = BuildDisplayName(c.Author),
                AuthorAvatar = c.Author?.AvatarUrl,
                CreatedAt = c.CreatedAt
            }).ToList() ?? new List<CommentDto>()
    };

    private static string BuildDisplayName(User? u)
    {
        if (u == null) return "Unknown";
        if (string.IsNullOrWhiteSpace(u.FirstName) && string.IsNullOrWhiteSpace(u.LastName))
            return u.Username;
        return $"{u.FirstName} {u.LastName}".Trim();
    }
}
