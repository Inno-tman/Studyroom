using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("UserStats")]
public class UserStats
{
    [Key]
    public Guid UserId { get; set; }

    public decimal TotalStudyMinutes { get; set; }
    public int SessionsCompleted { get; set; }
    public int DailyStreak { get; set; }
    public decimal WeeklyStudyMinutes { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
