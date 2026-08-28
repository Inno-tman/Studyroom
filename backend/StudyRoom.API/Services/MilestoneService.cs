using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Models;

namespace StudyRoom.API.Services;

public interface IMilestoneService
{
    Task CheckAndAwardMilestonesAsync(Guid userId);
    Task<List<UserMilestone>> GetUserMilestonesAsync(Guid userId);
}

public class MilestoneService : IMilestoneService
{
    private readonly AppDbContext _context;
    private readonly IStreakCalculator _streakCalculator;

    public MilestoneService(AppDbContext context, IStreakCalculator streakCalculator)
    {
        _context = context;
        _streakCalculator = streakCalculator;
    }

    public async Task<List<UserMilestone>> GetUserMilestonesAsync(Guid userId) =>
        await _context.UserMilestones
            .Where(m => m.UserId == userId)
            .OrderByDescending(m => m.EarnedAt)
            .ToListAsync();

    public async Task CheckAndAwardMilestonesAsync(Guid userId)
    {
        var existing = (await _context.UserMilestones
            .Where(m => m.UserId == userId)
            .Select(m => m.MilestoneType)
            .ToListAsync()).ToHashSet();

        var totalMinutes = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified)
            .SumAsync(s => s.DurationMinutes);

        var totalSessions = await _context.StudySessions
            .CountAsync(s => s.UserId == userId && s.Completed && s.IsVerified);

        var streak = await _streakCalculator.GetCurrentStreakAsync(userId);

        var candidates = new List<(string Type, string Title, string Desc, string Icon, bool Earned)>();

        // Streak milestones
        candidates.Add(("streak_7", "7-Day Warrior", "Maintained a 7-day study streak", "military_tech", streak >= 7));
        candidates.Add(("streak_14", "Two-Week Champion", "Maintained a 14-day study streak", "workspace_premium", streak >= 14));
        candidates.Add(("streak_30", "Monthly Master", "Maintained a 30-day study streak", "emoji_events", streak >= 30));
        candidates.Add(("streak_60", "Unstoppable", "Maintained a 60-day study streak", "diamond", streak >= 60));
        candidates.Add(("streak_100", "Legendary Focus", "Maintained a 100-day study streak", "local_fire_department", streak >= 100));

        // Session count milestones
        candidates.Add(("sessions_10", "Getting Started", "Completed 10 study sessions", "school", totalSessions >= 10));
        candidates.Add(("sessions_50", "Dedicated Learner", "Completed 50 study sessions", "psychology", totalSessions >= 50));
        candidates.Add(("sessions_100", "Century Club", "Completed 100 study sessions", "military_tech", totalSessions >= 100));
        candidates.Add(("sessions_500", "Study Machine", "Completed 500 study sessions", "rocket_launch", totalSessions >= 500));

        // Total hours milestones
        candidates.Add(("hours_10", "10 Hours In", "Accumulated 10+ hours of verified study", "timer", totalMinutes >= 600));
        candidates.Add(("hours_50", "Half Century Hours", "Accumulated 50+ hours of verified study", "schedule", totalMinutes >= 3000));
        candidates.Add(("hours_100", "Centurion", "Accumulated 100+ hours of verified study", "workspace_premium", totalMinutes >= 6000));
        candidates.Add(("hours_500", "500 Hour Legend", "Accumulated 500+ hours of verified study", "diamond", totalMinutes >= 30000));
        candidates.Add(("hours_1000", "1000 Hour Master", "Accumulated 1000+ hours of verified study", "emoji_events", totalMinutes >= 60000));

        foreach (var (type, title, desc, icon, earned) in candidates)
        {
            if (earned && !existing.Contains(type))
            {
                _context.UserMilestones.Add(new UserMilestone
                {
                    UserId = userId,
                    MilestoneType = type,
                    Title = title,
                    Description = desc,
                    Icon = icon
                });
            }
        }

        await _context.SaveChangesAsync();
    }
}
