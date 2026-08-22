using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IPostStatsRepository
{
    Task<Dictionary<Guid, (int Comments, int Reactions)>> GetCountsAsync(IEnumerable<Guid> postIds);
    Task IncrementCommentsAsync(Guid postId, int delta = 1);
    Task IncrementReactionsAsync(Guid postId, int delta = 1);
    Task DeleteAsync(Guid postId);
}

public class PostStatsRepository : IPostStatsRepository
{
    private readonly AppDbContext _context;

    public PostStatsRepository(AppDbContext context) => _context = context;

    public async Task<Dictionary<Guid, (int Comments, int Reactions)>> GetCountsAsync(IEnumerable<Guid> postIds)
    {
        var ids = postIds.ToList();
        if (ids.Count == 0)
            return new Dictionary<Guid, (int, int)>();

        var rows = await _context.PostStats
            .Where(s => ids.Contains(s.PostId))
            .ToListAsync();

        return rows.ToDictionary(r => r.PostId, r => (r.CommentCount, r.ReactionCount));
    }

    public async Task IncrementCommentsAsync(Guid postId, int delta = 1) =>
        await AdjustAsync(postId, true, delta);

    public async Task IncrementReactionsAsync(Guid postId, int delta = 1) =>
        await AdjustAsync(postId, false, delta);

    public async Task DeleteAsync(Guid postId)
    {
        var row = await _context.PostStats.FindAsync(postId);
        if (row != null)
        {
            _context.PostStats.Remove(row);
            await _context.SaveChangesAsync();
        }
    }

    private async Task AdjustAsync(Guid postId, bool isComment, int delta)
    {
        var row = await _context.PostStats.FindAsync(postId);
        if (row == null)
        {
            row = new PostStats { PostId = postId };
            _context.PostStats.Add(row);
        }

        if (isComment)
            row.CommentCount = Math.Max(0, row.CommentCount + delta);
        else
            row.ReactionCount = Math.Max(0, row.ReactionCount + delta);

        row.UpdatedAt = DateTime.UtcNow;
        await _context.SaveChangesAsync();
    }
}
