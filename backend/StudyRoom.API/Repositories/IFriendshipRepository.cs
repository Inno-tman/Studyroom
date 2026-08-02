using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IFriendshipRepository
{
    Task<Friendship?> GetByIdAsync(Guid id);
    Task<Friendship?> GetBetweenAsync(Guid userIdA, Guid userIdB);
    Task<List<Friendship>> GetFriendIdsAsync(Guid userId);
    Task<List<Friendship>> GetIncomingAsync(Guid userId);
    Task<List<Friendship>> GetOutgoingAsync(Guid userId);
    Task AddAsync(Friendship friendship);
    Task UpdateAsync(Friendship friendship);
    Task DeleteAsync(Friendship friendship);
}
