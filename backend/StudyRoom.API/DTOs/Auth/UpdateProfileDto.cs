using System.ComponentModel.DataAnnotations;

namespace StudyRoom.API.DTOs.Auth;

public class UpdateProfileDto
{
    [Required, MinLength(3), MaxLength(50)]
    public string Username { get; set; } = string.Empty;

    [MaxLength(2000000)]
    public string? AvatarUrl { get; set; }

    [MaxLength(100)]
    public string? FirstName { get; set; }

    [MaxLength(100)]
    public string? LastName { get; set; }

    [MaxLength(150)]
    public string? SchoolName { get; set; }

    [MaxLength(150)]
    public string? Location { get; set; }

    public DateTime? BirthDate { get; set; }

    [MaxLength(150)]
    public string? Major { get; set; }

    [MaxLength(500)]
    public string? Interests { get; set; }

    [MaxLength(1000)]
    public string? Bio { get; set; }

    [MaxLength(64)]
    public string? TimeZoneId { get; set; }
}
