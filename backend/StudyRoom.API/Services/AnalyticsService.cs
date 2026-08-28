using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Services;

public interface IAnalyticsService
{
    Task<AnalyticsOverviewDto> GetOverviewAsync(Guid userId);
    Task<List<RoomTimeBreakdownDto>> GetRoomBreakdownAsync(Guid userId);
    Task<List<DailyTrendDto>> GetDailyTrendAsync(Guid userId, int days = 30);
    Task<List<HourlyDistributionDto>> GetHourlyDistributionAsync(Guid userId);
    Task<List<WeeklyGoalDto>> GetWeeklyGoalsAsync(Guid userId);
    Task<WeeklyGoalDto> SetWeeklyGoalAsync(Guid userId, decimal targetMinutes);
}

public class AnalyticsOverviewDto
{
    public decimal TotalMinutes { get; set; }
    public int TotalSessions { get; set; }
    public decimal AvgSessionMinutes { get; set; }
    public int CurrentStreak { get; set; }
    public int LongestStreak { get; set; }
    public decimal ThisWeekMinutes { get; set; }
    public decimal LastWeekMinutes { get; set; }
    public decimal WeekOverWeekChange { get; set; }
    public int ActiveDaysThisWeek { get; set; }
    public string FavoriteTimeOfDay { get; set; } = "";
}

public class RoomTimeBreakdownDto
{
    public string RoomId { get; set; } = "";
    public string RoomName { get; set; } = "";
    public string? Subject { get; set; }
    public decimal TotalMinutes { get; set; }
    public int Sessions { get; set; }
    public decimal Percentage { get; set; }
}

public class DailyTrendDto
{
    public DateTime Date { get; set; }
    public decimal Minutes { get; set; }
    public int Sessions { get; set; }
}

public class HourlyDistributionDto
{
    public int Hour { get; set; }
    public decimal Minutes { get; set; }
    public int Sessions { get; set; }
}

public class WeeklyGoalDto
{
    public int WeekNumber { get; set; }
    public int Year { get; set; }
    public decimal TargetMinutes { get; set; }
    public decimal ActualMinutes { get; set; }
    public decimal Progress => TargetMinutes > 0 ? Math.Min(100, ActualMinutes / TargetMinutes * 100) : 0;
    public bool Completed => ActualMinutes >= TargetMinutes;
}

public class AnalyticsService : IAnalyticsService
{
    private readonly AppDbContext _context;
    private readonly IStreakCalculator _streakCalculator;

    public AnalyticsService(AppDbContext context, IStreakCalculator streakCalculator)
    {
        _context = context;
        _streakCalculator = streakCalculator;
    }

    public async Task<AnalyticsOverviewDto> GetOverviewAsync(Guid userId)
    {
        var totalMinutes = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified)
            .SumAsync(s => s.DurationMinutes);

        var totalSessions = await _context.StudySessions
            .CountAsync(s => s.UserId == userId && s.Completed && s.IsVerified);

        var thisWeek = DateTime.UtcNow.AddDays(-7);
        var lastWeekStart = DateTime.UtcNow.AddDays(-14);
        var lastWeekEnd = DateTime.UtcNow.AddDays(-7);

