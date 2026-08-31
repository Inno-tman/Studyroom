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

    /// <summary>
    /// Optional verification workflow: an unverified session can be explained by
    /// its owner (VerificationComment) and requested for review; the room's
    /// host/co-host approves (→ re-verified + retroactive award) or declines.
    /// The owner may also "void" their own flagged session (→ excluded, never
    /// counted). States: null (not reviewed) / "Pending" / "Approved" / "Declined" / "Voided".
    /// Only excessive_duration, too_many_sessions and excessive_tab_switches
    /// are eligible. AwardProcessed stays guarded so a re-award never double-counts.
    /// </summary>
    [MaxLength(2000)]
    public string? VerificationComment { get; set; }

    [MaxLength(20)]
    public string? VerificationState { get; set; }

    public DateTime? VerificationRequestedAt { get; set; }

    public DateTime? VerifiedAt { get; set; }

    public Guid? VerificationReviewerUserId { get; set; }

    [MaxLength(500)]
    public string? VerificationReviewNote { get; set; }

    [MaxLength(2000)]
    public string? SessionNotes { get; set; }

    public DateTime? StartedAt { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    [ForeignKey(nameof(RoomId))]
    public Room? Room { get; set; }
}
