using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("Posts")]
public class Post
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid UserId { get; set; }

    [Required, MaxLength(5000)]
    public string Content { get; set; } = string.Empty;

    public Guid? RoomId { get; set; }

    public Guid? SharedPostId { get; set; }

    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(UserId))]
    public User? Author { get; set; }

    [ForeignKey(nameof(SharedPostId))]
    public Post? SharedPost { get; set; }

    [ForeignKey(nameof(RoomId))]
    public Room? Room { get; set; }

    public ICollection<PostComment> Comments { get; set; } = new List<PostComment>();
    public ICollection<PostReaction> Reactions { get; set; } = new List<PostReaction>();
}
