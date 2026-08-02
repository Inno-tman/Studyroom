using StudyRoom.API.DTOs.Social;

namespace StudyRoom.API.Services;

public interface IRoomInvitationService
{
    Task<RoomInvitationDto> InviteAsync(Guid roomId, Guid inviterId, Guid inviteeId);
    Task<List<RoomInvitationDto>> GetIncomingAsync(Guid userId);
    Task<List<RoomInvitationDto>> GetForRoomAsync(Guid roomId);
    Task<RoomInvitationDto> AcceptAsync(Guid invitationId, Guid userId);
    Task DeclineAsync(Guid invitationId, Guid userId);
    Task CancelAsync(Guid invitationId, Guid userId);
}
