using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("PostComments")]
public class PostComment
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid PostId { get; set; }

    public Guid UserId { get; set; }

    [Required, MaxLength(1000)]
    public string Content { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(PostId))]
    public Post? Post { get; set; }

    [ForeignKey(nameof(UserId))]
    public User? Author { get; set; }
}
