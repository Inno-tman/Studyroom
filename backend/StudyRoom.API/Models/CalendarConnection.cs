using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("CalendarConnections")]
public class CalendarConnection
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    [Required, MaxLength(20)]
    public string Provider { get; set; } = string.Empty; // "google" or "microsoft"

    [Required, MaxLength(500)]
    public string AccessToken { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? RefreshToken { get; set; }

    public DateTime TokenExpiresAt { get; set; }

    [MaxLength(500)]
    public string? CalendarId { get; set; } // primary calendar ID

    [MaxLength(200)]
    public string? CalendarName { get; set; }

    public bool AutoSync { get; set; } = true;

    public DateTime ConnectedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }
}
