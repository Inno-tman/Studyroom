namespace StudyRoom.API.DTOs.Rooms;

public class RoomDto
{
    public Guid Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string? Description { get; set; }
    public string? Subject { get; set; }
    public bool IsPrivate { get; set; }
    public string? JoinCode { get; set; }
    public string CreatedByUsername { get; set; } = string.Empty;
    public int MemberCount { get; set; }
    public DateTime CreatedAt { get; set; }
}
