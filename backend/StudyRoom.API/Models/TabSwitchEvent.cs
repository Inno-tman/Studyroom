using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("TabSwitchEvents")]
public class TabSwitchEvent
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public Guid SessionId { get; set; }

    [Required, MaxLength(20)]
    public string EventType { get; set; } = ""; // "left" or "returned"

    public DateTime OccurredAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }

    [ForeignKey(nameof(SessionId))]
    public StudySession? Session { get; set; }
}
