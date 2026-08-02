using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IRoomInvitationRepository
{
    Task<RoomInvitation?> GetByIdAsync(Guid id);
    Task<RoomInvitation?> GetPendingAsync(Guid roomId, Guid inviteeId);
    Task<List<RoomInvitation>> GetIncomingAsync(Guid inviteeId);
    Task<List<RoomInvitation>> GetForRoomAsync(Guid roomId);
    Task AddAsync(RoomInvitation invitation);
    Task UpdateAsync(RoomInvitation invitation);
    Task DeleteAsync(RoomInvitation invitation);
}
