using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

public class ScheduledBroadcastAttendee
{
    [Key] public Guid BroadcastId { get; set; }
    [Key] public Guid UserId { get; set; }

    [Required, MaxLength(20)]
    public string Status { get; set; } = "Accepted"; // "Accepted" | "Declined"

    public DateTime RespondedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(BroadcastId))] public ScheduledBroadcast? Broadcast { get; set; }
    [ForeignKey(nameof(UserId))] public User? User { get; set; }
}
