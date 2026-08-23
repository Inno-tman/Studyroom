using StudyRoom.API.DTOs.Statistics;

namespace StudyRoom.API.DTOs.Users;

public class PublicUserProfileDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? SchoolName { get; set; }
    public string? Location { get; set; }
    public string? Major { get; set; }
    public string? Interests { get; set; }
    public string? Bio { get; set; }
    public string Role { get; set; } = "User";
    public DateTime CreatedAt { get; set; }
    public UserStatsDto Stats { get; set; } = new();
}
