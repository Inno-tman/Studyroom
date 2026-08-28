namespace StudyRoom.API.DTOs.Notes;

public class NotesDto
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public string Content { get; set; } = string.Empty;
    public DateTime UpdatedAt { get; set; }
}

public class UpdateNotesDto
{
    public string Content { get; set; } = string.Empty;
}

public class NoteVersionDto
{
    public Guid Id { get; set; }
    public string Content { get; set; } = string.Empty;
    public Guid EditedById { get; set; }
    public string EditedByName { get; set; } = string.Empty;
    public DateTime EditedAt { get; set; }
}
