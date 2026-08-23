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

    public async Task<List<Meeting>> GetUserUpcomingMeetingsAsync(Guid userId, Guid? excludeRoomId)
    {
        var memberRoomIds = await _context.RoomMembers
            .Where(rm => rm.UserId == userId)
            .Select(rm => rm.RoomId)
            .ToListAsync();

        var query = _context.Meetings
            .Include(m => m.Room)
            .Include(m => m.Creator)
            .Where(m => memberRoomIds.Contains(m.RoomId));

        if (excludeRoomId.HasValue)
            query = query.Where(m => m.RoomId != excludeRoomId.Value);

        return await query
            .Where(m => m.ScheduledAt >= DateTime.UtcNow)
            .OrderBy(m => m.ScheduledAt)
            .ToListAsync();
    }

    public async Task<List<MeetingAttendee>> GetAttendeesForMeetingsAsync(List<Guid> meetingIds) =>
        await _context.MeetingAttendees
            .Where(a => meetingIds.Contains(a.MeetingId))
            .ToListAsync();

    public async Task UpsertAttendeeAsync(MeetingAttendee attendee)
    {
        var existing = await _context.MeetingAttendees
            .FirstOrDefaultAsync(a => a.MeetingId == attendee.MeetingId && a.UserId == attendee.UserId);

        if (existing == null)
        {
            await _context.MeetingAttendees.AddAsync(attendee);
        }
        else
        {
            existing.Status = attendee.Status;
            existing.RespondedAt = attendee.RespondedAt;
        }

        await _context.SaveChangesAsync();
    }

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