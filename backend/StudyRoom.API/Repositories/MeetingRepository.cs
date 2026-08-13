using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class MeetingRepository : IMeetingRepository
{
    private readonly AppDbContext _context;

    public MeetingRepository(AppDbContext context) => _context = context;

    public async Task<List<Meeting>> GetForRoomAsync(Guid roomId) =>
        await _context.Meetings
            .Include(m => m.Creator)
            .Where(m => m.RoomId == roomId)
            .OrderBy(m => m.ScheduledAt)
            .ToListAsync();

    public async Task<Meeting?> GetByIdAsync(Guid id) =>
        await _context.Meetings
            .Include(m => m.Creator)
            .FirstOrDefaultAsync(m => m.Id == id);

    public async Task AddAsync(Meeting meeting)
    {
        await _context.Meetings.AddAsync(meeting);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(Meeting meeting)
    {
        _context.Meetings.Update(meeting);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(Meeting meeting)
    {
        _context.Meetings.Remove(meeting);
        await _context.SaveChangesAsync();
    }
}