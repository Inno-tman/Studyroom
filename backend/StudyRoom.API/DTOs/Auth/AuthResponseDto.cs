namespace StudyRoom.API.DTOs.Auth;

public class AuthResponseDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public string? SchoolName { get; set; }
    public string? Location { get; set; }
    public DateTime? BirthDate { get; set; }
    public string? Major { get; set; }
    public string? Interests { get; set; }
    public string? Bio { get; set; }
    public string Role { get; set; } = string.Empty;
    public bool ProfileComplete { get; set; }
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime RefreshTokenExpiresAt { get; set; }
}
