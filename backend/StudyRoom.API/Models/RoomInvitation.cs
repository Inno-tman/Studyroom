using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("RoomInvitations")]
public class RoomInvitation
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RoomId { get; set; }

    public Guid InviterId { get; set; }

    public Guid InviteeId { get; set; }

    [Required, MaxLength(20)]
    public string Status { get; set; } = "Pending";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(RoomId))]
    public Room? Room { get; set; }

    [ForeignKey(nameof(InviterId))]
    public User? Inviter { get; set; }

    [ForeignKey(nameof(InviteeId))]
    public User? Invitee { get; set; }
}
