using Microsoft.EntityFrameworkCore;
using StudyRoom.API.Data;
using StudyRoom.API.DTOs.RoomTasks;
using StudyRoom.API.Models;

namespace StudyRoom.API.Services;

public interface IRoomTaskService
{
    Task<List<RoomTaskDto>> GetTasksAsync(Guid roomId);
    Task<RoomTaskDto> CreateTaskAsync(Guid roomId, Guid userId, CreateRoomTaskDto dto);
    Task<RoomTaskDto?> UpdateTaskAsync(Guid roomId, Guid userId, Guid taskId, UpdateRoomTaskDto dto);
    Task<bool> DeleteTaskAsync(Guid roomId, Guid taskId);
}

public class RoomTaskService : IRoomTaskService
{
    private readonly AppDbContext _context;

    public RoomTaskService(AppDbContext context) => _context = context;

    public async Task<List<RoomTaskDto>> GetTasksAsync(Guid roomId)
    {
        var tasks = await _context.RoomTasks
            .Where(t => t.RoomId == roomId)
            .OrderBy(t => t.IsCompleted)
            .ThenByDescending(t => t.CreatedAt)
            .ToListAsync();

        return tasks.Select(t => ToDto(t)).ToList();
    }

    public async Task<RoomTaskDto> CreateTaskAsync(Guid roomId, Guid userId, CreateRoomTaskDto dto)
    {
        var assigneeName = "";
        if (!string.IsNullOrWhiteSpace(dto.AssignedToId) && Guid.TryParse(dto.AssignedToId, out var assigneeId))
        {
            var assignee = await _context.Users.FirstOrDefaultAsync(u => u.Id == assigneeId);
            if (assignee != null)
                assigneeName = string.IsNullOrWhiteSpace(assignee.FirstName) && string.IsNullOrWhiteSpace(assignee.LastName)
                    ? assignee.Username
                    : $"{assignee.FirstName} {assignee.LastName}".Trim();
        }

        var task = new RoomTask
        {
            RoomId = roomId,
            CreatedBy = userId,
            Title = dto.Title.Trim(),
            Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim(),
            AssignedToId = string.IsNullOrWhiteSpace(dto.AssignedToId) || !Guid.TryParse(dto.AssignedToId, out var aid) ? null : aid,
            AssignedToName = string.IsNullOrWhiteSpace(assigneeName) ? null : assigneeName,
            DueDate = ParseDate(dto.DueDate)
        };

        _context.RoomTasks.Add(task);
        await _context.SaveChangesAsync();
        return ToDto(task);
    }

    public async Task<RoomTaskDto?> UpdateTaskAsync(Guid roomId, Guid userId, Guid taskId, UpdateRoomTaskDto dto)
    {
        var task = await _context.RoomTasks.FirstOrDefaultAsync(t => t.Id == taskId && t.RoomId == roomId);
        if (task == null) return null;

        if (!string.IsNullOrWhiteSpace(dto.Title))
            task.Title = dto.Title.Trim();
        if (dto.Description != null)
            task.Description = string.IsNullOrWhiteSpace(dto.Description) ? null : dto.Description.Trim();

        if (dto.AssignedToId != null)
        {
            if (Guid.TryParse(dto.AssignedToId, out var assigneeId) && assigneeId != Guid.Empty)
            {
                var assignee = await _context.Users.FirstOrDefaultAsync(u => u.Id == assigneeId);
                task.AssignedToId = assigneeId;
                task.AssignedToName = assignee == null
                    ? null
                    : (string.IsNullOrWhiteSpace(assignee.FirstName) && string.IsNullOrWhiteSpace(assignee.LastName)
                        ? assignee.Username
                        : $"{assignee.FirstName} {assignee.LastName}".Trim());
            }
            else
            {
                task.AssignedToId = null;
                task.AssignedToName = null;
            }
        }

        if (dto.DueDate != null)
            task.DueDate = string.IsNullOrWhiteSpace(dto.DueDate) ? null : ParseDate(dto.DueDate);

        if (dto.IsCompleted.HasValue && dto.IsCompleted.Value != task.IsCompleted)
        {
            task.IsCompleted = dto.IsCompleted.Value;
            task.CompletedAt = dto.IsCompleted.Value ? DateTime.UtcNow : null;
            task.CompletedBy = dto.IsCompleted.Value ? userId : null;
        }

        await _context.SaveChangesAsync();
        return ToDto(task);
    }

    public async Task<bool> DeleteTaskAsync(Guid roomId, Guid taskId)
    {
        var task = await _context.RoomTasks.FirstOrDefaultAsync(t => t.Id == taskId && t.RoomId == roomId);
        if (task == null) return false;

        _context.RoomTasks.Remove(task);
        await _context.SaveChangesAsync();
        return true;
    }

    private static DateTime? ParseDate(string? value) =>
        DateTime.TryParse(value, out var date) ? DateTime.SpecifyKind(date, DateTimeKind.Utc) : null;

    private static RoomTaskDto ToDto(RoomTask t) => new()
    {
        Id = t.Id,
        Title = t.Title,
        Description = t.Description,
        AssignedToId = t.AssignedToId?.ToString(),
        AssignedToName = t.AssignedToName,
        IsCompleted = t.IsCompleted,
        CompletedBy = t.CompletedBy?.ToString(),
        DueDate = t.DueDate,
        CreatedAt = t.CreatedAt,
        CompletedAt = t.CompletedAt
    };
}