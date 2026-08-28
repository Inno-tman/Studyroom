namespace StudyRoom.API.DTOs.RoomTasks;

public class RoomTaskDto
{
    public Guid Id { get; set; }
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? AssignedToId { get; set; }
    public string? AssignedToName { get; set; }
    public bool IsCompleted { get; set; }
    public string? CompletedBy { get; set; }
    public DateTime? DueDate { get; set; }
    public DateTime CreatedAt { get; set; }
    public DateTime? CompletedAt { get; set; }
}

public class CreateRoomTaskDto
{
    public string Title { get; set; } = "";
    public string? Description { get; set; }
    public string? AssignedToId { get; set; }
    public string? DueDate { get; set; }
}

public class UpdateRoomTaskDto
{
    public string? Title { get; set; }
    public string? Description { get; set; }
    public string? AssignedToId { get; set; }
    public string? DueDate { get; set; }
    public bool? IsCompleted { get; set; }
}