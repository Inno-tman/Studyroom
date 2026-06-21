using StudyRoom.API.Models;

namespace StudyRoom.API.Repositories;

public interface IAiConversationRepository
{
    Task<AiConversation> CreateConversationAsync(Guid userId, string? roomId, string? subject, bool isResearchMode, string? phase);
    Task<AiMessage> AddMessageAsync(Guid conversationId, string role, string content, string? referencesJson);
    Task<List<AiConversation>> GetUserConversationsAsync(Guid userId, int limit = 10);
    Task<AiConversation?> GetConversationWithMessagesAsync(Guid conversationId);
    Task DeleteConversationAsync(Guid conversationId);
    Task UpdatePhaseAsync(Guid conversationId, string phase);
}
