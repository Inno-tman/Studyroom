using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using StudyRoom.API.Data;
using StudyRoom.API.DTOs.Rooms;
using StudyRoom.API.Services;

namespace StudyRoom.API.Controllers;

[ApiController]
[Route("api/rooms")]
[Authorize]
public class RoomsController : ControllerBase
{
    private readonly IRoomService _roomService;
    private readonly AppDbContext _context;
    private readonly IWebHostEnvironment _env;

    public RoomsController(IRoomService roomService, AppDbContext context, IWebHostEnvironment env)
    {
        _roomService = roomService;
        _context = context;
        _env = env;
    }

    private Guid UserId => Guid.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);

    [HttpGet]
    public async Task<IActionResult> GetAll([FromQuery] string? search, [FromQuery] string? subject)
    {
        var rooms = await _roomService.GetAllAsync(search, subject, UserId);
        return Ok(rooms);
    }

    [HttpGet("{id}")]
    public async Task<IActionResult> GetById(Guid id)
    {
        try
        {
            var room = await _roomService.GetByIdAsync(id, UserId);
            return Ok(room);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] CreateRoomDto dto)
    {
        var room = await _roomService.CreateAsync(dto, UserId);
        return CreatedAtAction(nameof(GetById), new { id = room.Id }, room);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] UpdateRoomDto dto)
    {
        try
        {
            var room = await _roomService.UpdateAsync(id, dto, UserId);
            return Ok(room);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return Forbid();
        }
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(Guid id)
    {
        try
        {
            await _roomService.DeleteAsync(id, UserId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
    }

    [HttpPost("{id}/join")]
    [EnableRateLimiting("join")]
    public async Task<IActionResult> Join(Guid id, [FromBody] JoinRoomDto? dto)
    {
        try
        {
            var room = await _roomService.JoinAsync(id, UserId, dto?.JoinCode);
            return Ok(room);
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpPost("{id}/leave")]
    public async Task<IActionResult> Leave(Guid id)
    {
        try
        {
            await _roomService.LeaveAsync(id, UserId);
            return Ok();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("{id}/members")]
    public async Task<IActionResult> GetMembers(Guid id)
    {
        var members = await _roomService.GetMembersAsync(id);
        return Ok(members);
    }

    [HttpPut("{id}/members/{memberUserId}/role")]
    public async Task<IActionResult> SetMemberRole(Guid id, Guid memberUserId, [FromBody] SetRoleDto dto)
    {
        try
        {
            await _roomService.SetMemberRoleAsync(id, memberUserId, dto.Role ?? "member", UserId);
            return NoContent();
        }
        catch (KeyNotFoundException ex)
        {
            return NotFound(new { error = ex.Message });
        }
        catch (UnauthorizedAccessException)
        {
            return Forbid();
        }
        catch (InvalidOperationException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
        catch (ArgumentException ex)
        {
            return BadRequest(new { error = ex.Message });
        }
    }

    [HttpGet("my")]
    public async Task<IActionResult> GetMyRooms()
    {
        var rooms = await _roomService.GetUserRoomsAsync(UserId);
        return Ok(rooms);
    }

    [HttpPost("{id}/background")]
    public async Task<IActionResult> UploadBackground(Guid id, IFormFile file)
    {
        var room = await _context.Rooms.FindAsync(id);
        if (room == null) return NotFound();
        if (room.CreatedBy != UserId) return Forbid();
        if (file == null || file.Length == 0) return BadRequest("No file");
        if (file.Length > 5 * 1024 * 1024) return BadRequest("Max 5MB");

        var ext = Path.GetExtension(file.FileName).ToLower();
        if (!new[] { ".jpg", ".jpeg", ".png", ".webp" }.Contains(ext))
            return BadRequest("Only JPG, PNG, WebP allowed");

        var uploadsDir = Path.Combine(_env.WebRootPath, "uploads", "rooms");
        Directory.CreateDirectory(uploadsDir);

        var fileName = $"{id}{ext}";
        var filePath = Path.Combine(uploadsDir, fileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        var url = $"/uploads/rooms/{fileName}";
        room.BackgroundUrl = url;
        await _context.SaveChangesAsync();

        return Ok(new { url });
    }
}

public class JoinRoomDto
{
    public string? JoinCode { get; set; }
}

public class SetRoleDto
{
    public string? Role { get; set; }
}
