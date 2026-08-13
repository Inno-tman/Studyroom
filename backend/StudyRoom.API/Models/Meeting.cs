using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("Meetings")]
public class Meeting
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RoomId { get; set; }

    public Guid CreatedBy { get; set; }

    [Required, MaxLength(150)]
    public string Title { get; set; } = string.Empty;

    [MaxLength(1000)]
    public string? Description { get; set; }

    public DateTime ScheduledAt { get; set; }

    public int DurationMinutes { get; set; } = 60;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(RoomId))]
    public Room? Room { get; set; }

    [ForeignKey(nameof(CreatedBy))]
    public User? Creator { get; set; }
}