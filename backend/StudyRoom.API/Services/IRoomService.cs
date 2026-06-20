using StudyRoom.API.DTOs.Rooms;

namespace StudyRoom.API.Services;

public interface IRoomService
{
    Task<List<RoomDto>> GetAllAsync(string? search, string? subject, Guid? userId);
    Task<RoomDto> GetByIdAsync(Guid id, Guid? userId);
    Task<RoomDto> CreateAsync(CreateRoomDto dto, Guid userId);
    Task<RoomDto> UpdateAsync(Guid id, UpdateRoomDto dto, Guid userId);
    Task DeleteAsync(Guid id, Guid userId);
    Task<RoomDto> JoinAsync(Guid roomId, Guid userId, string? joinCode);
    Task LeaveAsync(Guid roomId, Guid userId);
    Task<List<UserDto>> GetMembersAsync(Guid roomId);
    Task<List<RoomDto>> GetUserRoomsAsync(Guid userId);
}

public class UserDto
{
    public Guid Id { get; set; }
    public string Username { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
}
