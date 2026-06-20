using System.ComponentModel.DataAnnotations;

namespace StudyRoom.API.DTOs.Rooms;

public class CreateRoomDto
{
    [Required, MinLength(1), MaxLength(100)]
    public string Name { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Description { get; set; }

    [MaxLength(50)]
    public string? Subject { get; set; }

    public bool IsPrivate { get; set; }
}
