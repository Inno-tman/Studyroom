using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IPostRepository
{
    Task<Post?> GetByIdAsync(Guid id);
    Task<List<Post>> GetTimelineAsync(List<Guid> friendIds, Guid selfId);
    Task<List<Post>> GetRoomPostsAsync(Guid roomId);
    Task<List<Post>> GetUserPostsAsync(Guid userId);
    Task<Post> AddAsync(Post post);
    Task<PostComment> AddCommentAsync(PostComment comment);
    Task<PostComment?> GetCommentByIdAsync(Guid id);
    Task<PostReaction> AddReactionAsync(PostReaction reaction);
    Task<PostReaction?> GetReactionAsync(Guid postId, Guid userId);
    Task DeleteReactionAsync(PostReaction reaction);
    Task DeleteAsync(Post post);
}
