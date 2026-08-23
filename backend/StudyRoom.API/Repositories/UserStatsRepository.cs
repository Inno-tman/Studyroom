using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public class UserStatsRepository : IUserStatsRepository
{
    private readonly AppDbContext _context;

    public UserStatsRepository(AppDbContext context) => _context = context;

    public async Task<UserStats?> GetAsync(Guid userId) =>
        await _context.UserStats.FirstOrDefaultAsync(s => s.UserId == userId);

    public async Task<UserStats> RefreshAsync(Guid userId)
    {
        var total = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed)
            .SumAsync(s => (decimal?)s.DurationMinutes) ?? 0;

        var completed = await _context.StudySessions
            .CountAsync(s => s.UserId == userId && s.Completed);

        var weekStart = DateTime.UtcNow.AddDays(-7);
        var weekly = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.CreatedAt >= weekStart)
            .SumAsync(s => (decimal?)s.DurationMinutes) ?? 0;

        var dates = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed)
            .Select(s => s.CreatedAt.Date)
            .Distinct()
            .OrderByDescending(d => d)
            .ToListAsync();

        int streak = 0;
        var expected = DateTime.UtcNow.Date;
        foreach (var d in dates)
        {
            if (d == expected || d == expected.AddDays(-1)) { streak++; expected = d; }
            else break;
        }

        var stats = new UserStats
        {
            UserId = userId,
            TotalStudyMinutes = total,
            SessionsCompleted = completed,
            DailyStreak = streak,
            WeeklyStudyMinutes = weekly,
            UpdatedAt = DateTime.UtcNow
        };

        var existing = await _context.UserStats.FindAsync(userId);
        if (existing == null)
        {
            _context.UserStats.Add(stats);
        }
        else
        {
            existing.TotalStudyMinutes = stats.TotalStudyMinutes;
            existing.SessionsCompleted = stats.SessionsCompleted;
            existing.DailyStreak = stats.DailyStreak;
            existing.WeeklyStudyMinutes = stats.WeeklyStudyMinutes;
            existing.UpdatedAt = stats.UpdatedAt;
        }

        await _context.SaveChangesAsync();
        return existing ?? stats;
    }
}
