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

    public async Task<DirectMessage> AddAsync(DirectMessage message)
    {
        await _context.DirectMessages.AddAsync(message);
        await _context.SaveChangesAsync();
        return message;
    }
}
