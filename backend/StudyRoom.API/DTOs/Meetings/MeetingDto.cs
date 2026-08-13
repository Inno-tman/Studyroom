namespace StudyRoom.API.DTOs.Meetings;

public class MeetingDto
{
    public Guid Id { get; set; }
    public Guid RoomId { get; set; }
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; }
    public string CreatedByUsername { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; }
}

public class CreateMeetingDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; } = 60;
}

public class UpdateMeetingDto
{
    public string Title { get; set; } = string.Empty;
    public string? Description { get; set; }
    public DateTime ScheduledAt { get; set; }
    public int DurationMinutes { get; set; } = 60;
}