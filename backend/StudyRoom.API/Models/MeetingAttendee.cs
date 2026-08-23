using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

public class MeetingAttendee
{
    [Key]
    public Guid MeetingId { get; set; }

    [Key]
    public Guid UserId { get; set; }

    [Required, MaxLength(20)]
    public string Status { get; set; } = "Accepted"; // "Accepted" | "Declined"

    public DateTime RespondedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(MeetingId))]
    public Meeting? Meeting { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }
}
