using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("WeeklyGoals")]
public class WeeklyGoal
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    public int WeekNumber { get; set; }

    public int Year { get; set; }

    public decimal TargetMinutes { get; set; }

    public decimal ActualMinutes { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }
}
