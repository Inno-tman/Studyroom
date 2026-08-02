using System.ComponentModel.DataAnnotations;

namespace StudyRoom.API.DTOs.Auth;

public class SendFriendRequestDto
{
    [Required]
    public Guid UserId { get; set; }
}
