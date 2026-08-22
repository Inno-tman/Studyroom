using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("PostStats")]
public class PostStats
{
    [Key]
    public Guid PostId { get; set; }

    public int CommentCount { get; set; }
    public int ReactionCount { get; set; }
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}
