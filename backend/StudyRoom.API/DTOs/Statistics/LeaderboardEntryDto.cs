namespace StudyRoom.API.DTOs.Statistics;

public class LeaderboardEntryDto
{
    public string UserId { get; set; } = "";
    public string Username { get; set; } = "";
    public string? AvatarUrl { get; set; }
    public decimal VerifiedMinutes { get; set; }
    public int Sessions { get; set; }
    public int Streak { get; set; }
    public int Rank { get; set; }
}
