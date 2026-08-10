using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class DirectMessageRepository : IDirectMessageRepository
{
    private readonly AppDbContext _context;

    public DirectMessageRepository(AppDbContext context) => _context = context;

    public async Task<List<DirectMessage>> GetConversationAsync(Guid userA, Guid userB, int take = 100) =>
        await _context.DirectMessages
            .Where(d => (d.SenderId == userA && d.ReceiverId == userB) || (d.SenderId == userB && d.ReceiverId == userA))
            .Include(d => d.Sender)
            .OrderByDescending(d => d.CreatedAt)
            .Take(take)
            .OrderBy(d => d.CreatedAt)
            .ToListAsync();

    public async Task<List<DirectMessage>> GetRecentAsync(Guid userId, int take = 100) =>
        await _context.DirectMessages
            .Where(d => d.SenderId == userId || d.ReceiverId == userId)
            .Include(d => d.Sender)
            .Include(d => d.Receiver)
            .OrderByDescending(d => d.CreatedAt)
            .Take(take)
            .ToListAsync();

    public async Task<List<DirectMessage>> GetStaleUnreadAsync(DateTime olderThan) =>
        await _context.DirectMessages
            .Where(d => !d.IsRead && !d.UnreadNotificationSent && d.CreatedAt < olderThan)
            .Include(d => d.Sender)
            .ToListAsync();

    public async Task<int> GetUnreadCountAsync(Guid receiverId) =>
        await _context.DirectMessages
            .CountAsync(d => d.ReceiverId == receiverId && !d.IsRead);

    public async Task MarkReadAsync(Guid userA, Guid userB)
    {
        var unread = await _context.DirectMessages
            .Where(d => d.SenderId == userB && d.ReceiverId == userA && !d.IsRead)
            .ToListAsync();
        foreach (var m in unread) m.IsRead = true;
        if (unread.Count > 0) await _context.SaveChangesAsync();
    }

    public async Task MarkNotificationSentAsync(IEnumerable<Guid> ids)
    {
        var idList = ids.ToList();
        if (idList.Count == 0) return;
        var messages = await _context.DirectMessages.Where(d => idList.Contains(d.Id)).ToListAsync();
        foreach (var m in messages) m.UnreadNotificationSent = true;
        await _context.SaveChangesAsync();
    }

    public async Task<DirectMessage> AddAsync(DirectMessage message)
    {
        await _context.DirectMessages.AddAsync(message);
        await _context.SaveChangesAsync();
        return message;
    }

    public async Task<DirectMessage?> GetByIdAsync(Guid id) =>
        await _context.DirectMessages.FirstOrDefaultAsync(d => d.Id == id);

    public async Task DeleteAsync(Guid id)
    {
        var message = await _context.DirectMessages.FirstOrDefaultAsync(d => d.Id == id);
        if (message != null)
        {
            _context.DirectMessages.Remove(message);
            await _context.SaveChangesAsync();
        }
    }
}
