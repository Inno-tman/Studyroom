using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IDirectMessageRepository
{
    Task<List<DirectMessage>> GetConversationAsync(Guid userA, Guid userB, int take = 100);
    Task<List<DirectMessage>> GetRecentAsync(Guid userId, int take = 100);
    Task<DirectMessage> AddAsync(DirectMessage message);
}
