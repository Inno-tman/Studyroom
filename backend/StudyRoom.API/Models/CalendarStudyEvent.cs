using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

/// <summary>
/// Maps a calendar provider event id to the StudyRoom day it aggregates.
/// Auto-sync creates ONE calendar event per calendar day instead of one per
/// study session, and extends that event's end time on later sessions.
/// </summary>
[Table("CalendarStudyEvents")]
public class CalendarStudyEvent
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    [Required, MaxLength(20)]
    public string Provider { get; set; } = "";

    [MaxLength(500)]
    public string CalendarId { get; set; } = "primary";

    public DateTime DayUtc { get; set; }

    [MaxLength(500)]
    public string EventProviderId { get; set; } = "";

    public DateTime LastEndUtc { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }
}