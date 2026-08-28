namespace StudyRoom.API.DTOs.Gamification;

public class GamificationProfileDto
{
    public int TotalXp { get; set; }
    public int Level { get; set; }
    public int XpIntoLevel { get; set; }
    public int XpForNextLevel { get; set; }
    public int CurrentStreak { get; set; }
    public int BadgeCount { get; set; }
    public decimal ThisWeekMinutes { get; set; }
    public List<XpEventDto> RecentEvents { get; set; } = new();
}

public class XpEventDto
{
    public Guid Id { get; set; }
    public string Type { get; set; } = "";
    public int Points { get; set; }
    public string? Label { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class FriendLeaderboardRowDto
{
    public string UserId { get; set; } = "";
    public string Username { get; set; } = "";
    public string DisplayName { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public bool IsMe { get; set; }
    public int Rank { get; set; }
    public int WeeklyXp { get; set; }
    public int TotalXp { get; set; }
    public int Level { get; set; }
    public decimal ThisWeekMinutes { get; set; }
    public int Streak { get; set; }
}