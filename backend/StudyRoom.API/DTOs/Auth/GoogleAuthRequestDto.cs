using System.ComponentModel.DataAnnotations;

namespace StudyRoom.API.DTOs.Auth;

public class GoogleAuthRequestDto
{
    [Required]
    public string IdToken { get; set; } = string.Empty;
}
