using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudyRoom.API.Models;

[Table("NoteVersions")]
public class NoteVersion
{
    [Key]
    public Guid Id { get; set; } = Guid.NewGuid();

    public Guid NoteId { get; set; }

    public string Content { get; set; } = "";

    public Guid EditedById { get; set; }

    public string EditedByName { get; set; } = "";

    public DateTime EditedAt { get; set; } = DateTime.UtcNow;

    [ForeignKey(nameof(NoteId))]
    public Note? Note { get; set; }
}