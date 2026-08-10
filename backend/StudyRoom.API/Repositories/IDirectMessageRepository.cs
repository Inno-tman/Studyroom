using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IDirectMessageRepository
{
    Task<List<DirectMessage>> GetConversationAsync(Guid userA, Guid userB, int take = 100);
    Task<List<DirectMessage>> GetRecentAsync(Guid userId, int take = 100);
    Task<List<DirectMessage>> GetStaleUnreadAsync(DateTime olderThan);
    Task<int> GetUnreadCountAsync(Guid receiverId);
    Task MarkReadAsync(Guid userA, Guid userB);
    Task MarkNotificationSentAsync(IEnumerable<Guid> ids);
    Task<DirectMessage?> GetByIdAsync(Guid id);
    Task DeleteAsync(Guid id);
    Task<DirectMessage> AddAsync(DirectMessage message);
}
