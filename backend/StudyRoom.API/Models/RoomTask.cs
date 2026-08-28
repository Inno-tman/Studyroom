using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("RoomTasks")]
public class RoomTask
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RoomId { get; set; }

    public Guid CreatedBy { get; set; }

    [Required, MaxLength(300)]
    public string Title { get; set; } = "";

    [MaxLength(1000)]
    public string? Description { get; set; }

    public Guid? AssignedToId { get; set; }

    [MaxLength(100)]
    public string? AssignedToName { get; set; }

    public bool IsCompleted { get; set; }

    public Guid? CompletedBy { get; set; }

    public DateTime? DueDate { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public DateTime? CompletedAt { get; set; }

    [ForeignKey(nameof(RoomId))]
    public Room? Room { get; set; }

    [ForeignKey(nameof(CreatedBy))]
    public User? Creator { get; set; }

    [ForeignKey(nameof(AssignedToId))]
    public User? Assignee { get; set; }
}