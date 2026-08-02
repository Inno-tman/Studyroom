using StudyRoom.API.DTOs.Social;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;

namespace StudyRoom.API.Services;

public class RoomInvitationService : IRoomInvitationService
{
    private readonly IRoomInvitationRepository _inviteRepo;
    private readonly IRoomRepository _roomRepo;
    private readonly IUserRepository _userRepo;

    public RoomInvitationService(
        IRoomInvitationRepository inviteRepo,
        IRoomRepository roomRepo,
        IUserRepository userRepo)
    {
        _inviteRepo = inviteRepo;
        _roomRepo = roomRepo;
        _userRepo = userRepo;
    }

    public async Task<RoomInvitationDto> InviteAsync(Guid roomId, Guid inviterId, Guid inviteeId)
    {
        var room = await _roomRepo.GetByIdAsync(roomId)
            ?? throw new KeyNotFoundException("Room not found.");

        if (!await _roomRepo.IsMemberAsync(roomId, inviterId))
            throw new UnauthorizedAccessException("Only members can invite.");

        if (await _roomRepo.IsMemberAsync(roomId, inviteeId))
            throw new InvalidOperationException("User is already a member.");

        if (await _userRepo.GetByIdAsync(inviteeId) == null)
            throw new KeyNotFoundException("User not found.");

        var existing = await _inviteRepo.GetPendingAsync(roomId, inviteeId);
        if (existing != null)
            throw new InvalidOperationException("Invitation already pending.");

        var invitation = new RoomInvitation
        {
            RoomId = roomId,
            InviterId = inviterId,
            InviteeId = inviteeId,
            Status = "Pending"
        };

        await _inviteRepo.AddAsync(invitation);
        return Map(await _inviteRepo.GetByIdAsync(invitation.Id));
    }

    public async Task<List<RoomInvitationDto>> GetIncomingAsync(Guid userId)
    {
        var invites = await _inviteRepo.GetIncomingAsync(userId);
        return invites.Select(Map).ToList();
    }

    public async Task<List<RoomInvitationDto>> GetForRoomAsync(Guid roomId)
    {
        var invites = await _inviteRepo.GetForRoomAsync(roomId);
        return invites.Select(Map).ToList();
    }

    public async Task<RoomInvitationDto> AcceptAsync(Guid invitationId, Guid userId)
    {
        var invitation = await _inviteRepo.GetByIdAsync(invitationId)
            ?? throw new KeyNotFoundException("Invitation not found.");

        if (invitation.InviteeId != userId)
            throw new UnauthorizedAccessException("Not allowed.");

        if (invitation.Status != "Pending")
            throw new InvalidOperationException("Invitation already processed.");

        invitation.Status = "Accepted";
        await _inviteRepo.UpdateAsync(invitation);

        await _roomRepo.AddMemberAsync(new RoomMember
        {
            RoomId = invitation.RoomId,
            UserId = userId
        });

        return Map(await _inviteRepo.GetByIdAsync(invitation.Id));
    }

    public async Task DeclineAsync(Guid invitationId, Guid userId)
    {
        var invitation = await _inviteRepo.GetByIdAsync(invitationId)
            ?? throw new KeyNotFoundException("Invitation not found.");

        if (invitation.InviteeId != userId)
            throw new UnauthorizedAccessException("Not allowed.");

        await _inviteRepo.DeleteAsync(invitation);
    }

    public async Task CancelAsync(Guid invitationId, Guid userId)
    {
        var invitation = await _inviteRepo.GetByIdAsync(invitationId)
            ?? throw new KeyNotFoundException("Invitation not found.");

        if (invitation.InviterId != userId)
            throw new UnauthorizedAccessException("Not allowed.");

        await _inviteRepo.DeleteAsync(invitation);
    }

    private static RoomInvitationDto Map(RoomInvitation? i) => i == null
        ? new RoomInvitationDto()
        : new RoomInvitationDto
        {
            Id = i.Id,
            RoomId = i.RoomId,
            RoomName = i.Room?.Name ?? "Unknown",
            RoomSubject = i.Room?.Subject,
            InviterId = i.InviterId,
            InviterName = i.Inviter?.Username ?? "Unknown",
            CreatedAt = i.CreatedAt
        };
}
