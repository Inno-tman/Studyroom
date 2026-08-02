using System.ComponentModel.DataAnnotations;

namespace StudyRoom.API.DTOs.Auth;

public class UpdateProfileDto
{
    [Required, MinLength(3), MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? AvatarUrl { get; set; }
}
