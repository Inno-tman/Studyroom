using StudyRoom.API.DTOs.Rooms;
using StudyRoom.API.Models;
using StudyRoom.API.Repositories;
using System.Linq;

namespace StudyRoom.API.Services;

public class RoomService : IRoomService
{
    private readonly IRoomRepository _roomRepo;
    private readonly IUserRepository _userRepo;

    public RoomService(IRoomRepository roomRepo, IUserRepository userRepo)
    {
        _roomRepo = roomRepo;
        _userRepo = userRepo;
    }

    public async Task<List<RoomDto>> GetAllAsync(string? search, string? subject, Guid? userId)
    {
        var rooms = await _roomRepo.GetAllAsync(search, subject);
        return rooms.Select(r => MapToDto(r, userId)).ToList();
    }

    public async Task<RoomDto> GetByIdAsync(Guid id, Guid? userId)
    {
        var room = await _roomRepo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Room not found.");
        return MapToDto(room, userId);
    }

    public async Task<RoomDto> CreateAsync(CreateRoomDto dto, Guid userId)
    {
        var room = new Room
        {
            Name = dto.Name,
            Description = dto.Description,
            Subject = dto.Subject,
            IsPrivate = dto.IsPrivate,
            CreatedBy = userId,
            JoinCode = dto.IsPrivate ? GenerateJoinCode() : null
        };

        await _roomRepo.AddAsync(room);

        await _roomRepo.AddMemberAsync(new RoomMember
        {
            RoomId = room.Id,
            UserId = userId,
            Role = RoomRoles.Host
        });

        return MapToDto(room, userId);
    }

    public async Task<RoomDto> UpdateAsync(Guid id, UpdateRoomDto dto, Guid userId)
    {
        var room = await _roomRepo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Room not found.");

        if (room.CreatedBy != userId)
        {
            var membership = await _roomRepo.GetMembershipAsync(id, userId);
            if (membership?.Role != RoomRoles.Cohost)
                throw new UnauthorizedAccessException("Only the room owner or a co-host can update.");
        }

        room.Name = dto.Name;
        room.Description = dto.Description;
        room.Subject = dto.Subject;
        room.IsPrivate = dto.IsPrivate;

        await _roomRepo.UpdateAsync(room);
        return MapToDto(room, userId);
    }

    public async Task DeleteAsync(Guid id, Guid userId)
    {
        var room = await _roomRepo.GetByIdAsync(id)
            ?? throw new KeyNotFoundException("Room not found.");

        if (room.CreatedBy != userId)
            throw new UnauthorizedAccessException("Only the room owner can delete.");

        await _roomRepo.DeleteAsync(room);
    }

    public async Task<RoomDto> JoinAsync(Guid roomId, Guid userId, string? joinCode)
    {
        var room = await _roomRepo.GetByIdAsync(roomId)
            ?? throw new KeyNotFoundException("Room not found.");

        if (room.IsPrivate && room.JoinCode != joinCode)
            throw new UnauthorizedAccessException("Invalid join code.");

        if (await _roomRepo.IsMemberAsync(roomId, userId))
            throw new InvalidOperationException("Already a member.");

        await _roomRepo.AddMemberAsync(new RoomMember
        {
            RoomId = roomId,
            UserId = userId
        });

        return MapToDto(room, userId);
    }

    public async Task LeaveAsync(Guid roomId, Guid userId)
    {
        if (!await _roomRepo.IsMemberAsync(roomId, userId))
            throw new InvalidOperationException("Not a member.");

        await _roomRepo.RemoveMemberAsync(roomId, userId);
    }

    public async Task<List<UserDto>> GetMembersAsync(Guid roomId)
    {
        var memberships = await _roomRepo.GetMembersWithRolesAsync(roomId);
        return memberships.Select(m => new UserDto
        {
            Id = m.User!.Id,
            Username = m.User.Username,
            AvatarUrl = m.User.AvatarUrl,
            Role = m.Role
        }).ToList();
    }

    /// <summary>True if the user is the room creator or a co-host.</summary>
    public async Task<bool> IsModeratorAsync(Guid roomId, Guid userId)
    {
        var room = await _roomRepo.GetByIdAsync(roomId);
        if (room == null) return false;
        if (room.CreatedBy == userId) return true;
        var membership = await _roomRepo.GetMembershipAsync(roomId, userId);
        return membership?.Role == RoomRoles.Cohost;
    }

    public async Task<List<RoomDto>> GetUserRoomsAsync(Guid userId)
    {
        var rooms = await _roomRepo.GetUserRoomsAsync(userId);
        return rooms.Select(r => MapToDto(r, userId)).ToList();
    }

    private RoomDto MapToDto(Room room, Guid? userId)
    {
        return new RoomDto
        {
            Id = room.Id,
            Name = room.Name,
            Description = room.Description,
            Subject = room.Subject,
            IsPrivate = room.IsPrivate,
            JoinCode = userId.HasValue && (room.CreatedBy == userId || room.Members?.Any(m => m.UserId == userId) == true)
                ? room.JoinCode
                : null,
            CreatedByUsername = room.Creator?.Username ?? "Unknown",
            CreatedById = room.CreatedBy,
            MemberCount = room.Members?.Count ?? 0,
            CreatedAt = room.CreatedAt,
            CurrentUserRole = userId.HasValue
                ? (room.CreatedBy == userId
                    ? RoomRoles.Host
                    : (room.Members?.FirstOrDefault(m => m.UserId == userId)?.Role ?? RoomRoles.Member))
                : null
        };
    }

    private static string GenerateJoinCode()
    {
        const string chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        var random = new Random();
        return new string(Enumerable.Range(0, 6).Select(_ => chars[random.Next(chars.Length)]).ToArray());
    }
}
