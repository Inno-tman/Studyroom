using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("DirectMessages")]
public class DirectMessage
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid SenderId { get; set; }

    public Guid ReceiverId { get; set; }

    [Required, MaxLength(2000)]
    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(SenderId))]
    public User? Sender { get; set; }

    [ForeignKey(nameof(ReceiverId))]
    public User? Receiver { get; set; }
}
