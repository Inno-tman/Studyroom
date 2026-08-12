using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("PushSubscriptions")]
public class PushSubscription
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    [Required, MaxLength(1000)]
    public string Endpoint { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string P256dh { get; set; } = string.Empty;

    [Required, MaxLength(500)]
    public string Auth { get; set; } = string.Empty;

    public string? UserAgent { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}