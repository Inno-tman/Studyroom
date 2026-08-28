using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.DTOs.Gamification;
using StudyRoom.API.Models;

namespace StudyRoom.API.Services;

public interface IXpService
{
    Task AwardAsync(Guid userId, string type, int points, string? label = null);
    Task<GamificationProfileDto> GetProfileAsync(Guid userId);
    Task<GamificationProfileDto> GetProfileForUserAsync(Guid userId);
    Task<List<FriendLeaderboardRowDto>> GetFriendsLeaderboardAsync(Guid userId, int take = 25);
}

public class XpService : IXpService
{
    private readonly AppDbContext _context;
    private readonly IStreakCalculator _streakCalculator;

    public XpService(AppDbContext context, IStreakCalculator streakCalculator)
    {
        _context = context;
        _streakCalculator = streakCalculator;
    }

    public async Task AwardAsync(Guid userId, string type, int points, string? label = null)
    {
        if (points <= 0) return;

        _context.XpEvents.Add(new XpEvent
        {
            UserId = userId,
            Type = type,
            Points = points,
            Label = label
        });
        await _context.SaveChangesAsync();
    }

    public async Task<GamificationProfileDto> GetProfileAsync(Guid userId) =>
        await GetProfileForUserAsync(userId);

    public async Task<GamificationProfileDto> GetProfileForUserAsync(Guid userId)
    {
        var totalXp = await _context.XpEvents
            .Where(e => e.UserId == userId)
            .SumAsync(e => e.Points);

        var (level, xpIntoLevel, xpForNextLevel) = ComputeLevel(totalXp);

        var recent = await _context.XpEvents
            .Where(e => e.UserId == userId)
            .OrderByDescending(e => e.CreatedAt)
            .Take(20)
            .Select(e => new XpEventDto
            {
                Id = e.Id,
                Type = e.Type,
                Points = e.Points,
                Label = e.Label,
                CreatedAt = e.CreatedAt
            })
            .ToListAsync();

        var badgeCount = await _context.UserMilestones
            .CountAsync(m => m.UserId == userId);

        var streak = await _streakCalculator.GetCurrentStreakAsync(userId);

        var weekStart = DateTime.UtcNow.AddDays(-7).Date;
        var thisWeekMinutes = await _context.StudySessions
            .Where(s => s.UserId == userId && s.Completed && s.IsVerified && s.CreatedAt >= weekStart)
            .SumAsync(s => s.DurationMinutes);

        return new GamificationProfileDto
        {
            TotalXp = totalXp,
            Level = level,
            XpIntoLevel = xpIntoLevel,
            XpForNextLevel = xpForNextLevel,
            CurrentStreak = streak,
            BadgeCount = badgeCount,
            ThisWeekMinutes = Math.Round(thisWeekMinutes, 2),
            RecentEvents = recent
        };
    }

    public async Task<List<FriendLeaderboardRowDto>> GetFriendsLeaderboardAsync(Guid userId, int take = 25)
    {
        var weekStart = DateTime.UtcNow.AddDays(-7).Date;

        var friendIds = await _context.Friendships
            .Where(f => f.Status == "Accepted" && (f.RequesterId == userId || f.AddresseeId == userId))
            .Select(f => f.RequesterId == userId ? f.AddresseeId : f.RequesterId)
            .Distinct()
            .ToListAsync();

        if (!friendIds.Contains(userId))
            friendIds.Add(userId);

        var userRows = await _context.Users
            .Where(u => friendIds.Contains(u.Id))
            .ToDictionaryAsync(u => u.Id);

        var rows = new List<FriendLeaderboardRowDto>();

        foreach (var id in friendIds)
        {
            var user = userRows.GetValueOrDefault(id);
            if (user == null) continue;

            var weekXp = await _context.XpEvents
                .Where(e => e.UserId == id && e.CreatedAt >= weekStart)
                .SumAsync(e => e.Points);
            var totalXp = await _context.XpEvents
                .Where(e => e.UserId == id)
                .SumAsync(e => e.Points);
            var minutes = await _context.StudySessions
                .Where(s => s.UserId == id && s.Completed && s.IsVerified && s.CreatedAt >= weekStart)
                .SumAsync(s => s.DurationMinutes);
            var streak = await _streakCalculator.GetCurrentStreakAsync(id);

            rows.Add(new FriendLeaderboardRowDto
            {
                UserId = id.ToString(),
                Username = user.Username,
                DisplayName = string.IsNullOrWhiteSpace(user.FirstName) && string.IsNullOrWhiteSpace(user.LastName)
                    ? user.Username
                    : $"{user.FirstName} {user.LastName}".Trim(),
                AvatarUrl = user.AvatarUrl,
                IsMe = id == userId,
                WeeklyXp = weekXp,
                TotalXp = totalXp,
                Level = ComputeLevel(totalXp).Level,
                ThisWeekMinutes = Math.Round(minutes, 2),
                Streak = streak
            });
        }

        return rows
            .OrderByDescending(r => r.WeeklyXp)
            .ThenByDescending(r => r.TotalXp)
            .Take(take)
            .Select((r, i) => { r.Rank = i + 1; return r; })
            .ToList();
    }

    public static (int Level, int XpIntoLevel, int XpForNextLevel) ComputeLevel(int totalXp)
    {
        int level = 1;
        int need = 100;
        int remaining = totalXp;

        while (remaining >= need)
        {
            remaining -= need;
            level++;
            need = 100 + (level - 1) * 50;
        }

        return (level, remaining, need);
    }
}