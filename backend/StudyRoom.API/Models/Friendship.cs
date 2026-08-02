using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("Friendships")]
public class Friendship
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid RequesterId { get; set; }

    public Guid AddresseeId { get; set; }

    [Required, MaxLength(20)]
    public string Status { get; set; } = "Pending";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(RequesterId))]
    public User? Requester { get; set; }

    [ForeignKey(nameof(AddresseeId))]
    public User? Addressee { get; set; }
}
