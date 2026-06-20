using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IRoomRepository
{
    Task<List<Room>> GetAllAsync(string? search, string? subject);
    Task<Room?> GetByIdAsync(Guid id);
    Task<List<Room>> GetRecentRoomsAsync(Guid userId, int count = 5);
    Task AddAsync(Room room);
    Task UpdateAsync(Room room);
    Task DeleteAsync(Room room);
    Task<bool> IsMemberAsync(Guid roomId, Guid userId);
    Task AddMemberAsync(RoomMember member);
    Task RemoveMemberAsync(Guid roomId, Guid userId);
    Task<List<User>> GetMembersAsync(Guid roomId);
    Task<int> GetMemberCountAsync(Guid roomId);
    Task<RoomMember?> GetMembershipAsync(Guid roomId, Guid userId);
    Task<List<Room>> GetUserRoomsAsync(Guid userId);
}
