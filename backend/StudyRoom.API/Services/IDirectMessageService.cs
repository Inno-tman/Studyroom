using StudyRoom.API.DTOs.Social;

namespace StudyRoom.API.Services;

public interface IDirectMessageService
{
    Task<DirectMessageDto> SendAsync(Guid senderId, Guid receiverId, string content);
    Task<List<DirectMessageDto>> GetConversationAsync(Guid userA, Guid userB);
    Task<List<ConversationDto>> GetConversationsAsync(Guid userId);
    Task<int> GetUnreadCountAsync(Guid userId);
    Task DeleteAsync(Guid messageId, Guid userId);
}
