using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class StudySessionRepository : IStudySessionRepository
{
    private readonly AppDbContext _context;

    public StudySessionRepository(AppDbContext context) => _context = context;

    public async Task AddAsync(StudySession session)
    {
        await _context.StudySessions.AddAsync(session);
        await _context.SaveChangesAsync();
    }

    public async Task UpdateAsync(StudySession session)
    {
        _context.Entry(session).State = EntityState.Modified;
        await _context.SaveChangesAsync();
    }

    public async Task<List<StudySession>> GetByUserIdAsync(Guid userId) =>
        await _context.StudySessions
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.CreatedAt)
            .ToListAsync();

    public async Task<decimal> GetTotalStudyMinutesAsync(Guid userId) =>
        await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified)
            .SumAsync(s => s.DurationMinutes);

    public async Task<int> GetSessionsCompletedAsync(Guid userId) =>
        await _context.StudySessions
            .CountAsync(s => s.UserId == userId && s.Completed && s.IsVerified);

    public async Task<decimal> GetWeeklyStudyMinutesAsync(Guid userId)
    {
        var weekStart = DateTime.UtcNow.AddDays(-7);
        return await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified && s.CreatedAt >= weekStart)
            .SumAsync(s => s.DurationMinutes);
    }

    public async Task<int> GetCurrentStreakAsync(Guid userId)
    {
        var sessions = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified)
            .Select(s => s.CreatedAt.Date)
            .Distinct()
            .OrderByDescending(d => d)
            .ToListAsync();

        if (sessions.Count == 0) return 0;

        int streak = 0;
        var expectedDate = DateTime.UtcNow.Date;

        foreach (var date in sessions)
        {
            if (date == expectedDate || date == expectedDate.AddDays(-1))
            {
                streak++;
                expectedDate = date;
            }
            else break;
        }

        return streak;
    }

    public async Task<List<StudySession>> GetStaleSessionsAsync(DateTime olderThan) =>
        await _context.StudySessions
            .Where(s => !s.Completed && s.StartedAt != null && s.StartedAt < olderThan)
            .ToListAsync();

    public async Task<int> GetCompletedTodayCountAsync(Guid userId)
    {
        var today = DateTime.UtcNow.Date;
        return await _context.StudySessions
            .CountAsync(s => s.UserId == userId && s.Completed && s.CreatedAt >= today);
    }

    public async Task<int> GetUnverifiedCountAsync(Guid userId) =>
        await _context.StudySessions
            .CountAsync(s => s.UserId == userId && s.Completed && !s.IsVerified);

    public async Task<List<(Guid UserId, string Username, string? AvatarUrl, decimal VerifiedMinutes, int Sessions, int Streak)>> GetRoomLeaderboardAsync(Guid roomId, int take = 10)
    {
        var weekStart = DateTime.UtcNow.AddDays(-7);

        var rows = await _context.StudySessions
            .Where(s => s.RoomId == roomId && s.Completed && s.IsVerified && s.CreatedAt >= weekStart)
            .GroupBy(s => s.UserId)
            .Select(g => new
            {
                UserId = g.Key,
                VerifiedMinutes = g.Sum(s => s.DurationMinutes),
                Sessions = g.Count()
            })
            .OrderByDescending(r => r.VerifiedMinutes)
            .Take(take)
            .ToListAsync();

        if (rows.Count == 0) return new();

        var userIds = rows.Select(r => r.UserId).ToList();
        var users = await _context.Users
            .Where(u => userIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        var result = new List<(Guid, string, string?, decimal, int, int)>();
        foreach (var row in rows)
        {
            var user = users.GetValueOrDefault(row.UserId);
            var uname = user?.Username ?? "Unknown";
            var avatar = user?.AvatarUrl;

            // compute streak for this user in this room
            var streakDates = await _context.StudySessions
                .Where(s => s.UserId == row.UserId && s.RoomId == roomId && s.Completed && s.IsVerified)
                .Select(s => s.CreatedAt.Date)
                .Distinct()
                .OrderByDescending(d => d)
                .ToListAsync();
            int streak = 0;
            if (streakDates.Count > 0)
            {
                var expected = DateTime.UtcNow.Date;
                foreach (var d in streakDates)
                {
                    if (d == expected || d == expected.AddDays(-1)) { streak++; expected = d; }
                    else break;
                }
            }

            result.Add((row.UserId, uname, avatar, row.VerifiedMinutes, row.Sessions, streak));
        }
        return result;
    }

    public async Task<decimal> GetRoomCollectiveMinutesAsync(Guid roomId)
    {
        var weekStart = DateTime.UtcNow.AddDays(-7);
        return await _context.StudySessions
            .Where(s => s.RoomId == roomId && s.Completed && s.IsVerified && s.CreatedAt >= weekStart)
            .SumAsync(s => s.DurationMinutes);
    }

    public async Task<int> GetRoomCollectiveSessionsAsync(Guid roomId)
    {
        var weekStart = DateTime.UtcNow.AddDays(-7);
        return await _context.StudySessions
            .CountAsync(s => s.RoomId == roomId && s.Completed && s.IsVerified && s.CreatedAt >= weekStart);
    }

    public async Task<decimal> GetTodayStudyMinutesAsync(Guid userId)
    {
        var today = DateTime.UtcNow.Date;
        return await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified && s.CreatedAt >= today)
            .SumAsync(s => s.DurationMinutes);
    }
}
