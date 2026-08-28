using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;

namespace StudyRoom.API.Services;

/// <summary>
/// Single source of truth for study-streak math. XP, milestones, analytics and
/// leaderboards all consume the same definition so a streak change (anchor rule,
/// verified-only, room scoping) is applied everywhere at once.
/// </summary>
public interface IStreakCalculator
{
    /// <summary>Consecutive distinct days with a verified session, anchored to today.</summary>
    Task<int> GetCurrentStreakAsync(Guid userId);

    /// <summary>Longest run of consecutive days with a verified session.</summary>
    Task<int> GetLongestStreakAsync(Guid userId);

    /// <summary>Consecutive distinct days with a verified session in a single room.</summary>
    Task<int> GetRoomStreakAsync(Guid userId, Guid roomId);

    /// <summary>Distinct study dates (verified sessions only), newest first.</summary>
    Task<List<DateTime>> GetStudyDatesAsync(Guid userId, Guid? roomId = null);
}

public class StreakCalculator : IStreakCalculator
{
    private readonly AppDbContext _context;

    public StreakCalculator(AppDbContext context) => _context = context;

    public async Task<int> GetCurrentStreakAsync(Guid userId)
    {
        var dates = await GetStudyDatesAsync(userId);
        return ComputeCurrentStreak(dates, DateTime.UtcNow.Date);
    }

    public async Task<int> GetLongestStreakAsync(Guid userId)
    {
        var dates = await GetStudyDatesAsync(userId);
        return ComputeLongestStreak(dates);
    }

    public async Task<int> GetRoomStreakAsync(Guid userId, Guid roomId)
    {
        var dates = await GetStudyDatesAsync(userId, roomId);
        return ComputeCurrentStreak(dates, DateTime.UtcNow.Date);
    }

    public async Task<List<DateTime>> GetStudyDatesAsync(Guid userId, Guid? roomId = null)
    {
        var query = _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified);
        if (roomId.HasValue)
            query = query.Where(s => s.RoomId == roomId.Value);

        return await query
            .Select(s => s.CreatedAt.Date)
            .Distinct()
            .OrderByDescending(d => d)
            .ToListAsync();
    }

    /// <summary>
    /// Counts consecutive days ending at (or the day before) the anchor date.
    /// A session yesterday keeps the streak alive until the user studies today.
    /// </summary>
    public static int ComputeCurrentStreak(List<DateTime> distinctDatesDesc, DateTime anchorDate)
    {
        if (distinctDatesDesc.Count == 0) return 0;

        int streak = 0;
        var expected = anchorDate.Date;
        foreach (var date in distinctDatesDesc)
        {
            if (date == expected || date == expected.AddDays(-1))
            {
                streak++;
                expected = date;
            }
            else break;
        }
        return streak;
    }

    public static int ComputeLongestStreak(List<DateTime> datesAscOrDesc)
    {
        var ordered = datesAscOrDesc.OrderBy(d => d).ToList();
        if (ordered.Count == 0) return 0;

        int longest = 1;
        int current = 1;
        for (int i = 1; i < ordered.Count; i++)
        {
            if ((ordered[i] - ordered[i - 1]).TotalDays == 1)
            {
                current++;
                longest = Math.Max(longest, current);
            }
            else
            {
                current = 1;
            }
        }
        return longest;
    }
}