        var thisWeekMinutes = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified && s.CreatedAt >= thisWeek)
            .SumAsync(s => s.DurationMinutes);

        var lastWeekMinutes = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified
                && s.CreatedAt >= lastWeekStart && s.CreatedAt < lastWeekEnd)
            .SumAsync(s => s.DurationMinutes);

        var activeDays = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified && s.CreatedAt >= thisWeek)
            .Select(s => s.CreatedAt.Date)
            .Distinct()
            .CountAsync();

        var streak = await _streakCalculator.GetCurrentStreakAsync(userId);
        var longestStreak = await _streakCalculator.GetLongestStreakAsync(userId);

        // Determine favorite time of day
        var hourlyDist = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified)
            .GroupBy(s => s.CreatedAt.Hour)
            .Select(g => new { Hour = g.Key, Count = g.Count() })
            .OrderByDescending(x => x.Count)
            .FirstOrDefaultAsync();

        var favTime = hourlyDist?.Hour switch
        {
            >= 5 and < 12 => "Morning",
            >= 12 and < 17 => "Afternoon",
            >= 17 and < 21 => "Evening",
            _ => "Night"
        };

        var weekChange = lastWeekMinutes > 0
            ? Math.Round((thisWeekMinutes - lastWeekMinutes) / lastWeekMinutes * 100, 1)
            : 0m;

        return new AnalyticsOverviewDto
        {
            TotalMinutes = Math.Round(totalMinutes, 2),
            TotalSessions = totalSessions,
            AvgSessionMinutes = totalSessions > 0 ? Math.Round(totalMinutes / totalSessions, 2) : 0,
            CurrentStreak = streak,
            LongestStreak = longestStreak,
            ThisWeekMinutes = Math.Round(thisWeekMinutes, 2),
            LastWeekMinutes = Math.Round(lastWeekMinutes, 2),
            WeekOverWeekChange = weekChange,
            ActiveDaysThisWeek = activeDays,
            FavoriteTimeOfDay = favTime
        };
    }

    public async Task<List<RoomTimeBreakdownDto>> GetRoomBreakdownAsync(Guid userId)
    {
        var totalMinutes = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified)
            .SumAsync(s => s.DurationMinutes);

        if (totalMinutes == 0) return new();

        var breakdown = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified)
            .GroupBy(s => s.RoomId)
            .Select(g => new
            {
                RoomId = g.Key,
                Minutes = g.Sum(s => s.DurationMinutes),
                Sessions = g.Count()
            })
            .OrderByDescending(x => x.Minutes)
            .ToListAsync();

        var roomIds = breakdown.Select(b => b.RoomId).ToList();
        var rooms = await _context.Rooms
            .Where(r => roomIds.Contains(r.Id))
            .ToDictionaryAsync(r => r.Id);

        return breakdown.Select(b =>
        {
            var room = rooms.GetValueOrDefault(b.RoomId);
            return new RoomTimeBreakdownDto
            {
                RoomId = b.RoomId.ToString(),
                RoomName = room?.Name ?? "Unknown Room",
                Subject = room?.Subject,
                TotalMinutes = Math.Round(b.Minutes, 2),
                Sessions = b.Sessions,
                Percentage = Math.Round(b.Minutes / totalMinutes * 100, 1)
            };
        }).ToList();
    }

    public async Task<List<DailyTrendDto>> GetDailyTrendAsync(Guid userId, int days = 30)
    {
        var startDate = DateTime.UtcNow.AddDays(-days);

        return await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified && s.CreatedAt >= startDate)
            .GroupBy(s => s.CreatedAt.Date)
            .Select(g => new DailyTrendDto
            {
                Date = g.Key,
                Minutes = Math.Round(g.Sum(s => s.DurationMinutes), 2),
                Sessions = g.Count()
            })
            .OrderBy(x => x.Date)
            .ToListAsync();
    }

    public async Task<List<HourlyDistributionDto>> GetHourlyDistributionAsync(Guid userId)
    {
        var data = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified)
            .GroupBy(s => s.CreatedAt.Hour)
            .Select(g => new HourlyDistributionDto
            {
                Hour = g.Key,
                Minutes = Math.Round(g.Sum(s => s.DurationMinutes), 2),
                Sessions = g.Count()
            })
            .OrderBy(x => x.Hour)
            .ToListAsync();

        // Fill in missing hours
        var result = new List<HourlyDistributionDto>();
        for (int h = 0; h < 24; h++)
        {
            var existing = data.FirstOrDefault(d => d.Hour == h);
            result.Add(existing ?? new HourlyDistributionDto { Hour = h, Minutes = 0, Sessions = 0 });
        }
        return result;
    }

    public async Task<List<WeeklyGoalDto>> GetWeeklyGoalsAsync(Guid userId)
    {
        // Return last 8 weeks of goals
        var goals = await _context.Set<WeeklyGoal>()
            .Where(g => g.UserId == userId)
            .OrderByDescending(g => g.Year)
            .ThenByDescending(g => g.WeekNumber)
            .Take(8)
            .ToListAsync();

        return goals.Select(g => new WeeklyGoalDto
        {
            WeekNumber = g.WeekNumber,
            Year = g.Year,
            TargetMinutes = g.TargetMinutes,
            ActualMinutes = g.ActualMinutes
        }).ToList();
    }

    public async Task<WeeklyGoalDto> SetWeeklyGoalAsync(Guid userId, decimal targetMinutes)
    {
        var now = DateTime.UtcNow;
        var cal = System.Globalization.CultureInfo.InvariantCulture.Calendar;
        var weekNumber = cal.GetWeekOfYear(now, System.Globalization.CalendarWeekRule.FirstDay, DayOfWeek.Monday);
        var year = now.Year;

        var existing = await _context.Set<WeeklyGoal>()
            .FirstOrDefaultAsync(g => g.UserId == userId && g.WeekNumber == weekNumber && g.Year == year);

        // Compute actual minutes this week
        var weekStart = now.Date.AddDays(-(int)now.DayOfWeek + 1); // Monday
        var actualMinutes = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified && s.CreatedAt >= weekStart)
            .SumAsync(s => s.DurationMinutes);

        if (existing != null)
        {
            existing.TargetMinutes = targetMinutes;
            existing.ActualMinutes = actualMinutes;
            await _context.SaveChangesAsync();
        }
        else
        {
            var goal = new WeeklyGoal
            {
                UserId = userId,
                WeekNumber = weekNumber,
                Year = year,
                TargetMinutes = targetMinutes,
                ActualMinutes = actualMinutes
            };
            _context.Set<WeeklyGoal>().Add(goal);
            await _context.SaveChangesAsync();
        }

        return new WeeklyGoalDto
        {
            WeekNumber = weekNumber,
            Year = year,
            TargetMinutes = targetMinutes,
            ActualMinutes = Math.Round(actualMinutes, 2)
        };
    }
}
