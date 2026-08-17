using StudyRoom.API.DTOs.Social;

namespace StudyRoom.API.Services;

public interface IPostService
{
    Task<List<PostDto>> GetTimelineAsync(Guid userId);
    Task<PostDto> GetPostAsync(Guid postId, Guid viewerId);
    Task<List<PostDto>> GetRoomPostsAsync(Guid roomId, Guid userId);
    Task<List<PostDto>> GetUserPostsAsync(Guid userId, Guid viewerId);
    Task<PostDto> CreatePostAsync(CreatePostDto dto, Guid userId);
    Task DeletePostAsync(Guid postId, Guid userId);
    Task<PostDto> ToggleLikeAsync(Guid postId, Guid userId);
    Task<CommentDto> AddCommentAsync(Guid postId, CreateCommentDto dto, Guid userId);
}
