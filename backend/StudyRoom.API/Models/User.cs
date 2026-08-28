using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace StudyRoom.API.Models;

[Table("Users")]
public class User
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    [Required, MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [Required, MaxLength(100)]
    public string Email { get; set; } = string.Empty;

    [JsonIgnore]
    public string PasswordHash { get; set; } = string.Empty;

    [MaxLength(2000000)]
    public string? AvatarUrl { get; set; }

    [MaxLength(100)]
    public string? GoogleId { get; set; }

    [MaxLength(100)]
    public string? FirstName { get; set; }

    [MaxLength(100)]
    public string? LastName { get; set; }

    [MaxLength(150)]
    public string? SchoolName { get; set; }

    [MaxLength(150)]
    public string? Location { get; set; }

    public DateTime? BirthDate { get; set; }

    [MaxLength(150)]
    public string? Major { get; set; }

    [MaxLength(500)]
    public string? Interests { get; set; }

    [MaxLength(1000)]
    public string? Bio { get; set; }

    /// <summary>IANA time zone id (e.g. "Europe/Berlin") used for local-time nudges, summaries and reminders.</summary>
    [MaxLength(64)]
    public string? TimeZoneId { get; set; }

    [MaxLength(200)]
    public string? RefreshToken { get; set; }

    public DateTime? RefreshTokenExpiresAt { get; set; }

    public string Role { get; set; } = "User";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    // Phase 4 — daily study goal (minutes), default 2 hours
    public int DailyGoalMinutes { get; set; } = 120;

    // Phase 7 — custom study schedule
    [MaxLength(200)]
    public string? PreferredStudyDays { get; set; } // e.g. "Mon,Tue,Wed,Thu,Fri"

    [MaxLength(500)]
    public string? PreferredStudyHours { get; set; } // e.g. "09:00-12:00,14:00-17:00"

    // Last known online timestamp, updated on SignalR connect/disconnect
    public DateTime? LastSeenAt { get; set; }

    public ICollection<RoomMember> RoomMemberships { get; set; } = new List<RoomMember>();
    public ICollection<Message> Messages { get; set; } = new List<Message>();
    public ICollection<StudySession> StudySessions { get; set; } = new List<StudySession>();
    public ICollection<Post> Posts { get; set; } = new List<Post>();
    public ICollection<PostComment> Comments { get; set; } = new List<PostComment>();
    public ICollection<PostReaction> Reactions { get; set; } = new List<PostReaction>();
}
