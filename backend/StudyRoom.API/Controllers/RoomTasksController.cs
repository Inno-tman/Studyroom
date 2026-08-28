using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudyRoom.API.DTOs.RoomTasks;
using StudyRoom.API.Repositories;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/rooms/{roomId}/tasks")]
[Authorize]
public class RoomTasksController : ControllerBase
{
    private readonly IRoomTaskService _taskService;
    private readonly IRoomRepository _roomRepo;

    public RoomTasksController(IRoomTaskService taskService, IRoomRepository roomRepo)
    {
        _taskService = taskService;
        _roomRepo = roomRepo;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    private async Task<bool> IsMemberAsync(Guid roomId) =>
        await _roomRepo.IsMemberAsync(roomId, UserId);

    [HttpGet]
    public async Task<IActionResult> GetTasks(Guid roomId)
    {
        if (!await IsMemberAsync(roomId)) return StatusCode(403, new { error = "Not a member of this room" });
        var tasks = await _taskService.GetTasksAsync(roomId);
        return Ok(tasks);
    }

    [HttpPost]
    public async Task<IActionResult> CreateTask(Guid roomId, [FromBody] CreateRoomTaskDto dto)
    {
        if (!await IsMemberAsync(roomId)) return StatusCode(403, new { error = "Not a member of this room" });
        if (string.IsNullOrWhiteSpace(dto.Title)) return BadRequest(new { error = "Title is required" });

        var task = await _taskService.CreateTaskAsync(roomId, UserId, dto);
        return Ok(task);
    }

    [HttpPatch("{taskId}")]
    public async Task<IActionResult> UpdateTask(Guid roomId, Guid taskId, [FromBody] UpdateRoomTaskDto dto)
    {
        if (!await IsMemberAsync(roomId)) return StatusCode(403, new { error = "Not a member of this room" });

        var task = await _taskService.UpdateTaskAsync(roomId, UserId, taskId, dto);
        if (task == null) return NotFound(new { error = "Task not found" });
        return Ok(task);
    }

    [HttpDelete("{taskId}")]
    public async Task<IActionResult> DeleteTask(Guid roomId, Guid taskId)
    {
        if (!await IsMemberAsync(roomId)) return StatusCode(403, new { error = "Not a member of this room" });

        var deleted = await _taskService.DeleteTaskAsync(roomId, taskId);
        if (!deleted) return NotFound(new { error = "Task not found" });
        return Ok(new { success = true });
    }
}