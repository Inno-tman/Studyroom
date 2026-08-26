using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public interface IRecommendationService
{
    Task<List<RecommendationDto>> GetRecommendationsAsync(Guid userId);
}

public class RecommendationDto
{
    public string Type { get; set; } = "";
    public string Title { get; set; } = "";
    public string Description { get; set; } = "";
    public string Icon { get; set; } = "lightbulb";
    public string? ActionLink { get; set; }
}

public class RecommendationService : IRecommendationService
{
    private readonly AppDbContext _context;
    private readonly IStudySessionRepository _sessionRepo;

    public RecommendationService(AppDbContext context, IStudySessionRepository sessionRepo)
    {
        _context = context;
        _sessionRepo = sessionRepo;
    }

    public async Task<List<RecommendationDto>> GetRecommendationsAsync(Guid userId)
    {
        var recs = new List<RecommendationDto>();
        var now = DateTime.UtcNow;
        var hour = now.Hour;

        var user = await _context.Users.FindAsync(userId);
        if (user == null) return recs;

        var streak = await _sessionRepo.GetCurrentStreakAsync(userId);
        var todayMinutes = await _sessionRepo.GetTodayStudyMinutesAsync(userId);
        var totalMinutes = await _sessionRepo.GetTotalStudyMinutesAsync(userId);
        var weeklyMinutes = await _sessionRepo.GetWeeklyStudyMinutesAsync(userId);

        // 1. Streak protection
        if (streak >= 3 && todayMinutes == 0)
        {
            recs.Add(new RecommendationDto
            {
                Type = "streak",
                Title = $"Protect your {streak}-day streak!",
                Description = "You haven't studied today. Even a short session keeps your streak alive.",
                Icon = "local_fire_department",
                ActionLink = "/rooms"
            });
        }

        // 2. Daily goal progress
        if (user.DailyGoalMinutes > 0 && todayMinutes > 0 && todayMinutes < user.DailyGoalMinutes)
        {
            var remaining = user.DailyGoalMinutes - todayMinutes;
            recs.Add(new RecommendationDto
            {
                Type = "goal",
                Title = $"{Math.Round(remaining, 0)} min left to hit today's goal",
                Description = $"You've studied {Math.Round(todayMinutes, 0)} min. Keep going!",
                Icon = "flag"
            });
        }

        // 3. Time-of-day suggestions
        if (hour >= 9 && hour < 12)
        {
            recs.Add(new RecommendationDto
            {
                Type = "timing",
                Title = "Morning focus window",
                Description = "Studies show mornings are peak focus time. Tackle your hardest subject now.",
                Icon = "wb_sunny"
            });
        }
        else if (hour >= 13 && hour < 15)
        {
            recs.Add(new RecommendationDto
            {
                Type = "timing",
                Title = "Afternoon slump?",
                Description = "Try a shorter 15-min focus session to push through the post-lunch dip.",
                Icon = "coffee"
            });
        }
        else if (hour >= 20)
        {
            recs.Add(new RecommendationDto
            {
                Type = "timing",
                Title = "Evening wind-down",
                Description = "A light review session before bed helps consolidate memory. Try 20 minutes.",
                Icon = "bedtime"
            });
        }

        // 4. Weekly trend
        if (weeklyMinutes > 0)
        {
            var dailyAvg = weeklyMinutes / 7m;
            if (dailyAvg < user.DailyGoalMinutes * 0.5m)
            {
                recs.Add(new RecommendationDto
                {
                    Type = "trend",
                    Title = "Weekly average below target",
                    Description = $"Your daily average is {Math.Round(dailyAvg, 0)} min. Try setting a shorter daily goal to build consistency.",
                    Icon = "trending_down"
                });
            }
            else if (dailyAvg >= user.DailyGoalMinutes)
            {
                recs.Add(new RecommendationDto
                {
                    Type = "trend",
                    Title = "You're crushing it this week!",
                    Description = $"Daily average: {Math.Round(dailyAvg, 0)} min. Consider raising your goal to keep challenging yourself.",
                    Icon = "trending_up"
                });
            }
        }

        // 5. Room suggestion
        var memberRoomIds = await _context.RoomMembers
            .Where(rm => rm.UserId == userId)
            .Select(rm => rm.RoomId)
            .ToListAsync();

        if (memberRoomIds.Count == 0)
        {
            recs.Add(new RecommendationDto
            {
                Type = "social",
                Title = "Join a study room",
                Description = "Studying with others keeps you accountable. Find a room that matches your interests.",
                Icon = "groups",
                ActionLink = "/rooms"
            });
        }
        else if (memberRoomIds.Count <= 2)
        {
            recs.Add(new RecommendationDto
            {
                Type = "social",
                Title = "Explore more rooms",
                Description = "Joining more rooms gives you variety and more accountability partners.",
                Icon = "explore",
                ActionLink = "/rooms"
            });
        }

        // 6. New user onboarding
        if (totalMinutes < 60)
        {
            recs.Add(new RecommendationDto
            {
                Type = "onboarding",
                Title = "Start with a 25-min focus session",
                Description = "The Pomodoro technique is proven to boost focus. Join a room and hit Start!",
                Icon = "school"
            });
        }

        return recs.Take(5).ToList();
    }
}
