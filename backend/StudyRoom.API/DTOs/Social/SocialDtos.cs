namespace StudyRoom.API.DTOs.Social;

public class UserSearchResultDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? SchoolName { get; set; }
    public string? Location { get; set; }
    public string Relationship { get; set; } = "None";
    public Guid? RelationshipId { get; set; }
    public int MutualCount { get; set; }
    public int SharedRoomCount { get; set; }
    public string? Reason { get; set; }
}

public class FriendRequestDto
{
    public Guid Id { get; set; }
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? SchoolName { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class PostDto
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorAvatar { get; set; }
    public Guid AuthorId { get; set; }
    public DateTime CreatedAt { get; set; }
    public int CommentCount { get; set; }
    public int ReactionCount { get; set; }
    public bool LikedByMe { get; set; }
    public bool IsMine { get; set; }
    public PostDto? SharedFrom { get; set; }
    public List<CommentDto> Comments { get; set; } = new();
}

public class CommentDto
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public string AuthorName { get; set; } = string.Empty;
    public string? AuthorAvatar { get; set; }
    public Guid AuthorId { get; set; }
    public DateTime CreatedAt { get; set; }
    public Guid? ParentCommentId { get; set; }
    public List<CommentDto> Replies { get; set; } = new();
}

public class CreatePostDto
{
    public string Content { get; set; } = string.Empty;
    public Guid? RoomId { get; set; }
    public Guid? SharedPostId { get; set; }
}

public class CreateCommentDto
{
    public string Content { get; set; } = string.Empty;
    public Guid? ParentCommentId { get; set; }
}
