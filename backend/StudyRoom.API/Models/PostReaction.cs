using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("PostReactions")]
public class PostReaction
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PostId { get; set; }

    public Guid UserId { get; set; }

    [Required, MaxLength(20)]
    public string Type { get; set; } = "like";

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(PostId))]
    public Post? Post { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? User { get; set; }
}
