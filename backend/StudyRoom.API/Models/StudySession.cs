using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("StudySessions")]
public class StudySession
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public Guid RoomId { get; set; }

    public decimal DurationMinutes { get; set; }

    public bool Completed { get; set; }

    public bool IsVerified { get; set; } = true;

    [MaxLength(50)]
    public string? VerifiedReason { get; set; }

    /// <summary>
    /// Idempotency flag: set exactly once when the session is finalized (XP,
    /// milestones, calendar sync). Guards against double-awarding when the HTTP
    /// complete, the timer scheduler and the hub all race to finalize the same
    /// session.
    /// </summary>
    public bool AwardProcessed { get; set; }

    [MaxLength(2000)]
    public string? SessionNotes { get; set; }

    public DateTime? StartedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    [ForeignKey(nameof(RoomId))]
    public Room? Room { get; set; }
}
