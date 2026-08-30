using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class ScheduledBroadcastRepository : IScheduledBroadcastRepository
{
    private readonly AppDbContext _context;

    public ScheduledBroadcastRepository(AppDbContext context) => _context = context;

    public async Task<List<ScheduledBroadcast>> GetForRoomAsync(Guid roomId) =>
        await _context.ScheduledBroadcasts
            .Include(b => b.Creator)
            .Where(b => b.RoomId == roomId)
            .OrderBy(b => b.ScheduledAt)
            .ToListAsync();

    public async Task<ScheduledBroadcast?> GetByIdAsync(Guid id) =>
        await _context.ScheduledBroadcasts
            .Include(b => b.Creator)
            .FirstOrDefaultAsync(b => b.Id == id);

    public async Task<List<ScheduledBroadcastAttendee>> GetAttendeesForBroadcastsAsync(List<Guid> broadcastIds) =>
        await _context.ScheduledBroadcastAttendees
            .Where(a => broadcastIds.Contains(a.BroadcastId))
            .ToListAsync();

    public async Task UpsertAttendeeAsync(ScheduledBroadcastAttendee attendee)
    {
        var existing = await _context.ScheduledBroadcastAttendees
            .FirstOrDefaultAsync(a => a.BroadcastId == attendee.BroadcastId && a.UserId == attendee.UserId);

        if (existing == null)
        {
            await _context.ScheduledBroadcastAttendees.AddAsync(attendee);
        }
        else
        {
            existing.Status = attendee.Status;
            existing.RespondedAt = attendee.RespondedAt;
        }

        await _context.SaveChangesAsync();
    }

    public async Task AddAsync(ScheduledBroadcast broadcast)
    {
        await _context.ScheduledBroadcasts.AddAsync(broadcast);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(ScheduledBroadcast broadcast)
    {
        _context.ScheduledBroadcasts.Update(broadcast);
        await _context.SaveChangesAsync();
    }

    public async Task DeleteAsync(ScheduledBroadcast broadcast)
    {
        _context.ScheduledBroadcasts.Remove(broadcast);
        await _context.SaveChangesAsync();
    }
}
