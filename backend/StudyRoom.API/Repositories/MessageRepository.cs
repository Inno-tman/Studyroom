using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class MessageRepository : IMessageRepository
{
    private readonly AppDbContext _context;

    public MessageRepository(AppDbContext context) => _context = context;

    public async Task<List<Message>> GetByRoomIdAsync(Guid roomId, int take = 100) =>
        await _context.Messages
            .Where(m => m.RoomId == roomId)
            .Include(m => m.User)
            .OrderByDescending(m => m.CreatedAt)
            .Take(take)
            .OrderBy(m => m.CreatedAt)
            .ToListAsync();

    public async Task AddAsync(Message message)
    {
        await _context.Messages.AddAsync(message);
        await _context.SaveChangesAsync();
    }
}
