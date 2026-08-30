using StudyRoom.API.DTOs.Broadcasts;

namespace StudyRoom.API.Services;

public interface IScheduledBroadcastService
{
    Task<List<BroadcastDto>> GetForRoomAsync(Guid roomId, Guid userId);
    Task<BroadcastDto> CreateAsync(Guid roomId, CreateBroadcastDto dto, Guid userId);
    Task<BroadcastDto> UpdateAsync(Guid roomId, Guid broadcastId, UpdateBroadcastDto dto, Guid userId);
    Task DeleteAsync(Guid roomId, Guid broadcastId, Guid userId);
    Task<BroadcastDto> SetAttendanceAsync(Guid broadcastId, Guid userId, string status);
}
