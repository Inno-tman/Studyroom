using System.ComponentModel.DataAnnotations;

namespace StudyRoom.API.DTOs.AI;

public class AcademicQueryDto
{
    [Required, MaxLength(2000)]
    public string Question { get; set; } = string.Empty;

    public string? Subject { get; set; }

    public string? Context { get; set; }
}

public class AcademicResponseDto
{
    public string Answer { get; set; } = string.Empty;
    public string? Subject { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
