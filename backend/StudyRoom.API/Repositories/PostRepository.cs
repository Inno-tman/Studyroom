using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class PostRepository : IPostRepository
{
    private readonly AppDbContext _context;

    public PostRepository(AppDbContext context) => _context = context;

    private IQueryable<Post> BaseQuery() =>
        _context.Posts
            .Include(p => p.Author)
            .Include(p => p.SharedPost)!.ThenInclude(sp => sp!.Author)
            .Include(p => p.Comments).ThenInclude(c => c.Author)
            .Include(p => p.Comments).ThenInclude(c => c.Replies).ThenInclude(r => r.Author)
            .Include(p => p.Reactions);

    public async Task<Post?> GetByIdAsync(Guid id) =>
        await BaseQuery().FirstOrDefaultAsync(p => p.Id == id);

    public async Task<List<Post>> GetTimelineAsync(List<Guid> friendIds, Guid selfId)
    {
        var authorIds = friendIds.Append(selfId).ToList();
        return await BaseQuery()
            .Where(p => p.RoomId == null && authorIds.Contains(p.UserId))
            .OrderByDescending(p => p.CreatedAt)
            .Take(100)
            .ToListAsync();
    }

    public async Task<List<Post>> GetRoomPostsAsync(Guid roomId) =>
        await BaseQuery()
            .Where(p => p.RoomId == roomId)
            .OrderByDescending(p => p.CreatedAt)
            .Take(100)
            .ToListAsync();

    public async Task<List<Post>> GetUserPostsAsync(Guid userId) =>
        await BaseQuery()
            .Where(p => p.UserId == userId)
            .OrderByDescending(p => p.CreatedAt)
            .Take(100)
            .ToListAsync();

    public async Task<Post> AddAsync(Post post)
    {
        await _context.Posts.AddAsync(post);
        await _context.SaveChangesAsync();
        return post;
    }

    public async Task<PostComment?> GetCommentByIdAsync(Guid id) =>
        await _context.PostComments.FirstOrDefaultAsync(c => c.Id == id);

    public async Task<PostComment> AddCommentAsync(PostComment comment)
    {
        await _context.PostComments.AddAsync(comment);
        await _context.SaveChangesAsync();
        return comment;
    }

    public async Task<PostReaction> AddReactionAsync(PostReaction reaction)
    {
        await _context.PostReactions.AddAsync(reaction);
        await _context.SaveChangesAsync();
        return reaction;
    }

    public async Task<PostReaction?> GetReactionAsync(Guid postId, Guid userId) =>
        await _context.PostReactions.FirstOrDefaultAsync(r => r.PostId == postId && r.UserId == userId);

    public async Task DeleteReactionAsync(PostReaction reaction)
    {
        _context.PostReactions.Remove(reaction);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Post post)
    {
        _context.Posts.Remove(post);
        await _context.SaveChangesAsync();
    }
}
